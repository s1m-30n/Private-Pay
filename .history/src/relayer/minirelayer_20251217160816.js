import { EventEmitter } from 'events';
import { saveState } from './storage.js';
import { verifyZkProof } from './zk-proofs.js';

class MiniZcashClient {
  constructor() {
    this.blocks = [];
  }

  pushBlock(tx) {
    const height = this.blocks.length + 1;
    const block = { height, tx: [tx] };
    this.blocks.push(block);
    return block;
  }

  async getBlockCount() {
    return this.blocks.length;
  }

  async getBlock(height, _full) {
    const idx = height - 1;
    if (idx < 0 || idx >= this.blocks.length) throw new Error('block not found');
    return this.blocks[idx];
  }
}

class MiniMidenClient {
  async submitBridgeProof(obj) {
    // Simulate successful submission
    return { ok: true, tx: 'miden_tx_' + Date.now(), submitted: obj };
  }
}

export default class MiniRelayer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.zcash = new MiniZcashClient();
    this.miden = new MiniMidenClient();
    this.nullifierSet = new Set();
    this.lastProcessedBlock = 0;
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
  }

  async stop() {
    this.isRunning = false;
  }

  async processBlock(height) {
    const block = await this.zcash.getBlock(height, true);
    for (const tx of block.tx) {
      if (this.isBridgeTransaction(tx)) {
        await this.processBridgeTransaction(tx, height);
      }
    }
  }

  isBridgeTransaction(tx) {
    return tx.vout && tx.vout.some(o => o.scriptPubKey && o.scriptPubKey.asm && o.scriptPubKey.asm.includes('BRIDGE'));
  }

  async extractBridgeData(tx) {
    for (const out of tx.vout || []) {
      const asm = out.scriptPubKey && out.scriptPubKey.asm;
      if (!asm) continue;
      const parts = asm.split(' ');
      if (parts.length >= 3 && parts[0] === 'OP_RETURN' && parts[1] === 'BRIDGE') {
        const hex = parts.slice(2).join('');
        const buf = Buffer.from(hex, 'hex');
        const decoded = buf.toString('utf8');
        const [commitment, nullifier, proof, amountStr, recipient] = decoded.split('|');
        return { commitment, nullifier, proof, amount: parseFloat(amountStr) || 0, recipient };
      }
    }
    return { commitment: null, nullifier: null, proof: null, amount: 0, recipient: null };
  }

  async processBridgeTransaction(tx, height) {
    const { commitment, nullifier, proof, amount, recipient } = await this.extractBridgeData(tx);
    if (!nullifier) return;
    if (this.nullifierSet.has(nullifier)) return;
    const valid = await verifyZkProof(commitment, nullifier, proof);
    if (!valid) return;
    const res = await this.miden.submitBridgeProof({ commitment, nullifier, proof, amount, recipient });
    this.nullifierSet.add(nullifier);
    this.lastProcessedBlock = height;
    await saveState({ lastProcessedBlock: this.lastProcessedBlock, nullifiers: Array.from(this.nullifierSet) });
    this.emit('transactionProcessed', { txid: tx.txid, res });
  }
}
