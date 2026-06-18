# celo-wallet

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
npx celo-wallet --help
```

## Uso

### Wallet

```bash
npx celo-wallet generate
npx celo-wallet export
npx celo-wallet balances
npx celo-wallet balances 0xDireccion
npx celo-wallet send USDC 0xDireccion 10.5
npx celo-wallet drain 0xDestino --sepolia
npx celo-wallet fund --sepolia
```

### Contratos

```bash
npx -p celo-wallet celo-contract info 0xContrato
npx -p celo-wallet celo-contract info 0xContrato --sepolia
```

### SocialConnect

```bash
npx -p celo-wallet celo-socialconnect resolve +573108458405
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
