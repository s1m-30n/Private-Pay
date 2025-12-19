import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createMockBridgeTx } from '../src/lib/zcash.js';

const run = promisify(exec);

test('sim-run creates relayer state file', async () => {
  // Run the sim-run script
  await run('node src/relayer/sim-run.js');
  const raw = await fs.readFile('.relayer_state.json', 'utf8');
  const state = JSON.parse(raw);
  expect(state).toHaveProperty('lastProcessedBlock');
  expect(Array.isArray(state.nullifiers)).toBe(true);
});

test('createMockBridgeTx does not include plaintext recipient/amount in OP_RETURN', async () => {
  const tx = await createMockBridgeTx({ commitment: '0x1', nullifier: '0x2', proof: '0x3', amount: 42, recipient: 'miden1qmockrecipient' });
  const asm = tx.vout[0].scriptPubKey.asm;
  expect(asm.startsWith('OP_RETURN BRIDGE ')).toBe(true);
  const hex = asm.split(' ').slice(2).join('');
  const decoded = Buffer.from(hex, 'hex').toString('utf8');
  const parts = decoded.split('|');
  // envelope field should not contain plaintext recipient
  const envelope = parts[3] || '';
  const rawEnv = Buffer.from(envelope || '', 'base64').toString('utf8');
  expect(rawEnv).not.toContain('miden1qmockrecipient');
  expect(rawEnv).not.toContain('42');
});

test('asymmetric envelope roundtrip (simulation)', async () => {
  const secp = await import('@noble/secp256k1');
  const crypto = await import('crypto');
  // generate recipient keypair using Node crypto
  const recipientPriv = crypto.randomBytes(32).toString('hex');
  const recipientPub = secp.getPublicKey(Buffer.from(recipientPriv, 'hex'));
  const recipientPubHex = '0x' + Buffer.from(recipientPub).toString('hex');

  // create mock tx encrypting envelope asymmetrically (pass pubkey as recipient)
  const tx = await createMockBridgeTx({ commitment: '0x1', nullifier: '0x2', proof: '0x3', amount: 99, recipient: recipientPubHex });
  const asm = tx.vout[0].scriptPubKey.asm;
  const hex = asm.split(' ').slice(2).join('');
  const decoded = Buffer.from(hex, 'hex').toString('utf8');
  const parts = decoded.split('|');
  const envelope = parts[3] || '';

  // decrypt using recipient private key via decryptEnvelope (sim env)
  // set env key for recipient
  process.env.VITE_ENVELOPE_PRIVATE_KEY = recipientPriv;
  const { decryptEnvelope } = await import('../src/relayer/envelope.js');
  const env = decryptEnvelope(envelope);
  expect(env).not.toBeNull();
  expect(env.amount).toBe(99);
  expect(env.recipient).toBe(''); // original recipient string was pubkey, payload uses empty recipient field
});

test('reverse flow simulation (Zcash -> Miden -> Zcash)', async () => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const run = promisify(exec);

  // Run reverse sim script
  await run('node src/relayer/reverse-sim-run.js');

  // Verify relayer state file exists and has at least one processed block
  const fs = await import('fs/promises');
  const raw = await fs.readFile('.relayer_state.json', 'utf8');
  const state = JSON.parse(raw);
  expect(state).toHaveProperty('lastProcessedBlock');
  expect(Array.isArray(state.nullifiers)).toBe(true);
});
