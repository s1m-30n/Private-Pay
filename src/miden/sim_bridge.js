// src/miden/sim_bridge.js
// Simple simulated Miden bridge program for testing: verifies proofs (via verifier),
// enforces nullifier uniqueness, records commitments, and returns simulated receipt.

import { verifyZkProof as remoteVerify } from '../relayer/zk-proofs.js';

export default class SimMidenBridge {
  constructor() {
    this.nullifierSet = new Set();
    this.commitments = [];
    this.totalLocked = 0;
  }

  // Simulate proof verification + on-program state updates
  async verifyAndApply({ commitment, nullifier, proof, amount, recipient }) {
    // 1. Verify proof (calls zk-proofs which may call a remote verifier or stub)
    const valid = await remoteVerify(commitment, nullifier, proof);
    if (!valid) return { ok: false, error: 'invalid_proof' };

    // 2. Enforce nullifier uniqueness
    if (this.nullifierSet.has(nullifier)) return { ok: false, error: 'nullifier_used' };

    // 3. Apply state changes
    this.nullifierSet.add(nullifier);
    this.commitments.push(commitment);
    this.totalLocked += Number(amount || 0);

    // 4. Simulate minting wrapped token by returning a success receipt
    return { ok: true, receipt: { tx: 'sim_miden_tx_' + Date.now(), commitment, nullifier, amount, recipient } };
  }

  // helper for tests
  hasNullifier(n) {
    return this.nullifierSet.has(n);
  }
}
