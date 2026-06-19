import { formatEther } from 'viem'
import { BLOCKSCOUT_API, isSepolia } from '../lib/network.js'

export async function history(address) {
  const target = address ?? process.env.ADDRESS
  if (!target || !target.startsWith('0x')) {
    console.error('❌  Debes proporcionar una dirección válida (0x...) o tener ADDRESS en tu .env.')
    process.exit(1)
  }

  // Parsear el flag --limit si existe, o usar 10 por defecto
  let limit = 10;
  const limitIndex = process.argv.findIndex(arg => arg === '--limit' || arg === '--limite');
  if (limitIndex !== -1 && process.argv[limitIndex + 1]) {
    limit = parseInt(process.argv[limitIndex + 1], 10);
  }

  const numLimit = limit;
  if (isNaN(numLimit) || numLimit <= 0) {
    console.error('❌  El límite debe ser un número mayor a 0.')
    process.exit(1)
  }

  console.log(`\nBuscando las últimas ${numLimit} transacciones de ${target} en ${isSepolia ? 'Sepolia Testnet' : 'Mainnet'}`)

  try {
    const reqTxs = await fetch(`${BLOCKSCOUT_API}/addresses/${target}/transactions`)
    const dataTxs = await reqTxs.json()

    if (dataTxs && dataTxs.items && dataTxs.items.length > 0) {
      console.log(`\n=== Historial de Transacciones ===`)
      const recentTxs = dataTxs.items.slice(0, numLimit)
      
      recentTxs.forEach((tx, i) => {
        const date = new Date(tx.timestamp).toLocaleString()
        const isError = tx.status !== 'ok'
        const symbol = isError ? '❌' : '✅'
        
        // Determinar tipo de transacción de forma simplificada
        let type = 'Llamada a Contrato'
        if (tx.method) {
            type = `Método: ${tx.method}`
        } else if (tx.value !== '0') {
            type = 'Transferencia Nativa (CELO)'
        }

        const isOutgoing = tx.from.hash.toLowerCase() === target.toLowerCase()
        const direction = isOutgoing ? '📤 Enviado a' : '📥 Recibido de'
        const otherParty = isOutgoing ? tx.to?.hash : tx.from?.hash

        console.log(`\n${i + 1}. [${date}] ${symbol} ${type}`)
        console.log(`   ${direction}: ${otherParty || 'Creación de Contrato'}`)
        if (tx.value !== '0') {
           console.log(`   Valor: ${formatEther(BigInt(tx.value))} CELO`)
        }
        console.log(`   Tx Hash: ${tx.hash}`)
      })
      console.log(`==================================\n`)
    } else {
      console.log(`\nNo hay transacciones recientes para esta dirección.`)
    }
  } catch (error) {
    console.error('\n❌ Error al obtener el historial de transacciones:', error.message)
  }
}
