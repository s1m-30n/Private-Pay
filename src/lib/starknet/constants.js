/**
 * Starknet Configuration Constants
 * Contract addresses and network configuration for PrivatePay Starknet integration
 */

export const STARKNET_CONFIG = {
  // Network chain IDs
  CHAIN_ID_MAINNET: '0x534e5f4d41494e', // SN_MAIN
  CHAIN_ID_TESTNET: '0x534e5f5345504f4c4941', // SN_SEPOLIA

  // RPC endpoints
  TESTNET_RPC: import.meta.env.VITE_STARKNET_RPC_URL || 'https://starknet-sepolia-rpc.publicnode.com',
  MAINNET_RPC: 'https://starknet-mainnet-rpc.publicnode.com',

  // Block explorers
  TESTNET_EXPLORER: 'https://sepolia.starkscan.co',
  MAINNET_EXPLORER: 'https://starkscan.co',

  // Network selection
  NETWORK: import.meta.env.VITE_STARKNET_NETWORK || 'testnet',

  // Contract addresses (deployed on Sepolia testnet)
  STEALTH_REGISTRY: import.meta.env.VITE_STARKNET_STEALTH_CONTRACT || '',
  PAYMENT_MANAGER: import.meta.env.VITE_STARKNET_PAYMENT_MANAGER || '',
  ZCASH_BRIDGE: import.meta.env.VITE_STARKNET_BRIDGE_CONTRACT || '',
  LENDING_CONTRACT: import.meta.env.VITE_STARKNET_LENDING_CONTRACT || '',
  SWAP_CONTRACT: import.meta.env.VITE_STARKNET_SWAP_CONTRACT || '',
  GARAGA_VERIFIER: import.meta.env.VITE_STARKNET_GARAGA_VERIFIER || '',

  // Token addresses
  ETH_TOKEN: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
  STRK_TOKEN: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
  SZEC_TOKEN: import.meta.env.VITE_STARKNET_SZEC_TOKEN || '',
};

// Wallet identifiers
export const WALLET_IDS = {
  ARGENTX: 'argentX',
  BRAAVOS: 'braavos',
};

// Transaction status
export const TX_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED_ON_L2: 'ACCEPTED_ON_L2',
  ACCEPTED_ON_L1: 'ACCEPTED_ON_L1',
  REJECTED: 'REJECTED',
};

// Bridge status
export const BRIDGE_STATUS = {
  PENDING: 0,
  CONFIRMED: 1,
  CLAIMED: 2,
};

export const WITHDRAWAL_STATUS = {
  PENDING: 0,
  PROCESSED: 1,
  COMPLETED: 2,
};

/**
 * Get explorer URL for transaction
 */
export function getExplorerTxUrl(txHash, network = STARKNET_CONFIG.NETWORK) {
  const baseUrl = network === 'mainnet'
    ? STARKNET_CONFIG.MAINNET_EXPLORER
    : STARKNET_CONFIG.TESTNET_EXPLORER;
  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Get explorer URL for contract
 */
export function getExplorerContractUrl(address, network = STARKNET_CONFIG.NETWORK) {
  const baseUrl = network === 'mainnet'
    ? STARKNET_CONFIG.MAINNET_EXPLORER
    : STARKNET_CONFIG.TESTNET_EXPLORER;
  return `${baseUrl}/contract/${address}`;
}

/**
 * Get RPC URL for network
 */
export function getRpcUrl(network = STARKNET_CONFIG.NETWORK) {
  return network === 'mainnet'
    ? STARKNET_CONFIG.MAINNET_RPC
    : STARKNET_CONFIG.TESTNET_RPC;
}
