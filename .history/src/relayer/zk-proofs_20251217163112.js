// src/relayer/zk-proofs.js

// ZK proof verification helper. This will attempt to call a configured
// remote verifier service if `VITE_ZK_VERIFIER_URL` (or config.zkVerifierUrl)
// is provided. Otherwise it falls back to the local stub (returns true).

import config from './config.js';

const VERIFIER_URL = process.env.VITE_ZK_VERIFIER_URL || config.zkVerifierUrl || null;

export async function verifyZkProof(commitment, nullifier, proof) {
  // Basic logging
  console.log('[zk-proofs] verifyZkProof', { commitment, nullifier });

  // If a verifier URL is configured, call it with the payload
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
      // Expect { valid: true } or similar
      if (body && typeof body.valid === 'boolean') return body.valid;
      // If unknown shape, consider truthy `ok` or `valid` fields
      if (body && (body.ok === true || body.valid === true)) return true;
      return false;
    } catch (err) {
      console.warn('[zk-proofs] verifier call failed', err);
      return false;
    }
  }

  // Fallback stub (simulation): accept the proof but log a warning.
  console.warn('[zk-proofs] No verifier configured — using stubbed verifier (ACCEPTING proofs).');
  return true;
}

