/**
 * Starknet Client Setup
 * Provides Starknet.js client configuration and utilities
 */

import { RpcProvider, Account, Contract, constants } from 'starknet';
import { STARKNET_CONFIG, getRpcUrl } from './constants.js';

/**
 * Create a Starknet RPC provider
 * @param {string} network - 'mainnet' or 'testnet'
 * @returns {RpcProvider} Starknet provider instance
 */
export function getStarknetProvider(network = STARKNET_CONFIG.NETWORK) {
  const nodeUrl = getRpcUrl(network);
  return new RpcProvider({ nodeUrl });
}

/**
 * Create a Starknet account instance
 * @param {string} address - Account address
 * @param {string} privateKey - Account private key
 * @param {RpcProvider} provider - Starknet provider
 * @returns {Account} Starknet account instance
 */
export function getStarknetAccount(address, privateKey, provider) {
  return new Account(provider, address, privateKey);
}

/**
 * Get chain ID for network
 * @param {string} network - 'mainnet' or 'testnet'
 * @returns {string} Chain ID
 */
export function getChainId(network = STARKNET_CONFIG.NETWORK) {
  return network === 'mainnet'
    ? constants.StarknetChainId.SN_MAIN
    : constants.StarknetChainId.SN_SEPOLIA;
}

/**
 * Format Starknet address (add 0x prefix and pad to 66 chars)
 * @param {string} address - Address to format
 * @returns {string} Formatted address
 */
export function formatAddress(address) {
  if (!address) return '';
  const clean = address.replace('0x', '').toLowerCase();
  return '0x' + clean.padStart(64, '0');
}

/**
 * Truncate address for display
 * @param {string} address - Full address
 * @param {number} startChars - Characters to show at start
 * @param {number} endChars - Characters to show at end
 * @returns {string} Truncated address
 */
export function truncateAddress(address, startChars = 6, endChars = 4) {
  if (!address || address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Convert felt252 to hex string
 * @param {bigint|string} felt - Felt value
 * @returns {string} Hex string
 */
export function feltToHex(felt) {
  const bigIntValue = typeof felt === 'string' ? BigInt(felt) : felt;
  return '0x' + bigIntValue.toString(16);
}

/**
 * Convert hex string to felt252
 * @param {string} hex - Hex string
 * @returns {string} Felt value as string
 */
export function hexToFelt(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + clean).toString();
}

/**
 * Parse ETH amount from wei
 * @param {bigint|string} wei - Amount in wei
 * @returns {string} Amount in ETH
 */
export function parseEthFromWei(wei) {
  const bigIntValue = typeof wei === 'string' ? BigInt(wei) : wei;
  const eth = Number(bigIntValue) / 1e18;
  return eth.toFixed(6);
}

/**
 * Convert ETH to wei
 * @param {number|string} eth - Amount in ETH
 * @returns {bigint} Amount in wei
 */
export function ethToWei(eth) {
  const ethNum = typeof eth === 'string' ? parseFloat(eth) : eth;
  return BigInt(Math.floor(ethNum * 1e18));
}

/**
 * Wait for transaction confirmation
 * @param {RpcProvider} provider - Starknet provider
 * @param {string} txHash - Transaction hash
 * @returns {Promise<Object>} Transaction receipt
 */
export async function waitForTransaction(provider, txHash) {
  return await provider.waitForTransaction(txHash);
}

/**
 * Check if wallet extension is available
 * @param {string} walletId - 'argentX' or 'braavos'
 * @returns {Object|null} Wallet object or null
 */
export function getWalletExtension(walletId) {
  if (typeof window === 'undefined') return null;

  switch (walletId) {
    case 'argentX':
      return window.starknet_argentX || null;
    case 'braavos':
      return window.starknet_braavos || null;
    default:
      // Try to find any available starknet wallet
      return window.starknet || null;
  }
}

/**
 * Check if any Starknet wallet is available
 * @returns {Object} Available wallets
 */
export function getAvailableWallets() {
  return {
    argentX: !!getWalletExtension('argentX'),
    braavos: !!getWalletExtension('braavos'),
  };
}
