/**
 * Zcash-Starknet Bridge Module
 *
 * Handles bi-directional private bridge between Zcash and Starknet (Ztarknet)
 * Uses ticket-based deposit/claim system for cross-chain transfers
 */

import { BRIDGE_STATUS, WITHDRAWAL_STATUS } from './constants.js';

/**
 * Bridge Deposit Request
 * Represents a deposit from Zcash to Starknet
 */
export class BridgeDeposit {
  constructor(zcashTxId, ticketId, amount, recipient) {
    this.zcashTxId = zcashTxId;
    this.ticketId = ticketId;
    this.amount = amount;
    this.recipient = recipient;
    this.status = BRIDGE_STATUS.PENDING;
    this.createdAt = Date.now();
    this.claimedAt = null;
    this.starknetTxHash = null;
  }

  toJSON() {
    return {
      zcashTxId: this.zcashTxId,
      ticketId: this.ticketId,
      amount: this.amount,
      recipient: this.recipient,
      status: this.status,
      createdAt: this.createdAt,
      claimedAt: this.claimedAt,
      starknetTxHash: this.starknetTxHash,
    };
  }

  static fromJSON(json) {
    const deposit = new BridgeDeposit(
      json.zcashTxId,
      json.ticketId,
      json.amount,
      json.recipient
    );
    deposit.status = json.status;
    deposit.createdAt = json.createdAt;
    deposit.claimedAt = json.claimedAt;
    deposit.starknetTxHash = json.starknetTxHash;
    return deposit;
  }
}

/**
 * Bridge Withdrawal Request
 * Represents a withdrawal from Starknet to Zcash
 */
export class BridgeWithdrawal {
  constructor(withdrawalId, szecAmount, zcashAddress) {
    this.withdrawalId = withdrawalId;
    this.szecAmount = szecAmount;
    this.zcashAddress = zcashAddress;
    this.status = WITHDRAWAL_STATUS.PENDING;
    this.createdAt = Date.now();
    this.processedAt = null;
    this.starknetTxHash = null;
    this.zcashTxHash = null;
  }

  toJSON() {
    return {
      withdrawalId: this.withdrawalId,
      szecAmount: this.szecAmount,
      zcashAddress: this.zcashAddress,
      status: this.status,
      createdAt: this.createdAt,
      processedAt: this.processedAt,
      starknetTxHash: this.starknetTxHash,
      zcashTxHash: this.zcashTxHash,
    };
  }

  static fromJSON(json) {
    const withdrawal = new BridgeWithdrawal(
      json.withdrawalId,
      json.szecAmount,
      json.zcashAddress
    );
    withdrawal.status = json.status;
    withdrawal.createdAt = json.createdAt;
    withdrawal.processedAt = json.processedAt;
    withdrawal.starknetTxHash = json.starknetTxHash;
    withdrawal.zcashTxHash = json.zcashTxHash;
    return withdrawal;
  }
}

/**
 * Starknet Bridge Manager
 * Manages bridge operations between Zcash and Starknet
 */
export class StarknetBridgeManager {
  constructor(starknetProvider, zcashWallet) {
    this.starknetProvider = starknetProvider;
    this.zcashWallet = zcashWallet;
    this.deposits = new Map();
    this.withdrawals = new Map();
    this.loadFromStorage();
  }

  /**
   * Load deposits and withdrawals from localStorage
   */
  loadFromStorage() {
    try {
      const depositsJson = localStorage.getItem('starknet_bridge_deposits');
      if (depositsJson) {
        const depositsArr = JSON.parse(depositsJson);
        depositsArr.forEach(d => {
          const deposit = BridgeDeposit.fromJSON(d);
          this.deposits.set(deposit.ticketId, deposit);
        });
      }

      const withdrawalsJson = localStorage.getItem('starknet_bridge_withdrawals');
      if (withdrawalsJson) {
        const withdrawalsArr = JSON.parse(withdrawalsJson);
        withdrawalsArr.forEach(w => {
          const withdrawal = BridgeWithdrawal.fromJSON(w);
          this.withdrawals.set(withdrawal.withdrawalId, withdrawal);
        });
      }
    } catch (error) {
      console.error('Failed to load bridge data from storage:', error);
    }
  }

  /**
   * Save deposits and withdrawals to localStorage
   */
  saveToStorage() {
    try {
      const depositsArr = Array.from(this.deposits.values()).map(d => d.toJSON());
      localStorage.setItem('starknet_bridge_deposits', JSON.stringify(depositsArr));

      const withdrawalsArr = Array.from(this.withdrawals.values()).map(w => w.toJSON());
      localStorage.setItem('starknet_bridge_withdrawals', JSON.stringify(withdrawalsArr));
    } catch (error) {
      console.error('Failed to save bridge data to storage:', error);
    }
  }

  /**
   * Generate unique ticket ID
   */
  generateTicketId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `starknet_ticket_${timestamp}_${random}`;
  }

  /**
   * Create deposit request (Zcash -> Starknet)
   * @param {string} zcashTxId - Zcash transaction ID
   * @param {number} amount - Amount in ZEC
   * @param {string} starknetAddress - Recipient Starknet address
   * @returns {BridgeDeposit} Deposit request
   */
  createDeposit(zcashTxId, amount, starknetAddress) {
    const ticketId = this.generateTicketId();
    const deposit = new BridgeDeposit(zcashTxId, ticketId, amount, starknetAddress);

    this.deposits.set(ticketId, deposit);
    this.saveToStorage();

    return deposit;
  }

  /**
   * Simulate deposit confirmation (for demo)
   * In production, this would be done by the bridge operator
   */
  confirmDeposit(ticketId) {
    const deposit = this.deposits.get(ticketId);
    if (!deposit) {
      throw new Error('Deposit not found');
    }

    deposit.status = BRIDGE_STATUS.CONFIRMED;
    this.saveToStorage();

    return deposit;
  }

  /**
   * Claim sZEC on Starknet
   * @param {string} ticketId - Ticket ID from deposit
   * @returns {Promise<Object>} Claim result
   */
  async claimSZEC(ticketId) {
    const deposit = this.deposits.get(ticketId);
    if (!deposit) {
      throw new Error('Deposit not found');
    }

    if (deposit.status !== BRIDGE_STATUS.CONFIRMED) {
      throw new Error('Deposit not confirmed yet');
    }

    // In production, this would call the ZcashBridge contract
    // For demo, we simulate the claim
    deposit.status = BRIDGE_STATUS.CLAIMED;
    deposit.claimedAt = Date.now();
    deposit.starknetTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;

    this.saveToStorage();

    return {
      success: true,
      txHash: deposit.starknetTxHash,
      amount: deposit.amount,
    };
  }

  /**
   * Create withdrawal request (Starknet -> Zcash)
   * @param {number} szecAmount - Amount of sZEC to burn
   * @param {string} zcashAddress - Zcash address to receive ZEC
   * @returns {Promise<BridgeWithdrawal>} Withdrawal request
   */
  async createWithdrawal(szecAmount, zcashAddress) {
    const withdrawalId = `withdrawal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const withdrawal = new BridgeWithdrawal(withdrawalId, szecAmount, zcashAddress);

    // In production, this would call the ZcashBridge contract to burn sZEC
    withdrawal.starknetTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;

    this.withdrawals.set(withdrawalId, withdrawal);
    this.saveToStorage();

    return withdrawal;
  }

  /**
   * Get deposit by ticket ID
   */
  getDeposit(ticketId) {
    return this.deposits.get(ticketId) || null;
  }

  /**
   * Get withdrawal by ID
   */
  getWithdrawal(withdrawalId) {
    return this.withdrawals.get(withdrawalId) || null;
  }

  /**
   * Get all deposits for an address
   */
  getDepositsForAddress(address) {
    return Array.from(this.deposits.values())
      .filter(d => d.recipient.toLowerCase() === address.toLowerCase());
  }

  /**
   * Get all pending deposits
   */
  getPendingDeposits() {
    return Array.from(this.deposits.values())
      .filter(d => d.status === BRIDGE_STATUS.PENDING || d.status === BRIDGE_STATUS.CONFIRMED);
  }

  /**
   * Get all pending withdrawals
   */
  getPendingWithdrawals() {
    return Array.from(this.withdrawals.values())
      .filter(w => w.status === WITHDRAWAL_STATUS.PENDING);
  }

  /**
   * Get bridge statistics
   */
  getStats() {
    const deposits = Array.from(this.deposits.values());
    const withdrawals = Array.from(this.withdrawals.values());

    return {
      totalDeposits: deposits.length,
      claimedDeposits: deposits.filter(d => d.status === BRIDGE_STATUS.CLAIMED).length,
      pendingDeposits: deposits.filter(d => d.status !== BRIDGE_STATUS.CLAIMED).length,
      totalWithdrawals: withdrawals.length,
      processedWithdrawals: withdrawals.filter(w => w.status === WITHDRAWAL_STATUS.PROCESSED).length,
      totalBridgedIn: deposits
        .filter(d => d.status === BRIDGE_STATUS.CLAIMED)
        .reduce((sum, d) => sum + d.amount, 0),
      totalBridgedOut: withdrawals
        .filter(w => w.status === WITHDRAWAL_STATUS.PROCESSED)
        .reduce((sum, w) => sum + w.szecAmount, 0),
    };
  }
}

/**
 * Create bridge manager instance
 */
export function createStarknetBridgeManager(starknetProvider, zcashWallet) {
  return new StarknetBridgeManager(starknetProvider, zcashWallet);
}
