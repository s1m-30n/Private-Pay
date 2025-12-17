// src/relayer/miden-client-real.js
// Real Miden client that submits bridge proofs to a Miden node HTTP API.

// Uses the global `fetch` available in modern Node.js (>=18).
// src/relayer/miden-client-real.js
// Skeleton for integrating with a Miden node or program.
// TODO: implement actual HTTP RPC or program submission logic.

import fetch from 'node-fetch';

export class MidenClientReal {
  constructor({ nodeUrl, bridgeProgramId, privateKey, apiKey } = {}) {
    this.nodeUrl = nodeUrl || process.env.VITE_MIDEN_NODE_URL || 'http://localhost:8080';
    this.bridgeProgramId = bridgeProgramId || process.env.VITE_MIDEN_BRIDGE_PROGRAM_ID;
    this.privateKey = privateKey || process.env.VITE_TREASURY_PRIVATE_KEY;
    this.apiKey = apiKey || process.env.VITE_MIDEN_API_KEY || null;
  }

  // Submit a bridge proof payload to the Miden node/program.
  async submitBridgeProof(payload) {
    // Expects the node to expose a POST endpoint at `${nodeUrl}/bridge/submit` or similar.
    const url = (this.nodeUrl || 'http://localhost:8080').replace(/\/$/, '') + '/bridge/submit';
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bridgeProgramId: this.bridgeProgramId, payload })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Miden submit failed ${res.status}: ${text}`);
    }

    try {
      return await res.json();
    } catch (e) {
      return { ok: true, status: res.status };
    }
  }
}
