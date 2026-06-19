import { createPublicClient, http } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import './env.js'

export const isSepolia = process.argv.includes('--sepolia') || process.env.NETWORK === 'sepolia'
export const currentChain = isSepolia ? celoSepolia : celo
export const RPC = isSepolia ? 'https://forno.celo-sepolia.celo-testnet.org' : 'https://forno.celo.org'
export const explorerUrl = isSepolia ? 'https://celo-sepolia.blockscout.com/tx' : 'https://celoscan.io/tx'
export const BLOCKSCOUT_API = isSepolia
  ? 'https://celo-sepolia.blockscout.com/api/v2'
  : 'https://celo.blockscout.com/api/v2'

export const publicClient = createPublicClient({
  chain: currentChain,
  transport: http(RPC),
})
