// src/relayer/zcash-client.js
// Lightweight mock Zcash RPC client for local simulation/testing.

export class ZcashRPC {
  constructor(config = {}) {
    this.config = config;
    this.blocks = []; // array of { height, tx: [ ... ] }
  }

  // Adds a block (tx object) to the mock chain
  pushBlock(tx) {
    const height = this.blocks.length + 1;
    const block = { height, tx: Array.isArray(tx) ? tx : [tx] };
    this.blocks.push(block);
    return block;
  }

  async getBlockCount() {
    return this.blocks.length;
  }

  // height is 1-based
  async getBlock(height, includeTx = true) {
    if (height < 1 || height > this.blocks.length) {
      throw new Error('Block not found: ' + height);
    }
    const b = this.blocks[height - 1];
    // Return object shape similar to a real RPC for relayer consumption
    return {
      height: b.height,
      tx: b.tx
    };
  }

}

