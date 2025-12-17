// relayer/index.js
import { ZcashRPC } from './zcash-client.js';
import { MidenClient } from './miden-client.js';
import { verifyZkProof } from './zk-proofs.js';
import { loadState, saveState } from './storage.js';
import { EventEmitter } from 'events';

class ZcashMidenRelayer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.isRunning = false;
    this.lastProcessedBlock = 0;
    this.retryDelay = 5000; // 5 seconds
  }

  async start() {
    if (this.isRunning) {
      console.log('Relayer is already running');
      return;
    }

    console.log('Starting Zcash → Miden relayer...');
    this.isRunning = true;

    try {
      // Initialize clients (use real clients if configured)
      if (this.config.useRealClients) {
        // Dynamically import real clients to avoid pulling heavy deps during simulation
        const { ZcashRPCReal } = await import('./zcash-rpc-real.js');
        const { MidenClientReal } = await import('./miden-client-real.js');
        this.zcash = new ZcashRPCReal(this.config.zcash);
        this.miden = new MidenClientReal(this.config.miden);
      } else {
        this.zcash = new ZcashRPC(this.config.zcash);
        this.miden = new MidenClient(this.config.miden);
      }

      // Load last processed block and nullifier set from storage
      const state = await loadState();
      this.lastProcessedBlock = state.lastProcessedBlock || 0;
      this.nullifierSet = new Set(state.nullifiers || []);

      // Start processing blocks
      await this.processBlocks();
    } catch (error) {
      console.error('Failed to start relayer:', error);
      this.isRunning = false;
      this.retryStart();
    }
  }

  async stop() {
    console.log('Stopping relayer...');
    this.isRunning = false;
    clearTimeout(this.retryTimer);
  }

  async processBlocks() {
    while (this.isRunning) {
      try {
        const currentBlock = await this.zcash.getBlockCount();
        
        // Process new blocks
        for (let height = this.lastProcessedBlock + 1; height <= currentBlock; height++) {
          await this.processBlock(height);
          this.lastProcessedBlock = height;
          await this.saveLastProcessedBlock(height);
        }

        // Wait for the next block
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval || 15000));
      } catch (error) {
        console.error('Error processing blocks:', error);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  async processBlock(height) {
    console.log(`Processing block ${height}...`);
    
    try {
      const block = await this.zcash.getBlock(height, true);
      
      // Process each transaction in the block
      for (const tx of block.tx) {
        if (await this.isBridgeTransaction(tx)) {
          await this.processBridgeTransaction(tx, height);
        }
      }
      
      console.log(`Processed block ${height} with ${block.tx.length} transactions`);
    } catch (error) {
      console.error(`Error processing block ${height}:`, error);
      throw error;
    }
  }

  async processBridgeTransaction(tx, height) {
    console.log(`Processing bridge transaction: ${tx.txid}`);
    
    try {
      // Extract bridge data from the transaction
      const { commitment, nullifier, proof, amount, recipient } = 
        await this.extractBridgeData(tx);
      
      // Verify the transaction has enough confirmations
      const currentHeight = await this.zcash.getBlockCount();
      if (currentHeight - height < this.config.zcash.minConfirmations) {
        console.log(`Transaction ${tx.txid} doesn't have enough confirmations yet`);
        return;
      }
      
      // Verify the ZK proof
      if (this.nullifierSet.has(nullifier)) {
        console.warn(`Nullifier already seen for tx ${tx.txid}`);
        return;
      }

      const isValid = await verifyZkProof(commitment, nullifier, proof);
      if (!isValid) {
        console.warn(`Invalid proof for transaction ${tx.txid}`);
        return;
      }
      
      // Submit to Miden
      const result = await this.miden.submitBridgeProof({
        commitment,
        nullifier,
        proof,
        amount,
        recipient
      });
      
      console.log(`Successfully processed bridge transaction ${tx.txid}:`, result);
      // Persist nullifier to prevent double spends
      try {
        this.nullifierSet.add(nullifier);
        await saveState({ lastProcessedBlock: this.lastProcessedBlock, nullifiers: Array.from(this.nullifierSet) });
      } catch (err) {
        console.error('Failed to persist relayer state', err);
      }
      this.emit('transactionProcessed', { txid: tx.txid, result });
    } catch (error) {
      console.error(`Error processing transaction ${tx.txid}:`, error);
      this.emit('error', { txid: tx.txid, error });
    }
  }

  async extractBridgeData(tx) {
    // Handle our simulated mock tx format (vout[].scriptPubKey.asm === 'OP_RETURN BRIDGE <hex>')
    try {
      for (const out of tx.vout || []) {
        const asm = out.scriptPubKey && out.scriptPubKey.asm;
        if (!asm) continue;
        const parts = asm.split(' ');
        if (parts.length >= 3 && parts[0] === 'OP_RETURN' && parts[1] === 'BRIDGE') {
          const hex = parts.slice(2).join('');
          const buf = Buffer.from(hex, 'hex');
          const decoded = buf.toString('utf8');
          // payload := commitment|nullifier|proof|amount|recipient
          const [commitment, nullifier, proof, amountStr, recipient] = decoded.split('|');
          return {
            commitment: commitment || null,
            nullifier: nullifier || null,
            proof: proof || null,
            amount: parseFloat(amountStr) || 0,
            recipient: recipient || null
          };
        }
      }
    } catch (err) {
      console.warn('Failed to parse bridge data from tx', err);
    }

    // Fallback: create pseudo-values based on txid
    return {
      commitment: '0x' + (tx.txid || '').slice(0, 64).padEnd(64, '0'),
      nullifier: '0x' + (tx.txid || '').slice(0, 64).padEnd(64, '0'),
      proof: '0x' + '00'.repeat(64),
      amount: 0,
      recipient: null
    };
  }

  // Helper methods
  async isBridgeTransaction(tx) {
    // In a real implementation, this would check if the transaction
    // interacts with the bridge contract
    return tx.vout.some(output => 
      output.scriptPubKey && 
      output.scriptPubKey.asm.includes('OP_RETURN') &&
      output.scriptPubKey.asm.includes('BRIDGE')
    );
  }

  async extractBridgeData(tx) {
    // In a real implementation, this would extract the bridge data
    // from the transaction's OP_RETURN data
    return {
      commitment: '0x' + tx.txid.slice(0, 64),
      nullifier: '0x' + tx.txid.slice(64, 128),
      proof: '0x' + '0'.repeat(128), // Placeholder for actual proof
      amount: 1000000, // 0.01 ZEC in zatoshis
      recipient: 'miden1q...' // Miden address
    };
  }

  async loadLastProcessedBlock() {
    // Deprecated: storage handled by `storage.js` at start/after processing.
    return this.lastProcessedBlock;
  }

  async saveLastProcessedBlock(height) {
    // Update in-memory and persist
    this.lastProcessedBlock = height;
    try {
      await saveState({ lastProcessedBlock: this.lastProcessedBlock, nullifiers: Array.from(this.nullifierSet || []) });
    } catch (err) {
      console.error('Failed to save last processed block', err);
    }
  }

  retryStart() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    console.log(`Retrying to start relayer in ${this.retryDelay / 1000} seconds...`);
    this.retryTimer = setTimeout(() => this.start(), this.retryDelay);
  }
}

export default ZcashMidenRelayer;
// relayer/index.js
import { ZcashRPC } from './zcash-client.js';
import { MidenClient } from './miden-client.js';
import { verifyZkProof } from './zk-proofs.js';
import { loadState, saveState } from './storage.js';
import { EventEmitter } from 'events';

class ZcashMidenRelayer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.isRunning = false;
    this.lastProcessedBlock = 0;
    this.retryDelay = 5000; // 5 seconds
  }

  async start() {
    if (this.isRunning) {
      console.log('Relayer is already running');
      return;
    }

    console.log('Starting Zcash → Miden relayer...');
    this.isRunning = true;

    try {
      // Initialize clients (use real clients if configured)
      if (this.config.useRealClients) {
        // Dynamically import real clients to avoid pulling heavy deps during simulation
        const { ZcashRPCReal } = await import('./zcash-rpc-real.js');
        const { MidenClientReal } = await import('./miden-client-real.js');
        this.zcash = new ZcashRPCReal(this.config.zcash);
        this.miden = new MidenClientReal(this.config.miden);
      } else {
        this.zcash = new ZcashRPC(this.config.zcash);
        this.miden = new MidenClient(this.config.miden);
      }

      // Load last processed block and nullifier set from storage
      const state = await loadState();
      this.lastProcessedBlock = state.lastProcessedBlock || 0;
      this.nullifierSet = new Set(state.nullifiers || []);

      // Start processing blocks
      await this.processBlocks();
    } catch (error) {
      console.error('Failed to start relayer:', error);
      this.isRunning = false;
      this.retryStart();
    }
  }

  async stop() {
    console.log('Stopping relayer...');
    this.isRunning = false;
    clearTimeout(this.retryTimer);
  }

  async processBlocks() {
    while (this.isRunning) {
      try {
        const currentBlock = await this.zcash.getBlockCount();
        
        // Process new blocks
        for (let height = this.lastProcessedBlock + 1; height <= currentBlock; height++) {
          await this.processBlock(height);
          this.lastProcessedBlock = height;
          await this.saveLastProcessedBlock(height);
        }

        // Wait for the next block
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval || 15000));
      } catch (error) {
        console.error('Error processing blocks:', error);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  async processBlock(height) {
    console.log(`Processing block ${height}...`);
    
    try {
      const block = await this.zcash.getBlock(height, true);
      
      // Process each transaction in the block
      for (const tx of block.tx) {
        if (await this.isBridgeTransaction(tx)) {
          await this.processBridgeTransaction(tx, height);
        }
      }
      
      console.log(`Processed block ${height} with ${block.tx.length} transactions`);
    } catch (error) {
      console.error(`Error processing block ${height}:`, error);
      throw error;
    }
  }

  async processBridgeTransaction(tx, height) {
    console.log(`Processing bridge transaction: ${tx.txid}`);
    
    try {
      // Extract bridge data from the transaction
      const { commitment, nullifier, proof, amount, recipient } = 
        await this.extractBridgeData(tx);
      
      // Verify the transaction has enough confirmations
      const currentHeight = await this.zcash.getBlockCount();
      if (currentHeight - height < this.config.zcash.minConfirmations) {
        console.log(`Transaction ${tx.txid} doesn't have enough confirmations yet`);
        return;
      }
      
      // Verify the ZK proof
      if (this.nullifierSet.has(nullifier)) {
        console.warn(`Nullifier already seen for tx ${tx.txid}`);
        return;
      }

      const isValid = await verifyZkProof(commitment, nullifier, proof);
      if (!isValid) {
        console.warn(`Invalid proof for transaction ${tx.txid}`);
        return;
      }
      
      // Submit to Miden
      const result = await this.miden.submitBridgeProof({
        commitment,
        nullifier,
        proof,
        amount,
        recipient
      });
      
      console.log(`Successfully processed bridge transaction ${tx.txid}:`, result);
      // Persist nullifier to prevent double spends
      try {
        this.nullifierSet.add(nullifier);
        await saveState({ lastProcessedBlock: this.lastProcessedBlock, nullifiers: Array.from(this.nullifierSet) });
      } catch (err) {
        console.error('Failed to persist relayer state', err);
      }
      this.emit('transactionProcessed', { txid: tx.txid, result });
    } catch (error) {
      console.error(`Error processing transaction ${tx.txid}:`, error);
      this.emit('error', { txid: tx.txid, error });
    }
  }

  async extractBridgeData(tx) {
    // Handle our simulated mock tx format (vout[].scriptPubKey.asm === 'OP_RETURN BRIDGE <hex>')
    try {
      for (const out of tx.vout || []) {
        const asm = out.scriptPubKey && out.scriptPubKey.asm;
        if (!asm) continue;
        const parts = asm.split(' ');
        if (parts.length >= 3 && parts[0] === 'OP_RETURN' && parts[1] === 'BRIDGE') {
          const hex = parts.slice(2).join('');
          const buf = Buffer.from(hex, 'hex');
          const decoded = buf.toString('utf8');
          // payload := commitment|nullifier|proof|amount|recipient
          const [commitment, nullifier, proof, amountStr, recipient] = decoded.split('|');
          return {
            commitment: commitment || null,
            nullifier: nullifier || null,
            proof: proof || null,
            amount: parseFloat(amountStr) || 0,
            recipient: recipient || null
          };
        }
      }
    } catch (err) {
      console.warn('Failed to parse bridge data from tx', err);
    }

    // Fallback: create pseudo-values based on txid
    return {
      commitment: '0x' + (tx.txid || '').slice(0, 64).padEnd(64, '0'),
      nullifier: '0x' + (tx.txid || '').slice(0, 64).padEnd(64, '0'),
      proof: '0x' + '00'.repeat(64),
      amount: 0,
      recipient: null
    };
  }

  // Helper methods
  async isBridgeTransaction(tx) {
    // In a real implementation, this would check if the transaction
    // interacts with the bridge contract
    return tx.vout.some(output => 
      output.scriptPubKey && 
      output.scriptPubKey.asm.includes('OP_RETURN') &&
      output.scriptPubKey.asm.includes('BRIDGE')
    );
  }

  async extractBridgeData(tx) {
    // In a real implementation, this would extract the bridge data
    // from the transaction's OP_RETURN data
    return {
      commitment: '0x' + tx.txid.slice(0, 64),
      nullifier: '0x' + tx.txid.slice(64, 128),
      proof: '0x' + '0'.repeat(128), // Placeholder for actual proof
      amount: 1000000, // 0.01 ZEC in zatoshis
      recipient: 'miden1q...' // Miden address
    };
  }

  async loadLastProcessedBlock() {
    // Deprecated: storage handled by `storage.js` at start/after processing.
    return this.lastProcessedBlock;
  }

  async saveLastProcessedBlock(height) {
    // Update in-memory and persist
    this.lastProcessedBlock = height;
    try {
      await saveState({ lastProcessedBlock: this.lastProcessedBlock, nullifiers: Array.from(this.nullifierSet || []) });
    } catch (err) {
      console.error('Failed to save last processed block', err);
    }
  }

  retryStart() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    console.log(`Retrying to start relayer in ${this.retryDelay / 1000} seconds...`);
    this.retryTimer = setTimeout(() => this.start(), this.retryDelay);
  }
}

export default ZcashMidenRelayer;