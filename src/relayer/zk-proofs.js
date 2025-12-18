// src/relayer/zk-proofs.js

// ZK proof verification helper. This will attempt to call a configured
// remote verifier service if `VITE_ZK_VERIFIER_URL` (or config.zkVerifierUrl)
// is provided. Otherwise it falls back to the local stub (returns true).

import config from './config.js';

const VERIFIER_URL = process.env.VITE_ZK_VERIFIER_URL || config.zkVerifierUrl || null;

import { localVerify } from './local_verifier.js';

export async function verifyZkProof(commitment, nullifier, proof) {
  console.log('[zk-proofs] verifyZkProof', { commitment, nullifier });

  if (VERIFIER_URL) {
    try {
      const url = (VERIFIER_URL || '').replace(/\/$/, '') + '/verify';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitment, nullifier, proof })
      });

      if (!res.ok) {
        console.warn(`[zk-proofs] verifier returned ${res.status}`);
        return false;
      }

      const body = await res.json().catch(() => ({}));
      if (body && typeof body.valid === 'boolean') return body.valid;
      if (body && (body.ok === true || body.valid === true)) return true;
      return false;
    } catch (err) {
      console.warn('[zk-proofs] verifier call failed', err);
      return false;
    }
  }

  // Use a simple local verifier for simulation
  const ok = localVerify(commitment, nullifier, proof);
  if (!ok) console.warn('[zk-proofs] local verifier rejected proof');
  return ok;
}

