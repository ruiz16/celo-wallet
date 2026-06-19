import { isSepolia } from '../lib/network.js'
import { TOKENS_MAINNET, TOKENS_SEPOLIA } from '../lib/tokens.js'

export function networkInfo() {
  const showAll = process.argv.includes('--all');

  console.log(`\n🎓 GUÍA DE REDES Y CONTRATOS DE CELO 🎓

Nota: En billeteras modernas (como MetaMask o Rabby), la red Mainnet de Celo
suele venir preconfigurada. Sin embargo, la red de pruebas (Sepolia) y 
los contratos de las Stablecoins en Testnet casi siempre deben añadirse manualmente.

==============================================================
🌐 1. DATOS DE RED (CUSTOM NETWORKS)
==============================================================`);

  if (showAll || !isSepolia) {
    console.log(`🔹 CELO MAINNET (Red Principal) - ¡Suele venir por defecto!
   Nombre de la red:       Celo Mainnet
   Nueva dirección RPC:    https://forno.celo.org
   ID de cadena:           42220
   Símbolo de moneda:      CELO
   URL del explorador:     https://celoscan.io
`);
  }

  if (showAll || isSepolia) {
    console.log(`🔹 CELO SEPOLIA (Red de Pruebas) - ¡Requiere configuración manual!
   Nombre de la red:       Celo Sepolia
   Nueva dirección RPC:    https://forno.celo-sepolia.celo-testnet.org
   ID de cadena:           44787
   Símbolo de moneda:      CELO
   URL del explorador:     https://celo-sepolia.blockscout.com
`);
  }

  console.log(`==============================================================
🪙 2. CONTRATOS DE STABLECOINS (IMPORTAR TOKENS)
==============================================================`);

  if (showAll || !isSepolia) {
    console.log(`🔹 CONTRATOS EN MAINNET (Si no te aparecen automáticamente):`);
    for (const [symbol, data] of Object.entries(TOKENS_MAINNET)) {
      if (data.isNative) continue;
      console.log(`   - ${symbol.padEnd(5)} : ${data.address}`);
    }
    console.log('');
  }

  if (showAll || isSepolia) {
    console.log(`🔹 CONTRATOS EN SEPOLIA (Testnet) - ¡Debes importarlos manualmente!`);
    for (const [symbol, data] of Object.entries(TOKENS_SEPOLIA)) {
      if (data.isNative) continue;
      console.log(`   - ${symbol.padEnd(5)} : ${data.address}`);
    }
    console.log('');
  }

  console.log(`✨ TIP: En Celo puedes usar estas Stablecoins para pagar comisiones de gas (Fee Abstraction).`);
}
