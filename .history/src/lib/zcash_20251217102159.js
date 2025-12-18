import zcash from 'zcash-bitcore-lib';
import * as bip39 from 'bip39';
import { Buffer } from 'buffer';

// Ensure Buffer is available globally if needed by the library
if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
}

/**
 * Generate a new Zcash wallet (Random Mnemonic)
 */
export const generateZcashWallet = () => {
    const mnemonic = bip39.generateMnemonic();
    return getWalletFromMnemonic(mnemonic);
};

/**
 * Recover wallet from Mnemonic
 */
export const getWalletFromMnemonic = (mnemonic) => {
    if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic");
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    
    // Create HD Wallet (BIP32)
    // Zcash coin type is 133
    // Path: m/44'/133'/0'/0/0
    const hdPrivateKey = zcash.HDPrivateKey.fromSeed(seed.toString('hex'), zcash.Networks.testnet);
    const derived = hdPrivateKey.derive("m/44'/133'/0'/0/0");
    
    const privateKey = derived.privateKey;
    const address = privateKey.toAddress(zcash.Networks.testnet).toString();

    return {
        mnemonic,
        address,
        privateKey: privateKey.toString(),
        wif: privateKey.toWIF()
    };
};

/**
 * Validate Zcash Address
 */
export const validateZcashAddress = (address) => {
    try {
        return zcash.Address.isValid(address, zcash.Networks.testnet);
    } catch (e) {
        return false;
    }
};

/**
 * Construct a simple transaction (Mocked for now as we don't have a backend UTXO provider)
 * In a real app, we would fetch UTXOs from Insight API or similar.
 */
export const createZcashTransaction = (privateKeyWIF, toAddress, amount) => {
    // This is a placeholder. 
    // To implement real sending, we need a service to fetch UTXOs.
    // zcash-bitcore-lib requires inputs to sign.
    console.log("Constructing Zcash transaction for", toAddress, amount);
    return {
        txId: "mock-tx-id-" + Date.now(),
        raw: "mock-raw-tx"
    };
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
