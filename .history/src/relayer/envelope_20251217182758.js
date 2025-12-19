import crypto from 'crypto';
import * as secp from '@noble/secp256k1';

const DEFAULT_KEY = '0123456789abcdef0123456789abcdef'; // 32 bytes for AES-256

function getKey() {
  const k = process.env.VITE_ENVELOPE_KEY || DEFAULT_KEY;
  const buf = Buffer.from(k, 'utf8');
  if (buf.length === 32) return buf;
  // If provided key is shorter/longer, derive a 32-byte key via hash
  return crypto.createHash('sha256').update(buf).digest();
}

export function encryptEnvelope(obj) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(obj || {});
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack as iv|tag|ciphertext
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptEnvelope(b64) {
  try {
    // Detect ECIES-style envelope: starts with 'EC:' then base64 JSON {epk, data}
    if (typeof b64 === 'string' && b64.startsWith('EC:')) {
      const payload = b64.slice(3);
      const parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      const epk = parsed.epk; // hex
      const data = parsed.data; // base64 ciphertext
      const privHex = process.env.VITE_ENVELOPE_PRIVATE_KEY || null;
      if (!privHex) return null; // cannot decrypt without recipient private key in env
      try {
        const key = deriveSharedKey(privHex, epk);
        return decryptWithKey(key, data);
      } catch (e) { return null; }
    }
  } catch (e) {
    // fall through to symmetric path
  }
  try {
    const key = getKey();
    const buf = Buffer.from(b64 || '', 'base64');
    if (buf.length < 28) return null;
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const ct = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    return JSON.parse(pt || '{}');
  } catch (e) {
    return null;
  }
}

function deriveSharedKey(privHex, pubHex) {
  // compute shared secret and derive 32-byte key via sha256
  const priv = hexToBytes(privHex.replace(/^0x/, ''));
  const pub = hexToBytes(pubHex.replace(/^0x/, ''));
  const shared = secp.getSharedSecret(priv, pub);
  // hash shared secret with Node crypto
  const hashed = crypto.createHash('sha256').update(Buffer.from(shared)).digest();
  return Buffer.from(hashed);
}

function decryptWithKey(keyBuf, dataB64) {
  try {
    const buf = Buffer.from(dataB64, 'base64');
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const ct = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    return JSON.parse(pt || '{}');
  } catch (e) { return null; }
}

function hexToBytes(hex) { return Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex')); }

export async function encryptEnvelopeAsymmetric(obj, recipientPubHex) {
  // Ephemeral-static ECIES: generate ephemeral key, derive shared secret, encrypt
  const ephPriv = crypto.randomBytes(32);
  const ephPub = secp.getPublicKey(ephPriv);
  const ephPubHex = Buffer.from(ephPub).toString('hex');
  const shared = secp.getSharedSecret(ephPriv, hexToBytes(recipientPubHex));
  const key = crypto.createHash('sha256').update(Buffer.from(shared)).digest();
  // encrypt with AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(obj || {});
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ct]).toString('base64');
  const payload = JSON.stringify({ epk: ephPubHex, data: packed });
  return 'EC:' + Buffer.from(payload).toString('base64');
}

export default { encryptEnvelope, decryptEnvelope };
