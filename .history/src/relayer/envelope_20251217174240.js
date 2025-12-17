import crypto from 'crypto';

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

export default { encryptEnvelope, decryptEnvelope };
