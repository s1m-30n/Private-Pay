// Lightweight helper utilities for Zcash bridge simulation.
// Real wallet/tx helpers (zcash-bitcore-lib, bip39) are intentionally omitted
// for the simulation runner to avoid installing heavy native deps.

import { Buffer } from 'buffer';

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
export const buildBridgeOpReturn = ({ commitment, nullifier, proof, amount, recipient }) => {
    // All inputs expected as hex strings (0x...)
    const payload = [commitment || '0x0', nullifier || '0x0', proof || '0x0', String(amount || 0), recipient || ''].join('|');
    const hex = Buffer.from(payload).toString('hex');
    return `OP_RETURN BRIDGE ${hex}`;
};

export const createMockBridgeTx = ({ txid, commitment, nullifier, proof, amount, recipient }) => {
    return {
        txid: txid || 'mock-tx-' + Date.now(),
        vout: [
            {
                scriptPubKey: {
                    asm: buildBridgeOpReturn({ commitment, nullifier, proof, amount, recipient })
                }
            }
        ]
    };
};
