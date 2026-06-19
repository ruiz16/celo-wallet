#!/usr/bin/env node
/**
 * CLI Orchestrator para interactuar con Celo.
 */

import { readFileSync, existsSync } from 'fs'
import { getContractInfo } from './contract.js'
import { resolvePhone } from './socialconnect.js'
import { networkInfo } from './network.js'
import { history } from './explorer.js'
import { balances, send, generateWallet, exportWallet, fund, validateWallet, multisend, generateQR } from './wallet.js'
import { drain } from './advanced.js'

// ── Cargar .env manualmente (sin dependencias extra) ──────────────────────────
if (existsSync('.env')) {
  readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim()
  })
}

const isSepolia = process.argv.includes('--sepolia') || process.env.NETWORK === 'sepolia'

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
  balances [address]         Muestra los balances de CELO, USDC, USDT, USDm, EURm, BRLm y COPm.
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

📱 SOCIALCONNECT / ODIS
  socialconnect resolve <phone> Busca la dirección de Celo asociada a un número de teléfono (E.164).

💡 EJEMPLOS:
  npx celo-utils generate
  npx celo-utils balances
  npx celo-utils send USDC 0xDestino 10.5
  npx celo-utils contract info 0xA3E1C4FC10C47f5C2cd413C0451f06A73fCD0b94
  npx celo-utils socialconnect resolve +12345678900
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
    if (arg1 === 'info' && arg2) {
      await getContractInfo(arg2)
    } else {
      console.log('❌ Uso incorrecto. Prueba: npx celo-utils contract info <address>')
    }
    break
  case 'socialconnect':
    if (arg1 === 'resolve' && arg2) {
      await resolvePhone(arg2)
    } else {
      console.log('❌ Uso incorrecto. Prueba: npx celo-utils socialconnect resolve <phone>')
    }
    break
  default:
    showHelp()
}