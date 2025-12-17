// relayer/index.js
import { ZcashRPC } from './zcash-client.js';
import { MidenClient } from './miden-client.js';
import { verifyZkProof } from './zk-proofs.js';
import { loadState, saveState } from './storage.js';
import { EventEmitter } from 'events';

class ZcashMidenRelayer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.isRunning = false;
    this.lastProcessedBlock = 0;
    this.retryDelay = 5000;
    this.nullifierSet = new Set();
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      if (this.config.useRealClients) {
        const { ZcashRPCReal } = await import('./zcash-rpc-real.js');
        const { MidenClientReal } = await import('./miden-client-real.js');
        this.zcash = new ZcashRPCReal(this.config.zcash);
        this.miden = new MidenClientReal(this.config.miden);
      } else {
        this.zcash = new ZcashRPC(this.config.zcash);
        this.miden = new MidenClient(this.config.miden);
      }

      const state = await loadState();
      this.lastProcessedBlock = state.lastProcessedBlock || 0;
      this.nullifierSet = new Set(state.nullifiers || []);

      this.processBlocks();
    } catch (err) {
      console.error('Failed to start relayer', err);
      this.isRunning = false;
      this.retryStart();
    }
  }

  async stop() {
    this.isRunning = false;
    clearTimeout(this.retryTimer);
  }

  async processBlocks() {
    while (this.isRunning) {
      try {
        const current = await this.zcash.getBlockCount();
        for (let h = this.lastProcessedBlock + 1; h <= current; h++) {
          await this.processBlock(h);
          this.lastProcessedBlock = h;
          await this.saveLastProcessedBlock(h);
        }
        await new Promise(r => setTimeout(r, this.config.pollInterval || 15000));
      } catch (err) {
        console.error('Error processing blocks', err);
        await new Promise(r => setTimeout(r, this.retryDelay));
      }
    }
  }

  async processBlock(height) {
    const block = await this.zcash.getBlock(height, true);
    for (const tx of block.tx) {
      if (this.isBridgeTransaction(tx)) await this.processBridgeTransaction(tx, height);
    }
  }

  async processBridgeTransaction(tx, height) {
    try {
      const { commitment, nullifier, proof, amount, recipient } = await this.extractBridgeData(tx);
      const current = await this.zcash.getBlockCount();
      if (current - height < (this.config.zcash?.minConfirmations || 0)) return;
      if (this.nullifierSet.has(nullifier)) return;
      const valid = await verifyZkProof(commitment, nullifier, proof);
      if (!valid) return;
      const res = await this.miden.submitBridgeProof({ commitment, nullifier, proof, amount, recipient });
      this.nullifierSet.add(nullifier);
      await saveState({ lastProcessedBlock: this.lastProcessedBlock, nullifiers: Array.from(this.nullifierSet) });
      this.emit('transactionProcessed', { txid: tx.txid, res });
    } catch (err) {
      console.error('Error processing bridge tx', err);
    }
  }

  async extractBridgeData(tx) {
    try {
      for (const out of tx.vout || []) {
        const asm = out.scriptPubKey?.asm;
        if (!asm) continue;
        const parts = asm.split(' ');
        if (parts[0] === 'OP_RETURN' && parts[1] === 'BRIDGE') {
          const hex = parts.slice(2).join('');
          const decoded = Buffer.from(hex, 'hex').toString('utf8');
          const [commitment, nullifier, proof, envelopeB64] = decoded.split('|');
          let amount = 0;
          let recipient = null;
          if (envelopeB64) {
            try {
              const envJson = Buffer.from(envelopeB64, 'base64').toString('utf8');
              const env = JSON.parse(envJson || '{}');
              amount = parseFloat(env.amount) || 0;
              recipient = env.recipient || null;
            } catch (e) {
              // envelope parse failed, keep defaults
            }
          }
          return { commitment, nullifier, proof, amount, recipient };
        }
      }
    } catch (err) {
      console.warn('Failed to parse bridge data', err);
    }
    return { commitment: '0x' + (tx.txid || '').slice(0, 64), nullifier: '0x' + (tx.txid || '').slice(0, 64), proof: null, amount: 0, recipient: null };
  }

  isBridgeTransaction(tx) {
    return tx.vout?.some(o => o.scriptPubKey?.asm?.includes('OP_RETURN') && o.scriptPubKey.asm.includes('BRIDGE'));
  }

  async saveLastProcessedBlock(h) {
    this.lastProcessedBlock = h;
    try { await saveState({ lastProcessedBlock: this.lastProcessedBlock, nullifiers: Array.from(this.nullifierSet) }); } catch (e) { console.error('save state failed', e); }
  }

  retryStart() { this.retryTimer = setTimeout(() => this.start(), this.retryDelay); }
}

export default ZcashMidenRelayer;