#!/usr/bin/env node
/**
 * CLI para evaluar contratos inteligentes en Celo.
 * Uso:
 *   npx celo-utils contract info <address> [--sepolia]
 */

import { createPublicClient, formatEther, http } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { BLOCKSCOUT_API, isSepolia, publicClient } from '../lib/network.js'

function getNetworkContext() {
  return {
    currentName: isSepolia ? 'Sepolia Testnet' : 'Mainnet',
    otherName: isSepolia ? 'Mainnet' : 'Sepolia Testnet',
    otherFlag: isSepolia ? '' : ' --sepolia',
    otherExplorerBase: isSepolia
      ? 'https://celo.blockscout.com/address'
      : 'https://celo-sepolia.blockscout.com/address',
    otherClient: createPublicClient({
      chain: isSepolia ? celo : celoSepolia,
      transport: http(isSepolia ? 'https://forno.celo.org' : 'https://forno.celo-sepolia.celo-testnet.org'),
    }),
  }
}

// ── Comandos ──────────────────────────────────────────────────────────────────

export async function getContractInfo(address) {
  if (!address || !address.startsWith('0x')) {
    console.error('❌  Debes proporcionar una dirección válida de contrato (0x...).')
    process.exit(1)
  }

  const { currentName, otherName, otherFlag, otherExplorerBase, otherClient } = getNetworkContext()

  console.log(`\nEvaluando contrato ${address} en ${currentName}`)
  console.log('Recopilando datos\n')

  try {
    // 1. Obtener balance nativo y bytecode en la red actual
    const [balance, bytecode] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.getBytecode({ address }),
    ])
    const isContract = bytecode && bytecode !== '0x'

    if (!isContract) {
      const otherBytecode = await otherClient.getBytecode({ address })
      const existsOnOtherNetwork = otherBytecode && otherBytecode !== '0x'

      console.warn(`⚠️  No encontré un contrato desplegado en ${currentName} para esta dirección.`)

      if (existsOnOtherNetwork) {
        console.log(`✅  Sí encontré código desplegado en ${otherName}.`)
        console.log(`Parece que esta dirección corresponde a un contrato de ${otherName}, no de ${currentName}.`)
        console.log(`Prueba este comando:`)
        console.log(`   npx celo-utils contract info ${address}${otherFlag}`)
        console.log(`\nExplorador sugerido:`)
        console.log(`   ${otherExplorerBase}/${address}`)
        return
      }

      console.log(`No encontré código desplegado ni en ${currentName} ni en ${otherName}.`)
      console.log('Esta dirección no parece ser un contrato en las redes soportadas; puede ser una billetera normal o una dirección sin despliegue.')
    }

    // 3. Consultar la API de Blockscout V2 para transacciones y detalles
    // endpoint: /api/v2/addresses/{address}
    const reqAddress = await fetch(`${BLOCKSCOUT_API}/addresses/${address}`)
    const dataAddress = await reqAddress.json()
    
    // endpoint: /api/v2/addresses/{address}/transactions?filter=to
    const reqTxs = await fetch(`${BLOCKSCOUT_API}/addresses/${address}/transactions?filter=to`)
    const dataTxs = await reqTxs.json()

    // 4. Obtener balances de tokens de la cuenta/contrato
    let tokenBalances = []
    try {
      const reqTokens = await fetch(`${BLOCKSCOUT_API}/addresses/${address}/token-balances`)
      const tokensData = await reqTokens.json()
      if (Array.isArray(tokensData)) {
        tokenBalances = tokensData.filter(t => t.token && t.token.type === 'ERC-20' && t.value !== '0')
      }
    } catch (e) { /* ignorar si falla la lectura de balances */ }

    // 5. Intentar obtener información adicional (Owner, Token Info) a través de Viem
    let owner = null
    let tokenName = null
    let tokenSymbol = null
    let tokenDecimals = null

    if (isContract) {
      try {
        owner = await publicClient.readContract({
          address,
          abi: [{ name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
          functionName: 'owner'
        })
      } catch (e) { /* No tiene función owner */ }

      try {
        tokenName = await publicClient.readContract({
          address,
          abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
          functionName: 'name'
        })
        tokenSymbol = await publicClient.readContract({
          address,
          abi: [{ name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
          functionName: 'symbol'
        })
        tokenDecimals = await publicClient.readContract({
          address,
          abi: [{ name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
          functionName: 'decimals'
        })
      } catch (e) {
        // Fallback por si usan bytes32 en lugar de string (algunos tokens antiguos)
        try {
           if (!tokenName) {
             const nameBytes = await publicClient.readContract({ address, abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }], functionName: 'name' })
             tokenName = Buffer.from(nameBytes.replace('0x',''), 'hex').toString('utf8').replace(/\0/g, '')
           }
           if (!tokenSymbol) {
             const symbolBytes = await publicClient.readContract({ address, abi: [{ name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }], functionName: 'symbol' })
             tokenSymbol = Buffer.from(symbolBytes.replace('0x',''), 'hex').toString('utf8').replace(/\0/g, '')
           }
        } catch (err) { /* No es un token o no se pudo leer */ }
      }
    }

    // ── Mostrar Resultados ──────────────────────────────────────────────────
    
    console.log(`=== Detalles del Contrato ===`)
    console.log(`Dirección:       ${address}`)
    console.log(`Tipo:            ${dataAddress.is_contract ? 'Smart Contract' : 'Dirección normal (sin contrato desplegado)'}`)
    
    if (dataAddress.is_contract) {
      console.log(`Verificado:      ${dataAddress.is_verified ? '✅ Sí' : '❌ No'}`)
      if (dataAddress.name) console.log(`Nombre Contrato: ${dataAddress.name}`)
      if (dataAddress.creator_address_hash) console.log(`Creador por:     ${dataAddress.creator_address_hash}`)
      if (owner) console.log(`Propietario:     ${owner}`)
      
      // Mostrar info del token si pudimos extraerla
      const apiTokenName = dataAddress.token?.name
      const apiTokenSymbol = dataAddress.token?.symbol
      
      const finalName = tokenName || apiTokenName
      const finalSymbol = tokenSymbol || apiTokenSymbol
      
      if (finalName || finalSymbol) {
        console.log(`Token Name:      ${finalName || 'Desconocido'}`)
        console.log(`Token Symbol:    ${finalSymbol || 'Desconocido'}`)
        if (tokenDecimals !== null) console.log(`Decimales:       ${tokenDecimals}`)
      }
    }
    
    console.log(`Balance Nativo:  ${formatEther(balance)} CELO`)
    
    // Mostrar tokens si tiene
    if (tokenBalances.length > 0) {
      console.log(`Tokens ERC20:    ${tokenBalances.length} token(s) diferente(s)`)
      tokenBalances.slice(0, 5).forEach(t => {
        const bal = (Number(t.value) / (10 ** Number(t.token.decimals))).toFixed(4)
        console.log(`   - ${bal} ${t.token.symbol} (${t.token.name})`)
      })
      if (tokenBalances.length > 5) console.log(`   ... y ${tokenBalances.length - 5} más.`)
    } else {
      console.log(`Tokens ERC20:    0 token(s) diferente(s)`)
    }

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

export function showContractHelp() {
  console.log(`
CLI de Evaluación de Contratos Celo (${isSepolia ? 'Sepolia Testnet' : 'Mainnet'})

Para usar Sepolia Testnet, añade el flag --sepolia al final de tu comando,
o define NETWORK=sepolia en tu archivo .env.

Uso:
  npx celo-utils contract info <address> [--sepolia]
      Evalúa un contrato y muestra:
       - Si es realmente un contrato o una dirección normal sin contrato desplegado
       - Si no existe en la red actual, revisa también la otra red (Mainnet/Sepolia)
       - Si el código fuente está verificado
       - Balance de CELO y cantidad de tokens ERC20 que posee
       - Un resumen de sus últimas 5 transacciones entrantes

Ejemplos:
  npx celo-utils contract info 0xA3E1C4FC10C47f5C2cd413C0451f06A73fCD0b94
  npx celo-utils contract info 0xMiContrato --sepolia
`)
}

// ── Router ────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'url'

const isMain = process.argv[1] === fileURLToPath(import.meta.url)

if (isMain) {
  const [,, cmd, arg1] = process.argv

  switch (cmd) {
    case 'help':
    case '--help':
    case '-h':
      showContractHelp()
      break
    case 'info':
      await getContractInfo(arg1)
      break
    default:
      showContractHelp()
  }
}
