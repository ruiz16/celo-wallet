/**
 * Lógica para interactuar con Celo (Billeteras).
 */

import { createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import qrcode from 'qrcode-terminal'
import { currentChain, RPC, explorerUrl, isSepolia, publicClient } from '../lib/network.js'
import { TOKENS } from '../lib/tokens.js'

export { explorerUrl, publicClient } from '../lib/network.js'

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'string' }] }
]

export async function resolveToken(input) {
  if (input.startsWith('0x')) {
    try {
      const decimals = await publicClient.readContract({
        address: input,
        abi: ERC20_ABI,
        functionName: 'decimals'
      });
      const symbol = await publicClient.readContract({
        address: input,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }).catch(() => 'CUSTOM');
      
      return {
        isNative: false,
        address: input,
        decimals: decimals,
        symbol: symbol,
        adapter: undefined // No se asume fee abstraction para custom tokens
      };
    } catch (error) {
      console.error(`❌  No se pudo leer la información del token en la dirección ${input}. Verifica que sea un contrato ERC20 válido.`);
      process.exit(1);
    }
  } else {
    const token = TOKENS[input.toUpperCase()];
    if (!token) {
      console.error(`❌  Token no soportado. Soportados: ${Object.keys(TOKENS).join(', ')} o una dirección de contrato (0x...).`);
      process.exit(1);
    }
    return { ...token, symbol: input.toUpperCase() };
  }
}

export function getWalletClient() {
  const pk = process.env.PRIVATE_KEY
  if (!pk) {
    console.error('❌  No se encontró PRIVATE_KEY en .env — ejecuta primero: npx celo-utils generate')
    process.exit(1)
  }
  
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
  return { client: createWalletClient({ account, chain: currentChain, transport: http(RPC) }), account }
}

// ── Comandos ──────────────────────────────────────────────────────────────────

async function getTokenBalance(target, symbol, token) {
  try {
    if (token.isNative) {
      const bal = await publicClient.getBalance({ address: target })
      return { symbol, balance: formatEther(bal) }
    }

    const bal = await publicClient.readContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [target]
    })

    return { symbol, balance: formatUnits(bal, token.decimals) }
  } catch (e) {
    return { symbol, balance: 'Error' }
  }
}

export async function balances(address, tokenInput = null) {
  const target = address ?? process.env.ADDRESS
  if (!target) { 
    console.error('❌  Proporciona una dirección o define ADDRESS en .env')
    process.exit(1) 
  }

  console.log(`\nConsultando balances para ${target}`)

  let results
  if (tokenInput) {
    const token = await resolveToken(tokenInput)
    results = [await getTokenBalance(target, token.symbol, token)]
  } else {
    const promises = Object.entries(TOKENS).map(([symbol, token]) => getTokenBalance(target, symbol, token))
    results = await Promise.all(promises)
  }
  
  console.log(`\n=== Balances ===`)
  for (const res of results) {
    console.log(`${res.symbol.padEnd(6)}: ${res.balance}`)
  }
  console.log('================\n')
}

export async function send(to, amount, tokenInput) {
  const token = await resolveToken(tokenInput)

  const { client, account } = getWalletClient()

  console.log(`\nEnviando ${amount} ${token.symbol} a ${to}`)
  if (!token.isNative && token.adapter) {
    console.log(`(El gas será pagado en ${token.symbol} via fee abstraction)`)
  }

  let hash
  if (token.isNative) {
    hash = await client.sendTransaction({
      account,
      to,
      value: parseEther(amount),
    })
  } else {
    const txObj = {
      account,
      to: token.address,
      data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [to, parseUnits(amount, token.decimals)] }),
    }
    if (token.adapter) txObj.feeCurrency = token.adapter
    
    hash = await client.sendTransaction(txObj)
  }

  console.log(`✓ TX enviada: ${explorerUrl}/${hash}`)
}

export async function multisend(addresses, amountPerAddress, tokenInput) {
  const token = await resolveToken(tokenInput)

  const { client, account } = getWalletClient()
  const addressList = addresses.split(',').map(a => a.trim())

  console.log(`\n=== Multisend (Airdrop) ===`)
  console.log(`Enviando ${amountPerAddress} ${token.symbol} a ${addressList.length} direcciones...`)
  if (!token.isNative && token.adapter) {
    console.log(`(El gas será pagado en ${token.symbol} via fee abstraction)`)
  }

  let successCount = 0;
  for (let i = 0; i < addressList.length; i++) {
    const to = addressList[i];
    try {
      let hash;
      if (token.isNative) {
        hash = await client.sendTransaction({
          account,
          to,
          value: parseEther(amountPerAddress),
        })
      } else {
        const txObj = {
          account,
          to: token.address,
          data: encodeFunctionData({ 
            abi: ERC20_ABI, 
            functionName: 'transfer', 
            args: [to, parseUnits(amountPerAddress, token.decimals)] 
          })
        }
        if (token.adapter) txObj.feeCurrency = token.adapter

        hash = await client.sendTransaction(txObj)
      }
      console.log(`[${i + 1}/${addressList.length}] ✅ Enviado a ${to} -> Hash: ${hash}`)
      successCount++;
    } catch (error) {
      console.log(`[${i + 1}/${addressList.length}] ❌ Falló envío a ${to}: ${error.message.split('\n')[0]}`)
    }
  }
  console.log(`\nCompletado: ${successCount} exitosos de ${addressList.length} intentos.`)
}

export function generateWallet() {
  const mnemonic = generateMnemonic(english)
  const account = mnemonicToAccount(mnemonic)

  // En viem, para obtener la private key de un account generado por mnemonic:
  const privateKey = account.getHdKey().privateKey

  console.log('\n=== Nueva Wallet Celo ===')
  console.log(`Dirección:    ${account.address}`)
  console.log(`Private Key:  ${privateKey}`)
  console.log(`Seed Phrase:  ${mnemonic}`)
  console.log('\n⚠️  Guarda tu archivo seed.txt en un lugar seguro. Quien tenga esas palabras controla tus fondos.')

  if (!existsSync('.env')) {
    writeFileSync('.env', `PRIVATE_KEY=${privateKey}\nADDRESS=${account.address}\n`)
    console.log('\n✓ Private Key y Address guardadas en .env (para el uso del CLI)')
  } else {
    console.log('\n⚠️  .env ya existe — no se sobreescribió. Copia la Private Key manualmente si quieres usarla.')
  }

  if (!existsSync('seed.txt')) {
    writeFileSync('seed.txt', mnemonic)
    console.log('✓ Frase semilla guardada en seed.txt')
  } else {
    console.log('⚠️  seed.txt ya existe — no se sobreescribió. Tu nueva frase semilla no ha sido guardada en archivo.')
  }
}

export function exportWallet() {
  let found = false;
  console.log('\n=== Exportar Wallet ===')

  if (existsSync('seed.txt')) {
    const mnemonic = readFileSync('seed.txt', 'utf8').trim()
    console.log(`\nSeed Phrase (desde seed.txt): \n${mnemonic}`)
    found = true;
  }
  
  if (process.env.PRIVATE_KEY) {
    console.log(`\nPrivate Key (desde .env): \n${process.env.PRIVATE_KEY}`)
    found = true;
  }

  if (found) {
    console.log('\n⚠️  ¡Nunca compartas tu Seed Phrase o Private Key con nadie!')
  } else {
    console.error('❌  No se encontraron credenciales en .env ni en seed.txt.')
  }
}

export function generateQR(address) {
  const target = address ?? process.env.ADDRESS
  if (!target) {
    console.error('❌  Proporciona una dirección o define ADDRESS en .env')
    process.exit(1)
  }

  console.log(`\n📱 Código QR para la dirección:`)
  console.log(target)
  console.log()
  qrcode.generate(target, { small: true })
}

export async function fund(targetAddress) {
  const addressToFund = targetAddress || process.env.ADDRESS;

  if (!addressToFund) {
    console.error('❌  Debes proporcionar una dirección o tener ADDRESS configurado en tu .env para pedir fondos.');
    process.exit(1);
  }

  if (!isSepolia) {
    console.error('❌  El comando fund solo está disponible en la red de pruebas (Sepolia).');
    console.error('👉  Usa: npx celo-utils fund --sepolia');
    process.exit(1);
  }

  console.log(`\n=== Faucet de Celo Sepolia ===`);
  console.log(`Pidiendo fondos para: ${addressToFund}`);
  console.log(`⏳ Conectando al faucet público`);

  try {
    const response = await fetch('https://faucet.celo.org/api/v1/faucet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        beneficiary: addressToFund,
        network: 'alfajores' // La API del faucet internamente todavía usa este identificador
      })
    })

    const data = await response.json()

    if (response.ok) {
      console.log(`✅ ¡Fondos enviados exitosamente!`);
      console.log(`Los tokens deberían aparecer en tu balance en unos segundos.`);
      console.log(`Verifica con: npx celo-utils balances ${addressToFund} --sepolia`);
    } else {
      console.log(`❌ Error del Faucet: ${data.message || 'Error desconocido'}`);
      console.log(`Prueba pidiendo manualmente en: https://faucet.celo.org/celo-sepolia`);
    }
  } catch (error) {
    console.error(`❌ Falló la conexión al Faucet: ${error.message}`);
    console.log(`Prueba pidiendo manualmente en: https://faucet.celo.org/celo-sepolia`);
  }
}

export async function validateWallet(address) {
  if (!address || !address.startsWith('0x')) {
    console.error('❌  Debes proporcionar una dirección válida (0x...).');
    process.exit(1);
  }

  console.log(`\n🔍 Validando billetera: ${address} en ${isSepolia ? 'Sepolia Testnet' : 'Mainnet'}`);
  
  try {
    const balance = await publicClient.getBalance({ address });
    const txCount = await publicClient.getTransactionCount({ address });

    console.log(`\n=== Resultados de Validación ===`);
    if (balance > 0n || txCount > 0) {
      console.log(`✅ ¡La billetera está ACTIVA en Celo!`);
      console.log(`   - Balance Nativo: ${formatEther(balance)} CELO`);
      console.log(`   - Transacciones : ${txCount} enviadas desde esta cuenta`);
    } else {
      console.log(`⚠️  La billetera parece estar INACTIVA en Celo.`);
      console.log(`   - No tiene balance de CELO.`);
      console.log(`   - Nunca ha enviado transacciones en esta red.`);
      if (isSepolia) {
        console.log(`\n💡 TIP: Puedes pedir tokens de prueba ejecutando:`);
        console.log(`   npx celo-utils fund ${address} --sepolia`);
      }
    }
    console.log(`================================\n`);
  } catch (error) {
    console.error(`❌  Error al validar la billetera: ${error.message}`);
  }
}
