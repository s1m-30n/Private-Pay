// Lightweight helper utilities for Zcash bridge simulation.
// Real wallet/tx helpers (zcash-bitcore-lib, bip39) are intentionally omitted
// for the simulation runner to avoid installing heavy native deps.

import { Buffer } from 'buffer';
import { encryptEnvelope, encryptEnvelopeAsymmetric } from '../relayer/envelope.js';

// Mock implementation for simulation - generates a simulated Zcash wallet
export const generateZcashWallet = () => {
    // Generate a mock mnemonic (12 words for simulation)
    const mockWords = [
        'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
        'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
        'action', 'actor', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult',
        'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent', 'agree'
    ];
    
    const mnemonic = Array.from({ length: 12 }, () => 
        mockWords[Math.floor(Math.random() * mockWords.length)]
    ).join(' ');
    
    // Generate a mock transparent address (starts with 't' for testnet)
    // Zcash transparent addresses are typically 35 characters, starting with 't' or 'tm'
    const randomChars = Array.from({ length: 33 }, () => 
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 62)]
    ).join('');
    const mockAddress = 'tm' + randomChars;
    
    return {
        address: mockAddress,
        mnemonic: mnemonic,
        privateKey: 'mock_private_key_' + Date.now(),
        publicKey: 'mock_public_key_' + Date.now(),
        network: 'testnet'
    };
};

// Mock implementation for importing wallet from mnemonic
export const getWalletFromMnemonic = (mnemonic) => {
    if (!mnemonic || mnemonic.trim().split(' ').length < 12) {
        throw new Error('Invalid mnemonic: must be at least 12 words');
    }
    
    // Generate a mock transparent address from mnemonic hash
    const mnemonicHash = Buffer.from(mnemonic).toString('hex').substring(0, 33);
    const mockAddress = 'tm' + mnemonicHash;
    
    return {
        address: mockAddress,
        mnemonic: mnemonic.trim(),
        privateKey: 'mock_private_key_' + Date.now(),
        publicKey: 'mock_public_key_' + Date.now(),
        network: 'testnet'
    };
};

// Mock implementation for address validation
export const validateZcashAddress = (address) => {
    if (!address || typeof address !== 'string') {
        return false;
    }
    // Basic validation: transparent addresses start with 't' or 'tm', shielded with 'z' or 'zs'
    return address.startsWith('t') || address.startsWith('tm') || address.startsWith('z') || address.startsWith('zs');
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

