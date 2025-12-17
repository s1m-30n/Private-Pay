// src/relayer/run-verbose.js
import path from 'path';
import fs from 'fs/promises';
import config from './config.js';
import ZcashMidenRelayer from './index.js';
import { createMockBridgeTx } from '../lib/zcash.js';

async function runVerbose() {
  console.log('Verbose relayer runner starting. cwd=', process.cwd());

  const relayer = new ZcashMidenRelayer(config);

  // Start relayer and wait for initialization
  try {
    await relayer.start();
    console.log('Relayer.start() returned');
  } catch (err) {
    console.error('Relayer.start() threw', err);
  }

  // Give relayer a moment to be ready
  await new Promise(r => setTimeout(r, 500));

  const tx = createMockBridgeTx({
    txid: 'bridge_tx_' + Date.now(),
    commitment: '0x' + 'aa'.repeat(16),
    nullifier: '0x' + 'bb'.repeat(16),
    proof: '0x' + '00'.repeat(64),
    amount: 123456,
    recipient: 'miden1qmockrecipient'
  });

  if (relayer.zcash && typeof relayer.zcash.pushBlock === 'function') {
    const block = relayer.zcash.pushBlock(tx);
    console.log('Pushed mock block to zcash client:', block.height);
  } else {
    console.warn('Relayer zcash client not available to push block for simulation');
  }

  // Wait for relayer to process the pushed block
  await new Promise(r => setTimeout(r, 4000));

  console.log('Stopping relayer now');
  await relayer.stop();

  // Attempt to read the expected state file
  const STATE_FILE = path.resolve(process.cwd(), '.relayer_state.json');
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    console.log('Found state file at', STATE_FILE);
    console.log(raw);
  } catch (err) {
    console.warn('State file not found at', STATE_FILE, '-', err.message);
  }
}

runVerbose().catch(err => {
  console.error('Verbose run failed', err);
  process.exit(1);
});
