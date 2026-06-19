#!/usr/bin/env node
/**
 * CLI para interactuar con SocialConnect / ODIS en Celo.
 * Permite resolver números de teléfono a direcciones de billeteras (ej. MiniPay).
 * Uso:
 *   npx --package celo-utils celo-socialconnect resolve <phone> [--sepolia]
 */

import { isSepolia, RPC } from '../lib/network.js'

// ── Comandos ──────────────────────────────────────────────────────────────────

export async function resolvePhone(phoneE164) {
  let newKit, OdisUtils;
  try {
    const contractKit = await import('@celo/contractkit');
    const identity = await import('@celo/identity');
    newKit = contractKit.newKit;
    OdisUtils = identity.OdisUtils;
  } catch (error) {
    console.error('❌  Las funciones de SocialConnect requieren paquetes adicionales que son pesados.');
    console.error('👉  Para usar este comando, por favor instálalos ejecutando:');
    console.error('    npm install @celo/contractkit @celo/identity');
    process.exit(1);
  }

  if (!phoneE164 || !phoneE164.startsWith('+')) {
      console.error('❌  Debes proporcionar un número en formato E.164 (ej: +12345678900)')
      process.exit(1)
    }

  const pk = process.env.PRIVATE_KEY
  if (!pk) {
    console.error('❌  No se encontró PRIVATE_KEY en .env. Se requiere para firmar la petición a ODIS.')
    process.exit(1)
  }

  console.log(`\nBuscando billetera asociada a ${phoneE164} usando SocialConnect`)

  try {
    const kit = newKit(RPC)
    kit.addAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
    const account = kit.connection.getLocalAccounts()[0]
    kit.defaultAccount = account

    // Usar el contexto de Mainnet o Alfajores (Celo usa Alfajores para testnet en ODIS, no Sepolia)
    const contextName = isSepolia ? OdisUtils.Query.OdisContextName.ALFAJORES : OdisUtils.Query.OdisContextName.MAINNET
    
    const serviceContext = OdisUtils.Query.getServiceContext(
      contextName,
      OdisUtils.Query.OdisAPI.PNP
    )

    const authSigner = {
      authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
      contractKit: kit,
    }

    // 1. Obtener identificador ofuscado desde ODIS
    const { obfuscatedIdentifier } = await OdisUtils.Identifier.getObfuscatedIdentifier(
      phoneE164,
      OdisUtils.Identifier.IdentifierPrefix.PHONE_NUMBER,
      account,
      authSigner,
      serviceContext
    )

    // 2. Buscar atestaciones en el contrato FederatedAttestations
    const federated = await kit.contracts.getFederatedAttestations()
    
    // MiniPay Issuer Address en Mainnet (como lo define la documentación de Celo)
    const MINIPAY_ISSUER = "0x7888612486844Bb9BE598668081c59A9f7367FBc"
    
    // Buscamos sin filtrar por issuer primero para ver si hay algo
    const { accounts } = await federated.lookupAttestations(obfuscatedIdentifier, [MINIPAY_ISSUER])

    if (accounts && accounts.length > 0) {
      console.log(`\n✅ ¡Teléfono encontrado!`)
      console.log(`📱 ${phoneE164} -> 💳 ${accounts[0]}`)
      if (accounts.length > 1) {
        console.log(`Otras direcciones asociadas: ${accounts.slice(1).join(', ')}`)
      }
    } else {
      console.log(`\n❌ No se encontraron billeteras de MiniPay asociadas al número ${phoneE164}.`)
      console.log(`Nota: Para buscarlo, tu cuenta (${account}) necesita tener cuota (ODIS Quota) en la red.`)
    }

  } catch (error) {
    console.error('\n❌ Error al resolver el teléfono:')
    if (error.message.includes('out of quota')) {
      console.error('Tu cuenta no tiene cuota ODIS suficiente. Necesitas interactuar con la red o pagar la cuota.')
    } else {
      console.error(error.message)
    }
  }
}

function showHelp() {
  console.log(`
CLI de SocialConnect / ODIS (${isSepolia ? 'Sepolia Testnet' : 'Mainnet'})

Para usar Sepolia Testnet, añade el flag --sepolia al final de tu comando,
o define NETWORK=sepolia en tu archivo .env.

Uso:
  npx celo-utils socialconnect resolve <phone> [--sepolia]
      Busca la dirección de Celo asociada a un número de teléfono (E.164)
      utilizando ODIS / SocialConnect (ej. MiniPay).

Ejemplos:
  npx celo-utils socialconnect resolve +12345678900
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
      showHelp()
      break
    case 'resolve':
      await resolvePhone(arg1)
      break
    default:
      showHelp()
  }
}
