// src/relayer/local_verifier.js
// A lightweight local verifier used for simulation when no external verifier URL
// is configured. It performs a simple deterministic check on the proof shape.

export function localVerify(commitment, nullifier, proof) {
  // For simulation accept proofs that are non-empty and start with 0x
  if (!proof) return false;
  if (typeof proof === 'string' && proof.startsWith('0x')) return true;
  return false;
}

export default { localVerify };
