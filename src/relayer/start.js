// relayer/start.js
const ZcashMidenRelayer = require('./index');
const config = require('./config');

// Create and start the relayer
const relayer = new ZcashMidenRelayer(config);

// Handle events
relayer.on('transactionProcessed', ({ txid, result }) => {
  console.log(`Transaction ${txid} processed successfully:`, result);
});

relayer.on('error', ({ txid, error }) => {
  console.error(`Error processing transaction ${txid}:`, error);
});

// Start the relayer
relayer.start().catch(console.error);

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Shutting down relayer...');
  await relayer.stop();
  process.exit(0);
});