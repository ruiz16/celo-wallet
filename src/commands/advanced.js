import { formatEther, formatUnits, encodeFunctionData } from 'viem'
import * as readline from 'readline'
import { getWalletClient, publicClient, explorerUrl, resolveToken } from './wallet.js'

// Definimos aquí la interfaz mínima de ERC20 que usamos para balance y transfer
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] }
]

export async function drain(to, tokenInput) {
  if (!to || !tokenInput) {
    console.error('❌  Faltan argumentos para vaciar la cuenta.')
    console.log('Uso: npx celo-utils drain <to> <token>')
    process.exit(1)
  }

  const token = await resolveToken(tokenInput)
  const { client, account } = getWalletClient()
  
  let sendAmount
  let displayBalance
  let gasCost = 0n
  let displayGasCost = '0'
  const gasPrice = await publicClient.getGasPrice()

  if (token.isNative) {
    const balance = await publicClient.getBalance({ address: account.address })
    const gasLimit = 21000n
    gasCost = gasLimit * gasPrice
    
    if (balance <= gasCost) {
      console.error(`❌  Balance insuficiente (${formatEther(balance)} CELO) para cubrir el costo de gas estimado (${formatEther(gasCost)} CELO).`)
      process.exit(1)
    }
    
    sendAmount = balance - gasCost
    displayBalance = formatEther(balance)
    displayGasCost = formatEther(gasCost) + ' CELO'
  } else {
    // Es un token ERC20
    const balance = await publicClient.readContract({ 
      address: token.address, 
      abi: ERC20_ABI, 
      functionName: 'balanceOf', 
      args: [account.address] 
    })

    if (balance === 0n) {
      console.error(`❌  No tienes balance de ${token.symbol} en esta cuenta.`)
      process.exit(1)
    }

    sendAmount = balance
    displayBalance = formatUnits(balance, token.decimals)
    
    // Para ERC20, el gas lo pagamos en CELO (o feeCurrency). 
    // Para simplificar, mostramos que se requiere gas y enviamos todo el balance del ERC20.
    displayGasCost = `Se pagará en ${token.adapter ? token.symbol : 'CELO'} al firmar`
  }

  console.log(`\n⚠️  ATENCIÓN: Estás a punto de VACIAR tus fondos de ${token.symbol} en la cuenta ${account.address} ⚠️`)
  console.log(`Esto enviará TODO tu balance disponible de ${token.symbol} a la dirección destino.`)
  console.log(`Balance actual:    ${displayBalance} ${token.symbol}`)
  console.log(`Costo de gas:      ${displayGasCost}`)
  console.log(`Cantidad a enviar: ${token.isNative ? formatEther(sendAmount) : formatUnits(sendAmount, token.decimals)} ${token.symbol} -> ${to}\n`)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  const answer = await question(`¿Estás seguro de que deseas continuar? (escribe "si" para confirmar): `);
  rl.close();

  if (answer.trim().toLowerCase() !== 'si') {
    console.log(`\n🛑 Operación cancelada. Tus fondos están a salvo.`);
    process.exit(0);
  }

  console.log(`\n⏳ Ejecutando vaciado...`);
  
  let hash
  if (token.isNative) {
    hash = await client.sendTransaction({
      account,
      to,
      value: sendAmount,
      gas: 21000n,
      gasPrice: gasPrice
    })
  } else {
    const txObj = {
      account,
      to: token.address,
      data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [to, sendAmount] })
    }
    if (token.adapter) txObj.feeCurrency = token.adapter

    hash = await client.sendTransaction(txObj)
  }
  
  console.log(`✓ TX enviada: ${explorerUrl}/${hash}`)
}