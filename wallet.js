#!/usr/bin/env node
/**
 * CLI para interactuar con Celo.
 * Uso:
 *   npx celo-utils balances [address]
 *   npx celo-utils send <token> <to> <amount>
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits, encodeFunctionData } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'
import { readFileSync, writeFileSync, existsSync } from 'fs'

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
const explorerUrl = isSepolia ? 'https://celo-sepolia.blockscout.com/tx' : 'https://celoscan.io/tx'

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
]

const publicClient = createPublicClient({ chain: currentChain, transport: http(RPC) })

function getWalletClient() {
  const pk = process.env.PRIVATE_KEY
  if (!pk) {
    console.error('❌  No se encontró PRIVATE_KEY en .env — ejecuta primero: npx celo-utils generate')
    process.exit(1)
  }
  
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
  return { client: createWalletClient({ account, chain: currentChain, transport: http(RPC) }), account }
}

// ── Comandos ──────────────────────────────────────────────────────────────────

async function balances(address) {
  const target = address ?? process.env.ADDRESS
  if (!target) { 
    console.error('❌  Proporciona una dirección o define ADDRESS en .env')
    process.exit(1) 
  }

  console.log(`\nConsultando balances para ${target}...`)

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

async function send(tokenSymbol, to, amount) {
  const token = TOKENS[tokenSymbol.toUpperCase()]
  if (!token) {
    console.error(`❌  Token no soportado. Soportados: ${Object.keys(TOKENS).join(', ')}`)
    process.exit(1)
  }

  const { client, account } = getWalletClient()

  if (token.isNative) {
    console.log(`\nEnviando ${amount} CELO a ${to}...`)
    const hash = await client.sendTransaction({
      account,
      to,
      value: parseEther(amount),
    })
    console.log(`✓ TX enviada: ${explorerUrl}/${hash}`)
  } else {
    console.log(`\nEnviando ${amount} ${tokenSymbol.toUpperCase()} a ${to}...`)
    console.log(`(El gas será pagado en ${tokenSymbol.toUpperCase()} via fee abstraction)`)
    
    const hash = await client.sendTransaction({
      account,
      to: token.address,
      data: encodeFunctionData({ 
        abi: ERC20_ABI, 
        functionName: 'transfer', 
        args: [to, parseUnits(amount, token.decimals)] 
      }),
      feeCurrency: token.adapter,
    })
    console.log(`✓ TX enviada: ${explorerUrl}/${hash}`)
  }
}

function generateWallet() {
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

function exportWallet() {
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

async function drain(to) {
  if (!to) {
    console.error('❌  Debes proporcionar una dirección de destino para vaciar la cuenta.')
    process.exit(1)
  }

  const { client, account } = getWalletClient()
  
  const balance = await publicClient.getBalance({ address: account.address })
  
  // En Viem para Celo, estimamos el gas necesario para un envío estándar (21000)
  const gasPrice = await publicClient.getGasPrice()
  const gasLimit = 21000n
  const gasCost = gasLimit * gasPrice
  
  if (balance <= gasCost) {
    console.error(`❌  Balance insuficiente (${formatEther(balance)} CELO) para cubrir el costo de gas estimado (${formatEther(gasCost)} CELO).`)
    process.exit(1)
  }
  
  const sendAmount = balance - gasCost

  console.log(`\n=== Vaciando cuenta ${account.address} ===`)
  console.log(`Balance:    ${formatEther(balance)} CELO`)
  console.log(`Gas cost:   ${formatEther(gasCost)} CELO`)
  console.log(`Enviando:   ${formatEther(sendAmount)} CELO → ${to}`)

  const hash = await client.sendTransaction({
    account,
    to,
    value: sendAmount,
    gas: gasLimit,
    gasPrice: gasPrice
  })
  
  console.log(`✓ TX enviada: ${explorerUrl}/${hash}`)
}

async function fund() {
  const { account } = getWalletClient()

  if (!isSepolia) {
    console.error('❌  El comando fund solo está disponible en la red de pruebas (Sepolia).')
    process.exit(1)
  }

  console.log(`\n=== Faucet de Celo Sepolia ===`)
  console.log(`Pidiendo fondos para: ${account.address}`)
  console.log(`⏳ Conectando al faucet público...`)

  try {
    const response = await fetch('https://faucet.celo.org/api/v1/faucet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        beneficiary: account.address,
        network: 'alfajores' // La API del faucet internamente todavía usa este identificador
      })
    })

    const data = await response.json()

    if (response.ok) {
      console.log(`✅ ¡Fondos enviados exitosamente!`)
      console.log(`Los tokens deberían aparecer en tu balance en unos segundos.`)
    } else {
      console.log(`❌ Error del Faucet: ${data.message || 'Error desconocido'}`)
      console.log(`Prueba pidiendo manualmente en: https://faucet.celo.org/celo-sepolia`)
    }
  } catch (error) {
    console.error(`❌ Falló la conexión al Faucet: ${error.message}`)
    console.log(`Prueba pidiendo manualmente en: https://faucet.celo.org/celo-sepolia`)
  }
}
function showHelp() {
  console.log(`
CLI de utilidades de Celo (${isSepolia ? 'Sepolia Testnet' : 'Mainnet'})

Para usar Sepolia Testnet, añade el flag --sepolia al final de tu comando,
o define NETWORK=sepolia en tu archivo .env.

Uso:
  npx celo-utils generate [--sepolia]
      Genera una nueva cuenta.
      Guarda la Private Key en .env y la Seed Phrase en seed.txt.

  npx celo-utils export
      Muestra la Seed Phrase (desde seed.txt) y la Private Key (desde .env).

  npx celo-utils balances [address] [--sepolia]
      Muestra los balances de CELO, USDC, USDT, USDm, EURm, BRLm y COPm.
      Si no se especifica address, usa ADDRESS de .env.

  npx celo-utils drain <to> [--sepolia]
      Vacía la cuenta configurada en tu .env (PRIVATE_KEY).
      Envía todo el saldo disponible de CELO a la dirección <to> destino,
      deduciendo automáticamente el costo exacto del gas.

  npx celo-utils send <token> <to> <amount> [--sepolia]
      Envía tokens (CELO, USDC, USDT, USDm, EURm, BRLm, COPm) a una dirección.
      Si envías un token ERC20 soportado, la comisión (gas) se pagará
      automáticamente en ese mismo token usando Fee Abstraction (CIP-64).

  npx celo-utils fund --sepolia
      Pide tokens gratuitos de prueba al Faucet público de Celo Sepolia
      para la cuenta configurada en tu .env.

Ejemplos:
  npx celo-utils generate
  npx celo-utils balances
  npx celo-utils send USDC 0xDireccion 10.5
  npx celo-utils drain 0xDestino --sepolia
  npx celo-utils fund --sepolia
`)
}

// ── Router ────────────────────────────────────────────────────────────────────
const [,, cmd, arg1, arg2, arg3] = process.argv

switch (cmd) {
  case 'help':
  case '--help':
  case '-h':
    showHelp()
    break
  case 'generate':
    generateWallet()
    break
  case 'export':
    exportWallet()
    break
  case 'balances':   
    await balances(arg1)
    break
  case 'drain':
    await drain(arg1)
    break
  case 'fund':
    await fund()
    break
  case 'send':
    if (!arg1 || !arg2 || !arg3) {
      console.log('❌  Faltan argumentos para "send".')
      console.log('Uso: npx celo-utils send <token> <to> <amount>')
      process.exit(1)
    }
    await send(arg1, arg2, arg3)
    break
  default:
    showHelp()
}
