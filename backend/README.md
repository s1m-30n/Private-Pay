# Bridge Backend & Relayer Services

Backend services for Zcash‑centric bridges (Aztec, Miden, Starknet, Solana, Osmosis).

## Services

### 1. Bridge Operator
Monitors Zcash and target chains, processes deposits and withdrawals for:

- Zcash ↔ Aztec
- Zcash ↔ Miden
- Zcash ↔ Starknet (Ztarknet)
- Zcash ↔ Solana (Helius Sol‑ZEC bridge)
- Zcash ↔ Osmosis vaults

### 2. Oracle Service
Fetches ZEC/USD price from multiple sources and exposes it to bridge logic and stablecoin flows.

## Setup

```bash
cd backend
npm install
```

## Configuration

Create `.env` file in `backend/` (these complement the root `.env` used by the frontend and relayer):

```env
# Zcash Configuration (matches root .env)
ZCASH_RPC_URL=http://localhost:18232
ZCASH_RPC_USER=zcashuser
ZCASH_RPC_PASSWORD=zcashpass
ZCASH_BRIDGE_ADDRESS=ztest...

# Aztec Configuration (optional)
AZTEC_PXE_URL=http://localhost:8080
AZTEC_BRIDGE_CONTRACT=0x...

# Oracle Configuration (optional)
COINMARKETCAP_API_KEY=your_key_here
```

See also the root‑level `RELAYER_README.md` and `docs/architecture/BRIDGE_ARCHITECTURE.md` for full details on how the backend, relayer, and bridges fit together.

## Run

```bash
npm start
```

## Development

```bash
npm run dev
```





