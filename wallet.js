/**
 * Lógica para interactuar con Celo (Billeteras).
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits, encodeFunctionData } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import * as readline from 'readline'
import qrcode from 'qrcode-terminal'

// ── Cargar .env manualmente (sin dependencias extra) ──────────────────────────
if (existsSync('.env')) {
  readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim()
  })
}

// ── Configuración de Red ──────────────────────────────────────────────────────
const isSepolia = process.argv.includes('--sepolia') || process.env.NETWORK === 'sepolia'
const currentChain = isSepolia ? celoSepolia : celo
const RPC = isSepolia ? 'https://forno.celo-sepolia.celo-testnet.org' : 'https://forno.celo.org'
export const explorerUrl = isSepolia ? 'https://celo-sepolia.blockscout.com/tx' : 'https://celoscan.io/tx'

// Contratos verificados (docs.celo.org)
const TOKENS_MAINNET = {
  CELO: { isNative: true, decimals: 18 },
  USDC: { address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', adapter: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B', decimals: 6 },
  USDT: { address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', adapter: '0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72', decimals: 6 },
  USDm: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', adapter: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 },
  EURm: { address: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73', adapter: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73', decimals: 18 },
  BRLm: { address: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787', adapter: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787', decimals: 18 },
  COPM: { address: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA', adapter: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA', decimals: 18 }
}

const TOKENS_SEPOLIA = {
  CELO: { isNative: true, decimals: 18 },
  USDC: { address: '0x01C5C0122039549AD1493B8220cABEdD739BC44E', adapter: '0x01C5C0122039549AD1493B8220cABEdD739BC44E', decimals: 6 },
  USDT: { address: '0xd077A400968890Eacc75cdc901F0356c943e4fDb', adapter: '0xd077A400968890Eacc75cdc901F0356c943e4fDb', decimals: 6 },
  USDm: { address: '0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80', adapter: '0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80', decimals: 18 },
  EURm: { address: '0x6B172e333e2978484261D7eCC3DE491E79764BbC', adapter: '0x6B172e333e2978484261D7eCC3DE491E79764BbC', decimals: 18 },
  BRLm: { address: '0x2294298942fdc79417DE9E0D740A4957E0e7783a', adapter: '0x2294298942fdc79417DE9E0D740A4957E0e7783a', decimals: 18 },
  COPM: { address: '0x5F8d55c3627d2dc0a2B4afa798f877242F382F67', adapter: '0x5F8d55c3627d2dc0a2B4afa798f877242F382F67', decimals: 18 }
}

const TOKENS = isSepolia ? TOKENS_SEPOLIA : TOKENS_MAINNET

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

export const publicClient = createPublicClient({ chain: currentChain, transport: http(RPC) })

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

export async function balances(address) {
  const target = address ?? process.env.ADDRESS
  if (!target) { 
    console.error('❌  Proporciona una dirección o define ADDRESS en .env')
    process.exit(1) 
  }

  console.log(`\nConsultando balances para ${target}`)

  const promises = Object.entries(TOKENS).map(async ([symbol, token]) => {
    try {
      if (token.isNative) {
        const bal = await publicClient.getBalance({ address: target })
        return { symbol, balance: formatEther(bal) }
      } else {
        const bal = await publicClient.readContract({ 
          address: token.address, 
          abi: ERC20_ABI, 
          functionName: 'balanceOf', 
          args: [target] 
        })
        return { symbol, balance: formatUnits(bal, token.decimals) }
      }
    } catch (e) {
      return { symbol, balance: 'Error' }
    }
  })

  const results = await Promise.all(promises)
  
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


