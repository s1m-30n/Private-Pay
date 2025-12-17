import { HeliusClient } from './index.js';

// Official SPL Memo Program ID (https://solscan.io/account/MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr)
export const SPL_MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export class HeliusBridgeMonitor {
  constructor(heliusClient, bridgeProgramId) {
    this.client = heliusClient;
    this.bridgeProgramId = bridgeProgramId;
    this.webhookId = null;
    this.eventHandlers = new Map();
    this.pendingDeposits = new Map();
    this.processedSignatures = new Set();
  }

  async initialize(webhookUrl, additionalAddresses = []) {
    const addressesToMonitor = [
      this.bridgeProgramId,
      ...additionalAddresses,
    ];

    try {
      const existingWebhooks = await this.client.listWebhooks();
      const existingWebhook = existingWebhooks.find(
        w => w.accountAddresses?.includes(this.bridgeProgramId)
      );

      if (existingWebhook) {
        this.webhookId = existingWebhook.webhookID;
        await this.client.updateWebhookAddresses(this.webhookId, addressesToMonitor);
      } else {
        const webhook = await this.client.createBridgeWebhook(
          webhookUrl,
          addressesToMonitor,
          ['TRANSFER', 'ANY']
        );
        this.webhookId = webhook.webhookID;
      }

      return this.webhookId;
    } catch (error) {
      console.error('Failed to initialize bridge monitor:', error);
      throw error;
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  off(eventType, handler) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(eventType, data) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  async processWebhookEvent(event) {
    if (!event || !event[0]) return;

    for (const tx of event) {
      if (this.processedSignatures.has(tx.signature)) {
        continue;
      }
      this.processedSignatures.add(tx.signature);

      if (this.processedSignatures.size > 10000) {
        const toDelete = Array.from(this.processedSignatures).slice(0, 5000);
        toDelete.forEach(sig => this.processedSignatures.delete(sig));
      }

      await this.classifyAndEmitEvent(tx);
    }
  }

  async classifyAndEmitEvent(tx) {
    const { type, description, nativeTransfers, tokenTransfers, instructions } = tx;

    const isBridgeDeposit = this.isBridgeDeposit(tx);
    const isBridgeWithdrawal = this.isBridgeWithdrawal(tx);
    const isBridgeClaim = this.isBridgeClaim(tx);

    if (isBridgeDeposit) {
      this.emit('deposit', {
        signature: tx.signature,
        timestamp: tx.timestamp,
        slot: tx.slot,
        amount: this.extractDepositAmount(tx),
        sender: tx.feePayer,
        memo: this.extractMemo(tx),
        raw: tx,
      });
    }

    if (isBridgeWithdrawal) {
      this.emit('withdrawal', {
        signature: tx.signature,
        timestamp: tx.timestamp,
        slot: tx.slot,
        amount: this.extractWithdrawalAmount(tx),
        recipient: this.extractWithdrawalRecipient(tx),
        zcashAddress: this.extractZcashAddress(tx),
        raw: tx,
      });
    }

    if (isBridgeClaim) {
      this.emit('claim', {
        signature: tx.signature,
        timestamp: tx.timestamp,
        slot: tx.slot,
        ticketId: this.extractTicketId(tx),
        recipient: tx.feePayer,
        raw: tx,
      });
    }

    this.emit('transaction', tx);
  }

  isBridgeDeposit(tx) {
    if (!tx.instructions) return false;
    
    return tx.instructions.some(ix => {
      const programId = ix.programId || ix.program_id;
      return programId === this.bridgeProgramId && 
             (ix.parsed?.type === 'deposit' || 
              ix.data?.includes('deposit') ||
              (ix.accounts && ix.accounts.length >= 3));
    });
  }

  isBridgeWithdrawal(tx) {
    if (!tx.instructions) return false;
    
    return tx.instructions.some(ix => {
      const programId = ix.programId || ix.program_id;
      return programId === this.bridgeProgramId && 
             (ix.parsed?.type === 'withdraw' || 
              ix.data?.includes('withdraw'));
    });
  }

  isBridgeClaim(tx) {
    if (!tx.instructions) return false;
    
    return tx.instructions.some(ix => {
      const programId = ix.programId || ix.program_id;
      return programId === this.bridgeProgramId && 
             (ix.parsed?.type === 'claim' || 
              ix.data?.includes('claim'));
    });
  }

  extractDepositAmount(tx) {
    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      return tx.nativeTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);
    }
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      return tx.tokenTransfers.reduce((sum, t) => sum + (t.tokenAmount || 0), 0);
    }
    return 0;
  }

  extractWithdrawalAmount(tx) {
    return this.extractDepositAmount(tx);
  }

  extractWithdrawalRecipient(tx) {
    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      return tx.nativeTransfers[0].toUserAccount;
    }
    return null;
  }

  extractZcashAddress(tx) {
    const memo = this.extractMemo(tx);
    if (memo && (memo.startsWith('z') || memo.startsWith('t'))) {
      return memo;
    }
    return null;
  }

  extractMemo(tx) {
    if (tx.instructions) {
      const memoIx = tx.instructions.find(ix => 
        ix.program === 'spl-memo' || ix.programId === SPL_MEMO_PROGRAM_ID
      );
      if (memoIx && memoIx.parsed) {
        return memoIx.parsed;
      }
    }
    return null;
  }

  extractTicketId(tx) {
    const memo = this.extractMemo(tx);
    if (memo) {
      try {
        const parsed = JSON.parse(memo);
        return parsed.ticketId || parsed.ticket_id;
      } catch {
        return memo;
      }
    }
    return null;
  }

  startPolling(addresses, intervalMs = 10000) {
    const lastSignatures = new Map();
    
    const poll = async () => {
      for (const address of addresses) {
        try {
          const txs = await this.client.getTransactionHistory(address, { limit: 10 });
          
          if (txs && txs.length > 0) {
            const lastSig = lastSignatures.get(address);
            const newTxs = lastSig 
              ? txs.filter(tx => tx.signature !== lastSig)
              : txs.slice(0, 1);
            
            if (newTxs.length > 0) {
              lastSignatures.set(address, newTxs[0].signature);
              await this.processWebhookEvent(newTxs);
            }
          }
        } catch (error) {
          console.error(`Polling error for ${address}:`, error);
        }
      }
    };

    const intervalId = setInterval(poll, intervalMs);
    poll();

    return () => clearInterval(intervalId);
  }

  getPendingDeposits() {
    return new Map(this.pendingDeposits);
  }

  addPendingDeposit(ticketId, depositInfo) {
    this.pendingDeposits.set(ticketId, {
      ...depositInfo,
      createdAt: Date.now(),
    });
  }

  removePendingDeposit(ticketId) {
    this.pendingDeposits.delete(ticketId);
  }

  cleanupOldDeposits(maxAgeMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [ticketId, deposit] of this.pendingDeposits) {
      if (now - deposit.createdAt > maxAgeMs) {
        this.pendingDeposits.delete(ticketId);
      }
    }
  }

  async stop() {
    if (this.webhookId) {
      try {
        await this.client.deleteWebhook(this.webhookId);
      } catch (error) {
        console.error('Failed to delete webhook:', error);
      }
    }
    this.eventHandlers.clear();
    this.pendingDeposits.clear();
  }
}

export function createBridgeMonitor(heliusClient, bridgeProgramId) {
  return new HeliusBridgeMonitor(heliusClient, bridgeProgramId);
}
