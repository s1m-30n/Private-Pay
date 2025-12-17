/**
 * Starknet Integration Library for PrivatePay
 *
 * Provides stealth address generation, wallet integration, and
 * cross-chain bridge functionality between Zcash and Starknet.
 */

// Re-export constants
export * from './constants.js';

// Re-export client utilities
export * from './client.js';

// Re-export stealth address functions
export * from './stealthAddress.js';

// Re-export bridge classes and functions
export * from './bridge.js';

// Re-export relay orchestrator
export * from './relay.js';

// Main integration object
export const StarknetIntegration = {
  name: 'Starknet',
  symbol: 'STRK',
  bridgeToken: 'sZEC',
  network: {
    mainnet: {
      chainId: '0x534e5f4d41494e',
      rpc: 'https://starknet-mainnet.public.blastapi.io',
      explorer: 'https://starkscan.co',
    },
    testnet: {
      chainId: '0x534e5f5345504f4c4941',
      rpc: 'https://starknet-sepolia.public.blastapi.io',
      explorer: 'https://sepolia.starkscan.co',
    },
  },
  wallets: {
    argentX: {
      name: 'ArgentX',
      downloadUrl: 'https://www.argent.xyz/argent-x/',
      icon: 'https://www.argent.xyz/icons/argent-x.svg',
    },
    braavos: {
      name: 'Braavos',
      downloadUrl: 'https://braavos.app/',
      icon: 'https://braavos.app/favicon.ico',
    },
  },
  features: [
    'Stealth Addresses',
    'Private Payments',
    'Zcash Bridge',
    'Cross-chain Privacy',
  ],
};
