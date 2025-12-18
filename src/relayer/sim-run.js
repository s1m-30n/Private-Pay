// src/relayer/sim-run.js
// Simple simulation runner: creates a mock bridge transaction and starts the relayer.

import config from './config.js';
import ZcashMidenRelayer from './index.js';
import { createMockBridgeTx } from '../lib/zcash.js';

async function run() {
  const relayer = new ZcashMidenRelayer(config);

  // Start relayer (it will initialize its own ZcashRPC instance)
  relayer.start().catch(err => console.error('Relayer failed to start', err));

  // Wait a moment for relayer to initialize
  await new Promise(r => setTimeout(r, 500));

  // Create a mock bridge tx and push into the relayer's zcash mock
  const tx = await createMockBridgeTx({
    txid: 'bridge_tx_' + Date.now(),
    commitment: '0x' + 'aa'.repeat(16),
    nullifier: '0x' + 'bb'.repeat(16),
    proof: '0x' + '00'.repeat(64),
    amount: 123456,
    recipient: 'miden1qmockrecipient'
  });

  // Push to relayer's zcash client
  if (relayer.zcash && typeof relayer.zcash.pushBlock === 'function') {
    const block = relayer.zcash.pushBlock(tx);
    console.log('Pushed mock block to zcash client:', block.height);
  } else {
    console.warn('Relayer zcash client not available to push block for simulation');
  }

  // Allow relayer time to process
  await new Promise(r => setTimeout(r, 3000));

  console.log('Simulation complete — stopping relayer');
  await relayer.stop();
}

if (import.meta.url === `file://${process.cwd()}/src/relayer/sim-run.js`) run().catch(console.error);
