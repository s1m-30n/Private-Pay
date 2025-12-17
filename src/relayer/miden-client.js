// src/relayer/miden-client.js
// Minimal Miden client mock used by the relayer during development/testing.

export class MidenClient {
  constructor(config = {}) {
    this.config = config;
  }

  // Simulate submitting a bridge proof to Miden program
  async submitBridgeProof({ commitment, nullifier, proof, amount, recipient }) {
    console.log('[MidenClient] submitBridgeProof', { commitment, nullifier, amount, recipient });
    // Return a mocked success result
    return { success: true, txid: 'miden_mock_' + Date.now() };
  }

}

