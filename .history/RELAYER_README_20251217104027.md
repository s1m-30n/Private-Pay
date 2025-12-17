Relayer Quickstart
===================

This file explains how to run the local relayer simulation and HTTP API.

Simulation (no external deps)
-----------------------------

1. Start the simulation which pushes a mock Zcash bridge tx and processes it:

```bash
node src/relayer/sim-run.js
```

2. Check `.relayer_state.json` to see saved `lastProcessedBlock` and `nullifiers`.

HTTP API
--------

Start the relayer HTTP API (this launches an Express server):

```bash
RELAYER_RUN=1 node src/relayer/server.js
```

Endpoints:
- `GET /status` — check if relayer is running
- `POST /start` — start relayer (JSON body: `{ "useRealClients": true }` to use real clients)
- `POST /stop` — stop relayer
- `POST /submit-proof` — submit a bridge payload to the Miden client (for testing)

Real clients
------------

The relayer can use production-ready RPC clients when you set `useRealClients: true` in the `/start` endpoint or set it in the relayer config. You must provide working Zcash RPC node URL/credentials and a Miden node URL in `src/relayer/config.js` (or the environment variables referenced there).

Testing
-------

There is a minimal integration harness `src/relayer/sim-run.js` used by CI and manual testing.
