import { createPublicClient, formatEther, formatUnits, http } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { BLOCKSCOUT_API, isSepolia, publicClient } from '../lib/network.js'
import { TOKENS } from '../lib/tokens.js'

const ERC20_METADATA_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
]

function getNetworkContext() {
  return {
    currentName: isSepolia ? 'Sepolia Testnet' : 'Mainnet',
    otherName: isSepolia ? 'Mainnet' : 'Sepolia Testnet',
    otherFlag: isSepolia ? '' : ' --sepolia',
    otherExplorerBase: isSepolia
      ? 'https://celo.blockscout.com/address'
      : 'https://celo-sepolia.blockscout.com/address',
    currentExplorerBase: isSepolia
      ? 'https://celo-sepolia.blockscout.com/address'
      : 'https://celo.blockscout.com/address',
    otherClient: createPublicClient({
      chain: isSepolia ? celo : celoSepolia,
      transport: http(isSepolia ? 'https://forno.celo.org' : 'https://forno.celo-sepolia.celo-testnet.org'),
    }),
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function readStringMetadata(client, address, functionName) {
  try {
    return await client.readContract({
      address,
      abi: [{ name: functionName, type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
      functionName,
    })
  } catch {
    try {
      const value = await client.readContract({
        address,
        abi: [{ name: functionName, type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }],
        functionName,
      })
      return Buffer.from(value.replace('0x', ''), 'hex').toString('utf8').replace(/\0/g, '')
    } catch {
      return null
    }
  }
}

async function readTokenMetadata(address) {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    readStringMetadata(publicClient, address, 'name'),
    readStringMetadata(publicClient, address, 'symbol'),
    publicClient.readContract({ address, abi: ERC20_METADATA_ABI, functionName: 'decimals' }).catch(() => null),
    publicClient.readContract({ address, abi: ERC20_METADATA_ABI, functionName: 'totalSupply' }).catch(() => null),
  ])

  return { name, symbol, decimals, totalSupply }
}

function findKnownTokenByAddress(address) {
  const normalized = address.toLowerCase()

  for (const [symbol, token] of Object.entries(TOKENS)) {
    if (!token.isNative && token.address.toLowerCase() === normalized) {
      return { symbol, ...token }
    }
  }

  return null
}

function formatTokenValue(value, decimals) {
  if (value === null || decimals === null) return 'No disponible'
  return formatUnits(value, decimals)
}

export async function accountInfo(address) {
  if (!address || !address.startsWith('0x')) {
    console.error('❌  Debes proporcionar una dirección válida (0x...).')
    process.exit(1)
  }

  const { currentName, otherName, otherFlag, otherExplorerBase, currentExplorerBase, otherClient } = getNetworkContext()

  console.log(`\nAnalizando cuenta ${address} en ${currentName}`)
  console.log('Recopilando datos\n')

  try {
    const [balance, txCount, bytecode, otherBytecode, addressData, tokenData] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.getTransactionCount({ address }),
      publicClient.getBytecode({ address }),
      otherClient.getBytecode({ address }),
      fetchJson(`${BLOCKSCOUT_API}/addresses/${address}`),
      fetchJson(`${BLOCKSCOUT_API}/addresses/${address}/token-balances`),
    ])

    const hasContractCode = Boolean(bytecode && bytecode !== '0x')
    const hasOtherNetworkCode = Boolean(otherBytecode && otherBytecode !== '0x')
    const tokenBalances = Array.isArray(tokenData)
      ? tokenData.filter(token => token.token && token.token.type === 'ERC-20' && token.value !== '0')
      : []

    console.log('=== Información de la Cuenta ===')
    console.log(`Dirección:           ${address}`)
    console.log(`Red evaluada:        ${currentName}`)
    console.log(`Tipo detectado:      ${hasContractCode ? 'Smart Contract' : 'Billetera o dirección normal'}`)
    console.log(`Balance nativo:      ${formatEther(balance)} CELO`)
    console.log(`Transacciones enviadas: ${txCount}`)

    if (addressData?.transaction_count !== undefined) {
      console.log(`Actividad total en explorador: ${addressData.transaction_count}`)
    }

    if (hasContractCode) {
      console.log('\n💡 Esta dirección tiene código desplegado en esta red.')
      console.log(`   Para ver más detalle usa: npx celo-utils contract info ${address}${isSepolia ? ' --sepolia' : ''}`)
    } else if (hasOtherNetworkCode) {
      console.log(`\n⚠️  En ${currentName} esta dirección no tiene contrato desplegado.`)
      console.log(`✅  Pero sí encontré código desplegado en ${otherName}.`)
      console.log(`   Prueba este comando: npx celo-utils contract info ${address}${otherFlag}`)
      console.log(`   Explorador sugerido: ${otherExplorerBase}/${address}`)
    } else {
      console.log('\n✅ En esta red se comporta como una dirección normal, no como un contrato.')
    }

    if (tokenBalances.length > 0) {
      console.log(`\n=== Tokens ERC20 Detectados (${tokenBalances.length}) ===`)
      tokenBalances.slice(0, 5).forEach(token => {
        const decimals = Number(token.token.decimals)
        const balanceValue = (Number(token.value) / (10 ** decimals)).toFixed(4)
        console.log(`- ${balanceValue} ${token.token.symbol} (${token.token.name})`)
      })
      if (tokenBalances.length > 5) {
        console.log(`- ... y ${tokenBalances.length - 5} más`)
      }
    } else {
      console.log('\nTokens ERC20 detectados: ninguno')
    }

    console.log('\n🔗 Ver en explorador:')
    console.log(`   Blockscout: ${currentExplorerBase}/${address}`)
    if (!isSepolia) {
      console.log(`   Celoscan:   https://celoscan.io/address/${address}`)
    }
  } catch (error) {
    console.error(`❌  Error al analizar la cuenta: ${error.message}`)
  }
}

export async function tokenInfo(input) {
  if (!input) {
    console.error('❌  Debes indicar un símbolo conocido o una dirección de token (0x...).')
    process.exit(1)
  }

  const { currentName, otherName, otherFlag, otherExplorerBase, currentExplorerBase, otherClient } = getNetworkContext()
  const normalizedInput = input.toUpperCase()
  const knownToken = TOKENS[normalizedInput]

  if (knownToken?.isNative) {
    console.log(`\n=== Información del Token ===`)
    console.log(`Red:               ${currentName}`)
    console.log('Tipo:              Activo nativo de la red')
    console.log('Nombre:            Celo')
    console.log('Símbolo:           CELO')
    console.log('Decimales:         18')
    console.log('Fee abstraction:   No aplica')
    return
  }

  let address = knownToken?.address
  let knownSymbol = knownToken ? normalizedInput : null

  if (!address) {
    if (!input.startsWith('0x')) {
      console.error(`❌  Token no soportado. Usa uno de estos símbolos: ${Object.keys(TOKENS).join(', ')} o una dirección 0x...`)
      process.exit(1)
    }
    address = input
    knownSymbol = findKnownTokenByAddress(address)?.symbol ?? null
  }

  const [bytecode, otherBytecode] = await Promise.all([
    publicClient.getBytecode({ address }).catch(() => null),
    otherClient.getBytecode({ address }).catch(() => null),
  ])

  const existsOnCurrentNetwork = Boolean(bytecode && bytecode !== '0x')
  const existsOnOtherNetwork = Boolean(otherBytecode && otherBytecode !== '0x')

  if (!existsOnCurrentNetwork) {
    console.log(`\n⚠️  No encontré un token desplegado en ${currentName} para ${address}.`)
    if (existsOnOtherNetwork) {
      console.log(`✅  Sí encontré código desplegado en ${otherName}.`)
      console.log(`   Prueba este comando: npx celo-utils token info ${address}${otherFlag}`)
      console.log(`   Explorador sugerido: ${otherExplorerBase}/${address}`)
    } else {
      console.log('No parece existir un contrato de token en ninguna de las dos redes soportadas.')
    }
    return
  }

  const metadata = await readTokenMetadata(address)
  const tokenAddressData = await fetchJson(`${BLOCKSCOUT_API}/addresses/${address}`)
  const detectedKnownToken = knownSymbol ? TOKENS[knownSymbol] : findKnownTokenByAddress(address)
  const displaySymbol = knownSymbol || metadata.symbol || tokenAddressData?.token?.symbol || 'Desconocido'
  const displayName = metadata.name || tokenAddressData?.token?.name || 'Desconocido'

  console.log(`\n=== Información del Token ===`)
  console.log(`Red:               ${currentName}`)
  console.log('Tipo:              ERC20')
  console.log(`Nombre:            ${displayName}`)
  console.log(`Símbolo:           ${displaySymbol}`)
  console.log(`Dirección:         ${address}`)
  console.log(`Decimales:         ${metadata.decimals ?? 'No disponible'}`)
  console.log(`Token conocido:    ${detectedKnownToken ? 'Sí' : 'No'}`)
  console.log(`Fee abstraction:   ${detectedKnownToken?.adapter ? 'Sí' : 'No'}`)

  if (metadata.totalSupply !== null && metadata.decimals !== null) {
    console.log(`Supply total:      ${formatTokenValue(metadata.totalSupply, metadata.decimals)}`)
  }

  console.log('\n🔗 Ver en explorador:')
  console.log(`   Blockscout: ${currentExplorerBase}/${address}`)
  if (!isSepolia) {
    console.log(`   Celoscan:   https://celoscan.io/address/${address}`)
  }
}

export function showAccountHelp() {
  console.log(`
CLI de Inspección de Cuentas (${isSepolia ? 'Sepolia Testnet' : 'Mainnet'})

Uso:
  npx celo-utils account info <address> [--sepolia]
      Analiza una dirección y muestra:
       - Si es billetera normal o smart contract
       - Balance nativo y actividad básica
       - Tokens ERC20 detectados
       - Si el contrato realmente está en la otra red

Ejemplos:
  npx celo-utils account info 0xTuDireccion
  npx celo-utils account info 0xTuDireccion --sepolia
`)
}

export function showTokenHelp() {
  console.log(`
CLI de Inspección de Tokens (${isSepolia ? 'Sepolia Testnet' : 'Mainnet'})

Uso:
  npx celo-utils token info <symbol|address> [--sepolia]
      Muestra:
       - Nombre, símbolo y decimales
       - Dirección del token
       - Si es un token conocido por el CLI
       - Si soporta fee abstraction
       - Si realmente existe en esta red o en la otra

Ejemplos:
  npx celo-utils token info USDC
  npx celo-utils token info 0xToken
  npx celo-utils token info 0xToken --sepolia
`)
}
