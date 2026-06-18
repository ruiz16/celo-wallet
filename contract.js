#!/usr/bin/env node
/**
 * CLI para evaluar contratos inteligentes en Celo.
 * Uso:
 *   npx -p celo-wallet celo-contract info <address> [--sepolia]
 */

import { createPublicClient, http, formatEther } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { readFileSync, existsSync } from 'fs'

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

// API de Blockscout para consultar información del contrato (no requiere API Key)
const BLOCKSCOUT_API = isSepolia 
  ? 'https://celo-sepolia.blockscout.com/api/v2'
  : 'https://celo.blockscout.com/api/v2'

const publicClient = createPublicClient({ chain: currentChain, transport: http(RPC) })

// ── Comandos ──────────────────────────────────────────────────────────────────

async function getContractInfo(address) {
  if (!address || !address.startsWith('0x')) {
    console.error('❌  Debes proporcionar una dirección válida de contrato (0x...).')
    process.exit(1)
  }

  console.log(`\nEvaluando contrato ${address} en ${isSepolia ? 'Sepolia Testnet' : 'Mainnet'}...`)
  console.log('Recopilando datos...\n')

  try {
    // 1. Obtener balance nativo desde el nodo (viem)
    const balance = await publicClient.getBalance({ address })
    
    // 2. Comprobar si realmente es un contrato (tiene bytecode)
    const bytecode = await publicClient.getBytecode({ address })
    const isContract = bytecode && bytecode !== '0x'

    if (!isContract) {
      console.warn(`⚠️  Advertencia: La dirección no tiene código desplegado (podría ser una EOA o no estar desplegada aún).`)
    }

    // 3. Consultar la API de Blockscout V2 para transacciones y detalles
    // endpoint: /api/v2/addresses/{address}
    const reqAddress = await fetch(`${BLOCKSCOUT_API}/addresses/${address}`)
    const dataAddress = await reqAddress.json()
    
    // endpoint: /api/v2/addresses/{address}/transactions?filter=to
    const reqTxs = await fetch(`${BLOCKSCOUT_API}/addresses/${address}/transactions?filter=to`)
    const dataTxs = await reqTxs.json()

    // ── Mostrar Resultados ──────────────────────────────────────────────────
    
    console.log(`=== Detalles del Contrato ===`)
    console.log(`Dirección:       ${address}`)
    console.log(`Tipo:            ${dataAddress.is_contract ? 'Smart Contract' : 'Cuenta Externa (EOA)'}`)
    if (dataAddress.is_contract) {
      console.log(`Verificado:      ${dataAddress.is_verified ? '✅ Sí' : '❌ No'}`)
      if (dataAddress.name) console.log(`Nombre:          ${dataAddress.name}`)
    }
    console.log(`Balance Nativo:  ${formatEther(balance)} CELO`)
    
    // Mostrar tokens si tiene
    const tokensCount = dataAddress.token_balances_count || 0
    console.log(`Tokens ERC20:    ${tokensCount} token(s) diferente(s)`)

    console.log(`\n=== Actividad Reciente ===`)
    if (dataAddress.transaction_count) {
      console.log(`Transacciones totales: ${dataAddress.transaction_count}`)
    }
    
    if (dataTxs && dataTxs.items && dataTxs.items.length > 0) {
      console.log(`\nÚltimas transacciones entrantes (max 5):`)
      const recentTxs = dataTxs.items.slice(0, 5)
      
      recentTxs.forEach((tx, i) => {
        const date = new Date(tx.timestamp).toLocaleString()
        const isError = tx.status !== 'ok'
        const method = tx.method ? tx.method : (tx.value !== '0' ? 'Transferencia Nativa' : 'Desconocido')
        const symbol = isError ? '❌' : '✅'
        
        console.log(`  ${i + 1}. [${date}] ${symbol} Metodo: ${method}`)
        console.log(`     De: ${tx.from.hash} | Tx: ${tx.hash}`)
      })
    } else {
      console.log(`No hay transacciones recientes.`)
    }
    
    console.log(`\n🔗 Ver en explorador:`)
    console.log(`   Blockscout: https://${isSepolia ? 'celo-sepolia.blockscout.com' : 'celo.blockscout.com'}/address/${address}`)
    if (!isSepolia) {
      console.log(`   Celoscan:   https://celoscan.io/address/${address}`)
    }

  } catch (error) {
    console.error('❌  Error al evaluar el contrato:', error.message)
  }
}

function showHelp() {
  console.log(`
CLI de Evaluación de Contratos Celo (${isSepolia ? 'Sepolia Testnet' : 'Mainnet'})

Para usar Sepolia Testnet, añade el flag --sepolia al final de tu comando,
o define NETWORK=sepolia en tu archivo .env.

Uso:
  npx -p celo-wallet celo-contract info <address> [--sepolia]
      Evalúa un contrato y muestra:
       - Si es realmente un contrato o una cuenta normal (EOA)
       - Si el código fuente está verificado
       - Balance de CELO y cantidad de tokens ERC20 que posee
       - Un resumen de sus últimas 5 transacciones entrantes

Ejemplos:
  npx -p celo-wallet celo-contract info 0xA3E1C4FC10C47f5C2cd413C0451f06A73fCD0b94
  npx -p celo-wallet celo-contract info 0xMiContrato --sepolia
`)
}

// ── Router ────────────────────────────────────────────────────────────────────
const [,, cmd, arg1] = process.argv

switch (cmd) {
  case 'help':
  case '--help':
  case '-h':
    showHelp()
    break
  case 'info':
    await getContractInfo(arg1)
    break
  default:
    showHelp()
}
