// src/relayer/server.js
// Simple HTTP API to control the relayer and submit bridge events.

import express from 'express';
import config from './config.js';
import ZcashMidenRelayer from './index.js';
import rateLimit from 'express-rate-limit';

// Simple API key middleware
function requireApiKey(req, res, next) {
  const key = process.env.RELAYER_API_KEY;
  if (!key) return next(); // no key configured -> allow (local dev)
  const provided = req.get('x-api-key') || req.query.api_key;
  if (provided && provided === key) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

const app = express();
app.use(express.json({ limit: '64kb' }));

// rate limiter for sensitive endpoints
const limiter = rateLimit({ windowMs: 10 * 1000, max: 20 });
app.use('/submit-proof', limiter);

let relayer = null;

app.get('/status', (req, res) => {
  res.json({ running: !!relayer && relayer.isRunning });
});

app.post('/start', requireApiKey, async (req, res) => {
  if (relayer && relayer.isRunning) return res.status(400).json({ error: 'already running' });
  const useReal = !!req.body.useRealClients;
  relayer = new ZcashMidenRelayer({ ...config, useRealClients: useReal });
  relayer.start().catch(err => console.error('Relayer failed', err));
  return res.json({ started: true, useRealClients: useReal });
});

app.post('/stop', async (req, res) => {
  if (!relayer) return res.status(400).json({ error: 'not running' });
  await relayer.stop();
  relayer = null;
  res.json({ stopped: true });
});

// Submit a proof payload manually (useful for testing)
app.post('/submit-proof', requireApiKey, async (req, res) => {
  const payload = req.body;
  if (!relayer) return res.status(400).json({ error: 'relayer not running' });
  // Basic validation
  if (!payload || !payload.commitment || !payload.nullifier) {
    return res.status(400).json({ error: 'invalid payload' });
  }
  try {
    const result = await relayer.miden.submitBridgeProof(payload);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.RELAYER_PORT || 3001;
if (process.env.RELAYER_RUN === '1') {
  app.listen(port, () => console.log(`Relayer HTTP API listening on ${port}`));
}

export default app;
