# Osmosis Relayer Backend

This service runs server-side to monitor the Osmosis Bridge Vault and relay assets to Zcash.

## Setup

1.  Navigate to the project root.
2.  Install dependencies (if not already):
    ```bash
    npm install @cosmjs/stargate @cosmjs/proto-signing
    ```

## Running the Relayer

You can run the relayer using the standalone script (create a runner script first) or integrate it into the main backend `index.js`.

### Example Runner

Create `run.js`:

```javascript
import { OsmosisRelayer, defaultConfig } from './backend/osmosis/relayer.js';

const relayer = new OsmosisRelayer(defaultConfig);
await relayer.initialize();
relayer.start();
```
