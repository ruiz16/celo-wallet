import { readFileSync, existsSync } from 'fs'

// ── Cargar .env manualmente ───────────────────────────────────────────────────
if (existsSync('.env')) {
  readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim()
  })
}

const isSepolia = process.argv.includes('--sepolia') || process.env.NETWORK === 'sepolia'

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