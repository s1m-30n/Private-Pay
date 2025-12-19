// src/relayer/reverse-sim-run.js
// Simple two-way simulation: Zcash -> Miden (forward) then simulate Miden burn -> create Zcash unlock tx

import config from '../relayer/config.js';
import MiniRelayer from './minirelayer.js';
import SimMidenBridge from '../miden/sim_bridge.js';
import { createMockBridgeTx } from '../lib/zcash.js';

async function run() {
  const relayer = new MiniRelayer(Object.assign({}, config, { useRealClients: false }));
  const miden = new SimMidenBridge();

  await relayer.start();
  console.log('MiniRelayer started');

  // Forward: create Zcash bridge tx -> Miden
  const forwardTx = await createMockBridgeTx({
    txid: 'bridge_tx_forward_' + Date.now(),
    commitment: '0x' + 'aa'.repeat(16),
    nullifier: '0x' + 'bb'.repeat(16),
    proof: '0x' + '00'.repeat(64),
    amount: 1000,
    recipient: ''
  });

  const block = relayer.zcash.pushBlock(forwardTx);
  console.log('Pushed forward block', block.height);
  await relayer.processBlock(block.height);

  // Simulate Miden receiving and minting
  const applyRes = await miden.verifyAndApply({ commitment: '0x' + 'aa'.repeat(16), nullifier: '0x' + 'bb'.repeat(16), proof: '0x' + '00'.repeat(64), amount: 1000, recipient: 'miden_recipient' });
  console.log('Miden applyRes', applyRes);

  // Now simulate a burn on Miden that should produce an unlock on Zcash: create a new mock Zcash tx
  const unlockNullifier = '0x' + 'cc'.repeat(16);
  const unlockCommitment = '0x' + 'dd'.repeat(16);
  const unlockProof = '0x' + '11'.repeat(64);
  const zcashUnlockTx = await createMockBridgeTx({ txid: 'bridge_tx_back_' + Date.now(), commitment: unlockCommitment, nullifier: unlockNullifier, proof: unlockProof, amount: 500, recipient: 'zcash1qrecipient' });

  const block2 = relayer.zcash.pushBlock(zcashUnlockTx);
  console.log('Pushed unlock block', block2.height);
  await relayer.processBlock(block2.height);

  console.log('Reverse simulation complete');
  await relayer.stop();
}

if (import.meta.url === `file://${process.cwd()}/src/relayer/reverse-sim-run.js`) run().catch(err => { console.error(err); process.exit(1); });
