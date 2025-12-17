// run-once.js - start relayer, push one mock block, stop, and print state
import path from 'path';
import fs from 'fs/promises';
import config from './config.js';
import MiniRelayer from './minirelayer.js';
import { createMockBridgeTx } from '../lib/zcash.js';

const STATE_FILE = path.resolve(process.cwd(), '.relayer_state.json');

async function main() {
  console.log('run-once starting. cwd=', process.cwd());
  const cfg = Object.assign({}, config, { useRealClients: false, pollInterval: 200, zcash: { minConfirmations: 0 } });
  const relayer = new MiniRelayer(cfg);

  await relayer.start();
  console.log('Relayer started');

  // small delay for initialization
  await new Promise(r => setTimeout(r, 200));

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
    // process immediately
    await relayer.processBlock(block.height);
  } else {
    console.warn('Relayer zcash client not available to push block for simulation');
  }

  // wait a moment for processing/IO
  await new Promise(r => setTimeout(r, 200));

  console.log('Stopping relayer');
  await relayer.stop();

  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    console.log('\n.relayer_state.json contents:\n', raw);
  } catch (err) {
    console.warn('State file not found at', STATE_FILE, '-', err.message);
  }
}

main().catch(err => {
  console.error('run-once error', err);
  process.exit(1);
});
