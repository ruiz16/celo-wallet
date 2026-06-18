# @zirus16/celo-utils

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
npx @zirus16/celo-utils --help
```

## Uso

### Wallet

```bash
npx @zirus16/celo-utils generate
npx @zirus16/celo-utils export
npx @zirus16/celo-utils balances
npx @zirus16/celo-utils balances 0xDireccion
npx @zirus16/celo-utils send USDC 0xDireccion 10.5
npx @zirus16/celo-utils drain 0xDestino --sepolia
npx @zirus16/celo-utils fund --sepolia
```

### Contratos

```bash
npx --package @zirus16/celo-utils celo-contract info 0xContrato
npx --package @zirus16/celo-utils celo-contract info 0xContrato --sepolia
```

### SocialConnect

```bash
npx --package @zirus16/celo-utils celo-socialconnect resolve +573108458405
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
