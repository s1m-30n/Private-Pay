/**
 * Stealth Address Generation for Starknet
 * JavaScript implementation compatible with Starknet felt252 addresses
 * Based on EIP-5564 / BIP-0352 stealth address protocol
 */

import { getPublicKey as secp256k1GetPublicKey, Point } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * Generate a random private key (32 bytes)
 */
export const generatePrivateKey = () => {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);

  // Ensure the private key is valid
  if (privateKey.every(byte => byte === 0)) {
    crypto.getRandomValues(privateKey);
  }

  return privateKey;
};

/**
 * Get public key from private key (compressed, 33 bytes)
 */
export const getPublicKey = (privateKey) => {
  const pubKey = secp256k1GetPublicKey(privateKey, true);
  return pubKey;
};

/**
 * Convert public key to hex string
 */
export const publicKeyToHex = (publicKey) => {
  return bytesToHex(publicKey);
};

/**
 * Convert hex string to bytes
 */
export const hexToBytes = (hex) => {
  if (!hex || typeof hex !== 'string') {
    throw new Error('Invalid hex string');
  }
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
};

/**
 * ECDH: Compute shared secret between private key and public key
 */
export const computeSharedSecret = (privateKey, publicKey) => {
  let publicKeyHex;
  if (publicKey instanceof Uint8Array) {
    publicKeyHex = bytesToHex(publicKey);
  } else {
    publicKeyHex = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey;
  }

  let privateKeyBigInt;
  if (privateKey instanceof Uint8Array) {
    let result = 0n;
    for (let i = 0; i < privateKey.length; i++) {
      result = result * 256n + BigInt(privateKey[i]);
    }
    privateKeyBigInt = result;
  } else if (typeof privateKey === "string") {
    const privKeyBytes = hexToBytes(privateKey);
    let result = 0n;
    for (let i = 0; i < privKeyBytes.length; i++) {
      result = result * 256n + BigInt(privKeyBytes[i]);
    }
    privateKeyBigInt = result;
  } else {
    privateKeyBigInt = privateKey;
  }

  const point = Point.fromHex(publicKeyHex);
  const sharedPoint = point.multiply(privateKeyBigInt);
  const sharedPointHex = sharedPoint.toHex(true);
  const sharedSecret = hexToBytes(sharedPointHex);

  return sharedSecret;
};

/**
 * Derive stealth address for Starknet
 * Uses keccak256 for Starknet compatibility and derives felt252-compatible address
 * @param {string} spendPubKeyHex - Spend public key (hex, 33 bytes compressed)
 * @param {string} viewingPubKeyHex - Viewing public key (hex, 33 bytes compressed)
 * @param {Uint8Array} ephemeralPrivKey - Ephemeral private key (32 bytes)
 * @param {number} k - Index (default 0)
 * @returns {Object} - { stealthAddress, ephemeralPubKey, viewHint, k }
 */
export const generateStealthAddress = (
  spendPubKeyHex,
  viewingPubKeyHex,
  ephemeralPrivKey,
  k = 0
) => {
  try {
    const spendPubKey = hexToBytes(spendPubKeyHex);
    const viewingPubKey = hexToBytes(viewingPubKeyHex);

    // Get ephemeral public key
    const ephemeralPubKey = getPublicKey(ephemeralPrivKey);
    const ephemeralPubKeyHex = bytesToHex(ephemeralPubKey);

    // Compute shared secret using ECDH
    const sharedSecret = computeSharedSecret(ephemeralPrivKey, viewingPubKey);

    // Hash shared secret with k
    const kBytes = new Uint8Array(4);
    const kView = new DataView(kBytes.buffer);
    kView.setUint32(0, k, false);

    const tweakInput = new Uint8Array(sharedSecret.length + 4);
    tweakInput.set(sharedSecret, 0);
    tweakInput.set(kBytes, sharedSecret.length);
    const tweakBytes = sha256(tweakInput);

    // Convert tweak bytes to bigint
    let tweakBigInt = 0n;
    for (let i = 0; i < tweakBytes.length; i++) {
      tweakBigInt = tweakBigInt * 256n + BigInt(tweakBytes[i]);
    }

    // Compute stealth public key: stealth_pub = spend_pub + tweak * G
    const tweakPoint = Point.BASE.multiply(tweakBigInt);
    const tweakPubKeyHex = tweakPoint.toHex(true);
    const tweakPubKey = hexToBytes(tweakPubKeyHex);

    const spendPubKeyHexStr = bytesToHex(spendPubKey);
    const tweakPubKeyHexStr = bytesToHex(tweakPubKey);
    const spendPoint = Point.fromHex(spendPubKeyHexStr);
    const tweakPubPoint = Point.fromHex(tweakPubKeyHexStr);
    const stealthPubPoint = spendPoint.add(tweakPubPoint);
    const stealthPubKeyHex = stealthPubPoint.toHex(true);
    const stealthPubKey = hexToBytes(stealthPubKeyHex);

    // Derive Starknet address using keccak256
    // Starknet addresses are felt252 (max 251 bits)
    const addressHash = keccak_256(stealthPubKey);

    // Take first 31 bytes to ensure it fits in felt252 (< 2^251)
    const addressBytes = addressHash.slice(0, 31);
    const addressHex = bytesToHex(addressBytes);
    const stealthAddress = "0x" + addressHex;

    // View hint: first byte of shared secret
    const viewHint = bytesToHex(new Uint8Array([sharedSecret[0]]));

    return {
      stealthAddress,
      stealthPubKey: stealthPubKeyHex,
      ephemeralPubKey: ephemeralPubKeyHex,
      viewHint,
      k,
    };
  } catch (error) {
    console.error("Error generating stealth address:", error);
    throw error;
  }
};

/**
 * Generate ephemeral key pair
 */
export const generateEphemeralKeyPair = () => {
  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  };
};

/**
 * Generate meta address key pairs (spend and viewing)
 */
export const generateMetaAddressKeys = () => {
  const spendPrivateKey = generatePrivateKey();
  const spendPublicKey = getPublicKey(spendPrivateKey);

  const viewingPrivateKey = generatePrivateKey();
  const viewingPublicKey = getPublicKey(viewingPrivateKey);

  return {
    spend: {
      privateKey: bytesToHex(spendPrivateKey),
      publicKey: bytesToHex(spendPublicKey),
    },
    viewing: {
      privateKey: bytesToHex(viewingPrivateKey),
      publicKey: bytesToHex(viewingPublicKey),
    },
  };
};

/**
 * Validate public key format (33 bytes compressed)
 */
export const validatePublicKey = (pubKeyHex) => {
  try {
    if (!pubKeyHex || typeof pubKeyHex !== 'string') {
      return { valid: false, error: "Public key must be a string" };
    }

    const cleanHex = pubKeyHex.trim().startsWith("0x") ? pubKeyHex.trim().slice(2) : pubKeyHex.trim();

    if (cleanHex.length !== 66) {
      return {
        valid: false,
        error: `Public key must be 33 bytes (66 hex characters), got ${cleanHex.length / 2} bytes`
      };
    }

    const bytes = hexToBytes(pubKeyHex);
    if (bytes.length !== 33) {
      return { valid: false, error: `Public key must be 33 bytes, got ${bytes.length} bytes` };
    }
    if (bytes[0] !== 0x02 && bytes[0] !== 0x03) {
      return { valid: false, error: `Invalid compression flag` };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message || "Invalid public key format" };
  }
};

/**
 * Split public key into x and y coordinates for contract calls
 * @param {string} pubKeyHex - Compressed public key (33 bytes hex)
 * @returns {Object} - { x: felt252, y: felt252 }
 */
export const splitPublicKeyForContract = (pubKeyHex) => {
  try {
    const cleanHex = pubKeyHex.startsWith("0x") ? pubKeyHex.slice(2) : pubKeyHex;
    const point = Point.fromHex(cleanHex);

    // Get x and y as hex strings
    // felt252 max is 2^251, so we take lower 251 bits (63 hex chars = 252 bits, truncate to 62)
    const xHex = point.x.toString(16);
    const yHex = point.y.toString(16);

    // Truncate to fit felt252 (max 62 hex chars = 248 bits, safe for felt252)
    const x = "0x" + xHex.slice(-62).padStart(62, '0');
    const y = "0x" + yHex.slice(-62).padStart(62, '0');

    return { x, y };
  } catch (error) {
    console.error("Error splitting public key:", error);
    throw error;
  }
};
