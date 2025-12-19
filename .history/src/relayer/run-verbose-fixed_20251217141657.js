// Verbose runner for local relayer simulation that prints the persisted state

import path from 'path';
import fs from 'fs/promises';
import config from './config.js';
import ZcashMidenRelayer from './index.js';
import { createMockBridgeTx } from '../lib/zcash.js';

const STATE_FILE = path.resolve(process.cwd(), '.relayer_state.json');

async function runVerbose() {
  console.log('Verbose relayer runner starting. cwd=', process.cwd());

  // Use config but ensure quick polling for test
  const cfg = Object.assign({}, config, { useRealClients: false, pollInterval: 200, zcash: { minConfirmations: 0 } });

  const relayer = new ZcashMidenRelayer(cfg);

  try {
    await relayer.start();
    console.log('Relayer started');
  } catch (err) {
    console.error('Relayer.start() error', err);
  }

  // Give relayer a moment to initialize
  await new Promise(r => setTimeout(r, 300));

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
    console.log('Pushed mock block to zcash client at height', block.height);
  } else {
    console.warn('Relayer zcash client not available to push block for simulation');
  }

  // Wait for relayer to process
  await new Promise(r => setTimeout(r, 2000));

  console.log('Stopping relayer');
  await relayer.stop();

  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    console.log('\n.relayer_state.json contents:\n', raw);
  } catch (err) {
    console.warn('State file not found at', STATE_FILE, '-', err.message);
  }
}

runVerbose().catch(err => {
  console.error('Verbose run failed', err);
  process.exit(1);
});
