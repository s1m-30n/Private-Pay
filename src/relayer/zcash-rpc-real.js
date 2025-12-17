// src/relayer/zcash-rpc-real.js
// Skeleton for a production Zcash RPC client.
// TODO: implement RPC calls to a zcashd node or use an SDK.

import fetch from 'node-fetch';

export class ZcashRPCReal {
  constructor({ rpcUrl, rpcUser, rpcPassword } = {}) {
    this.rpcUrl = rpcUrl;
    this.rpcUser = rpcUser;
    this.rpcPassword = rpcPassword;
  }

  // Generic RPC helper
  async rpc(method, params = []) {
    const body = JSON.stringify({ jsonrpc: '1.0', id: '1', method, params });
    const headers = { 'Content-Type': 'application/json' };
    if (this.rpcUser) {
      const auth = Buffer.from(`${this.rpcUser}:${this.rpcPassword}`).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }
    const res = await fetch(this.rpcUrl, { method: 'POST', headers, body });
    const j = await res.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    return j.result;
  }

  // Production-like RPC methods used by the relayer
  async getBlockCount() {
    return this.rpc('getblockcount');
  }

  async getBlockHash(height) {
    return this.rpc('getblockhash', [height]);
  }

  // includeTx true -> verbosity level 2 (full tx objects)
  async getBlock(height, includeTx = true) {
    const hash = await this.getBlockHash(height);
    // verbosity 2 returns full tx objects
    const verbosity = includeTx ? 2 : 1;
    return this.rpc('getblock', [hash, verbosity]);
  }

  async getRawTransaction(txid, verbose = true) {
    return this.rpc('getrawtransaction', [txid, verbose ? 1 : 0]);
  }

}
