// Lightweight helper utilities for Zcash bridge simulation.
// Real wallet/tx helpers (zcash-bitcore-lib, bip39) are intentionally omitted
// for the simulation runner to avoid installing heavy native deps.

import { Buffer } from 'buffer';
import { encryptEnvelope, encryptEnvelopeAsymmetric } from '../relayer/envelope.js';

export const generateZcashWallet = () => {
    throw new Error('generateZcashWallet not available in simulation.');
};

export const getWalletFromMnemonic = () => {
    throw new Error('getWalletFromMnemonic not available in simulation.');
};

export const validateZcashAddress = () => {
    throw new Error('validateZcashAddress not available in simulation.');
};

export const createZcashTransaction = () => {
    throw new Error('createZcashTransaction not available in simulation.');
};

/**
 * Build an OP_RETURN payload for the bridge.
 * We encode a simple pipe-separated string and hex it for inclusion in asm.
 */
export const buildBridgeOpReturn = ({ commitment, nullifier, proof, envelope }) => {
    // Build payload with an encrypted envelope field to avoid putting recipient/amount
    // in plaintext on-chain. `envelope` is expected to be a base64 string (simulation).
    const payload = [commitment || '0x0', nullifier || '0x0', proof || '0x0', envelope || ''].join('|');
    const hex = Buffer.from(payload).toString('hex');
    return `OP_RETURN BRIDGE ${hex}`;
};

export const createMockBridgeTx = async ({ txid, commitment, nullifier, proof, amount, recipient }) => {
    // For simulation we create a simple base64-encoded envelope JSON and include
    // it in the OP_RETURN payload (hex-encoded). This avoids placing recipient
    // and amount in plaintext in the op-return string.
        const envelopeObj = { amount: amount || 0, recipient: recipient || '' };
        // If recipient looks like a public key hex, use asymmetric envelope
        let envelopeB64;
        if (recipient && recipient.startsWith('0x') && recipient.length >= 66) {
            // caller provided recipient as public key hex
            envelopeB64 = await encryptEnvelopeAsymmetric(envelopeObj, recipient);
        } else {
            envelopeB64 = encryptEnvelope(envelopeObj);
        }

    return {
        txid: txid || 'mock-tx-' + Date.now(),
        vout: [
            {
                scriptPubKey: {
                    asm: buildBridgeOpReturn({ commitment, nullifier, proof, envelope: envelopeB64 })
                }
            }
        ]
    };
};

