# celo-utils

CLI de utilidades para **Celo Mainnet** y **Celo Sepolia**.

Permite:

- Generar wallets
- Exportar credenciales locales
- Consultar balances
- Enviar tokens oficiales de Celo
- Vaciar una wallet de CELO
- Pedir fondos de prueba en Sepolia
- Evaluar contratos
- Resolver telefonos con SocialConnect / ODIS

## Instalacion

Sin instalar globalmente:

```bash
npx celo-utils --help
```

## Uso

### Wallet

```bash
npx celo-utils generate
npx celo-utils export
npx celo-utils balances
npx celo-utils balances 0xDireccion
npx celo-utils send USDC 0xDireccion 10.5
npx celo-utils drain 0xDestino --sepolia
npx celo-utils validate 0xDireccion
npx celo-utils network-info --all
npx celo-utils fund 0xDireccion --sepolia
npx celo-utils multisend USDC 0xDir1,0xDir2 5
npx celo-utils qr 0xDireccion
npx celo-utils history 0xDireccion --limit 5
```

### Contratos

```bash
npx celo-utils contract info 0xContrato
npx celo-utils contract info 0xContrato --sepolia
```

### SocialConnect

```bash
npx celo-utils socialconnect resolve +12345678900
```

## Redes

- `mainnet` por defecto
- `sepolia` usando `--sepolia`
- Tambien puedes definir `NETWORK=sepolia` en tu `.env`

## Variables Locales

El CLI usa un archivo `.env` local para leer:

```env
PRIVATE_KEY=0x...
ADDRESS=0x...
NETWORK=mainnet
```

La frase semilla se guarda en `seed.txt` cuando generas una wallet.

## Tokens Soportados

- `CELO`
- `USDC`
- `USDT`
- `USDm`
- `EURm`
- `BRLm`
- `COPm`

## Autor

- GitHub: [@ruiz16](https://github.com/ruiz16)
- npm author: `@zirus16`
