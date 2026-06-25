#!/usr/bin/env node
/**
 * CLI Orchestrator para interactuar con Celo.
 */

import { getContractInfo, showContractHelp } from './commands/contract.js'
import { resolvePhone, showSocialConnectHelp } from './commands/socialconnect.js'
import { networkInfo } from './commands/network.js'
import { history } from './commands/explorer.js'
import { balances, send, generateWallet, exportWallet, fund, validateWallet, multisend, generateQR } from './commands/wallet.js'
import { drain } from './commands/advanced.js'
import { accountInfo, showAccountHelp, showTokenHelp, tokenInfo } from './commands/inspect.js'
import './lib/env.js'
import { isSepolia } from './lib/network.js'

function isHelpFlag(value) {
  return value === 'help' || value === '--help' || value === '-h'
}

function getFlagValue(flagName) {
  const args = process.argv.slice(3)
  const index = args.findIndex(arg => arg === flagName)
  if (index === -1) return null
  return args[index + 1] ?? null
}

function showHelp() {
  console.log(`
🌟 CLI de Utilidades de Celo (${isSepolia ? 'Sepolia Testnet' : 'Mainnet'}) 🌟

Para usar Sepolia Testnet, añade el flag --sepolia al final de tu comando,
o define NETWORK=sepolia en tu archivo .env.

📌 USO BÁSICO:
  npx celo-utils <comando> [argumentos] [--sepolia]

⚙️  VARIABLES DE ENTORNO (.env)
  (Puedes copiar el archivo .env.example a .env para empezar fácilmente)
  PRIVATE_KEY                Llave privada para firmar transacciones.
  ADDRESS                    Dirección pública de tu billetera.
  NETWORK                    (Opcional) Define la red, ej: "sepolia". Por defecto es "mainnet".

🔑 CUENTAS Y SEGURIDAD
  generate                   Genera una nueva cuenta. Guarda credenciales en .env y seed.txt.
  export                     Muestra la Seed Phrase y la Private Key guardadas localmente.

💰 BALANCES Y TRANSFERENCIAS
  balances [address]         Muestra los balances de CELO, USDC, USDT, USDm, EURm, BRLm y COPM.
  balances [address] --token <token> Consulta solo un token específico (símbolo o 0x...).
  send <to> <amount> <token> Envía tokens (usa el símbolo ej. USDC o la dirección 0x...).
  multisend <addresses> <amount> <token> Envía la misma cantidad a múltiples direcciones.
  validate <address>         Verifica si una billetera está activa en Celo (tiene balance o transacciones).
  fund [address]             Pide tokens de prueba al Faucet de Celo (Solo Sepolia). Si no pasas address, usa el de .env.
  qr [address]               Genera un código QR de la dirección en la terminal para escanear fácilmente.

⚠️  HERRAMIENTAS AVANZADAS
  drain <to> <token>         Vacía TODO tu saldo del <token> especificado a la dirección <to>.

📚 RECURSOS Y GUÍAS
  network-info               Muestra información de redes y contratos de Stablecoins. Usa --all para ver ambas redes.
  history [address] [--limit N] Muestra el historial de transacciones (por defecto 10).

📜 CONTRATOS INTELIGENTES
  contract info <address>    Evalúa un contrato, verifica su código, balance y muestra sus últimas transacciones.
  contract --help            Muestra ayuda detallada del módulo de contratos.
  token info <token>         Muestra metadatos y red real de un token ERC20 o símbolo conocido.
  account info <address>     Analiza una dirección y distingue billetera normal vs smart contract.

📱 SOCIALCONNECT / ODIS
  socialconnect resolve <phone> Busca la dirección de Celo asociada a un número de teléfono (E.164).
  socialconnect --help       Muestra ayuda detallada de SocialConnect.

💡 EJEMPLOS:
  npx celo-utils generate
  npx celo-utils balances
  npx celo-utils send 0xDestino 10.5 USDC
  npx celo-utils contract info 0xA3E1C4FC10C47f5C2cd413C0451f06A73fCD0b94
  npx celo-utils socialconnect resolve +12345678900
`)
}

// ── Router ────────────────────────────────────────────────────────────────────
const [,, cmd, arg1, arg2, arg3] = process.argv

switch (cmd) {
  case 'help':
    if (arg1 === 'contract') {
      showContractHelp()
    } else if (arg1 === 'socialconnect') {
      showSocialConnectHelp()
    } else if (arg1 === 'account') {
      showAccountHelp()
    } else if (arg1 === 'token') {
      showTokenHelp()
    } else {
      showHelp()
    }
    break
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
    await balances(arg1 && !arg1.startsWith('--') ? arg1 : process.env.ADDRESS, getFlagValue('--token'))
    break
  case 'drain':
    if (!arg1 || !arg2) {
      console.log('❌  Faltan argumentos para "drain".')
      console.log('Uso: npx celo-utils drain <to> <token>')
      process.exit(1)
    }
    await drain(arg1, arg2)
    break
  case 'validate':
    if (!arg1) {
      console.log('❌ Uso incorrecto. Prueba: npx celo-utils validate <address>');
      process.exit(1);
    }
    await validateWallet(arg1);
    break;
  case 'fund':
    const fundTarget = arg1 || process.env.ADDRESS;
    await fund(fundTarget);
    break
  case 'network-info':
    networkInfo()
    break
  case 'history':
    const historyAddress = arg1 && !arg1.startsWith('--') ? arg1 : process.env.ADDRESS;
    await history(historyAddress);
    break;
  case 'multisend':
    if (!arg1 || !arg2 || !arg3) {
      console.log('❌  Faltan argumentos para "multisend".')
      console.log('Uso: npx celo-utils multisend <addresses> <amount> <token>')
      process.exit(1)
    }
    await multisend(arg1, arg2, arg3)
    break
  case 'qr':
    generateQR(arg1)
    break
  case 'send':
    if (!arg1 || !arg2 || !arg3) {
      console.log('❌  Faltan argumentos para "send".')
      console.log('Uso: npx celo-utils send <to> <amount> <token>')
      process.exit(1)
    }
    await send(arg1, arg2, arg3)
    break
  case 'contract':
    if (!arg1 || isHelpFlag(arg1) || (arg1 === 'info' && isHelpFlag(arg2))) {
      showContractHelp()
    } else if (arg1 === 'info' && arg2) {
      await getContractInfo(arg2)
    } else {
      console.log('❌ Uso incorrecto. Prueba: npx celo-utils contract info <address>')
      console.log('   También puedes usar: npx celo-utils contract --help')
      process.exit(1)
    }
    break
  case 'account':
    if (!arg1 || isHelpFlag(arg1) || (arg1 === 'info' && isHelpFlag(arg2))) {
      showAccountHelp()
    } else if (arg1 === 'info' && arg2) {
      await accountInfo(arg2)
    } else {
      console.log('❌ Uso incorrecto. Prueba: npx celo-utils account info <address>')
      console.log('   También puedes usar: npx celo-utils account --help')
      process.exit(1)
    }
    break
  case 'token':
    if (!arg1 || isHelpFlag(arg1) || (arg1 === 'info' && isHelpFlag(arg2))) {
      showTokenHelp()
    } else if (arg1 === 'info' && arg2) {
      await tokenInfo(arg2)
    } else {
      console.log('❌ Uso incorrecto. Prueba: npx celo-utils token info <symbol|address>')
      console.log('   También puedes usar: npx celo-utils token --help')
      process.exit(1)
    }
    break
  case 'socialconnect':
    if (!arg1 || isHelpFlag(arg1) || (arg1 === 'resolve' && isHelpFlag(arg2))) {
      showSocialConnectHelp()
    } else if (arg1 === 'resolve' && arg2) {
      await resolvePhone(arg2)
    } else {
      console.log('❌ Uso incorrecto. Prueba: npx celo-utils socialconnect resolve <phone>')
      console.log('   También puedes usar: npx celo-utils socialconnect --help')
      process.exit(1)
    }
    break
  default:
    showHelp()
}
