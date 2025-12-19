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
  const tx = createMockBridgeTx({ commitment: '0x1', nullifier: '0x2', proof: '0x3', amount: 42, recipient: 'miden1qmockrecipient' });
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
