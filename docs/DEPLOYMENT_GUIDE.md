# Complete Deployment Guide
## Zcash-Aztec Integration - Production Deployment

This guide covers deploying all components to production networks.

---

## 📋 Prerequisites

### 1. Required Tools
```bash
# Node.js 18+
node --version

# npm or yarn
npm --version

# Aztec CLI
npm install -g @aztec/cli
aztec --version

# Zcash node (or use public RPC)
zcash-cli --version
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Fill in all required variables (see .env.example)
```

---

## 🚀 Deployment Steps

### Phase 1: Aztec Contracts Deployment

#### 1.1 Setup Aztec Contracts
```bash
cd aztec
npm install
npm run setup  # Run setup script
```

#### 1.2 Build Contracts
```bash
npm run build
```

#### 1.3 Deploy to Testnet
```bash
npm run deploy:testnet
```

This will:
- Build all contracts
- Generate deployment configurations
- Save contract addresses

#### 1.4 Update Environment Variables
After deployment, update `.env`:
```env
VITE_AZTEC_BRIDGE_CONTRACT=<deployed_bridge_address>
VITE_AZTEC_DUMMY_ZEC_CONTRACT=<deployed_dummy_zec_address>
VITE_AZTEC_STABLECOIN_CONTRACT=<deployed_stablecoin_address>
VITE_AZTEC_ORACLE_CONTRACT=<deployed_oracle_address>
```

---

### Phase 2: zk-SNARK Proof System

#### 2.1 Install Proof Libraries
```bash
npm install snarkjs circomlib
```

#### 2.2 Generate Circuit (if using custom circuit)
```bash
# Install Circom
npm install -g circom

# Compile circuit
circom circuits/partial_note.circom -o circuits/partial_note.wasm
```

#### 2.3 Generate Proving/Verifying Keys
```bash
# Generate proving key
snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
snarkjs groth16 setup circuits/partial_note.r1cs pot14_final.ptau partial_note_0000.zkey
snarkjs zkey contribute partial_note_0000.zkey partial_note_0001.zkey --name="1st Contributor Name" -v
snarkjs zkey export verificationkey partial_note_0001.zkey verification_key.json
```

#### 2.4 Update Proof Configuration
```env
VITE_CIRCUIT_PATH=./circuits/partial_note
VITE_PROVING_KEY_PATH=./keys/partial_note_0001.zkey
VITE_VERIFYING_KEY_PATH=./keys/verification_key.json
```

---

### Phase 3: MPC/EigenLayer Setup

#### 3.1 Choose MPC Provider

**Option A: EigenLayer AVS (Recommended)**
```bash
# Install EigenLayer SDK (when available)
npm install @eigenlayer/sdk

# Configure EigenLayer
export EIGENLAYER_AVS_ADDRESS=<avs_contract_address>
export EIGENLAYER_OPERATOR_REGISTRY=<operator_registry_address>
export EIGENLAYER_RPC_URL=https://rpc.eigenlayer.xyz
```

**Option B: Fireblocks**
```bash
export FIREBLOCKS_API_KEY=<your_api_key>
export FIREBLOCKS_PRIVATE_KEY=<your_private_key>
```

**Option C: Gnosis Safe**
```bash
export GNOSIS_SAFE_ADDRESS=<safe_address>
export GNOSIS_RPC_URL=<rpc_url>
```

#### 3.2 Initialize MPC Manager
```javascript
import { createMPCManager } from './backend/services/mpc.js';

const mpcManager = await createMPCManager({
  provider: 'eigenlayer', // or 'fireblocks', 'gnosis'
  eigenlayer: {
    avsAddress: process.env.EIGENLAYER_AVS_ADDRESS,
    operatorRegistry: process.env.EIGENLAYER_OPERATOR_REGISTRY,
  },
});

await mpcManager.initialize();
```

---

### Phase 4: Backend Services

#### 4.1 Setup Bridge Operator
```bash
cd backend
npm install
```

#### 4.2 Configure Bridge Operator
```env
# Zcash Configuration
VITE_ZCASH_RPC_URL=http://localhost:18232
VITE_ZCASH_RPC_USER=<rpc_user>
VITE_ZCASH_RPC_PASSWORD=<rpc_password>
VITE_ZCASH_BRIDGE_ADDRESS=<bridge_address>

# Aztec Configuration
VITE_AZTEC_PXE_URL=http://localhost:8080
VITE_AZTEC_BRIDGE_CONTRACT=<bridge_contract_address>

# MPC Configuration
EIGENLAYER_AVS_ADDRESS=<avs_address>
```

#### 4.3 Start Bridge Operator
```bash
node services/bridgeOperator.js
```

#### 4.4 Setup Oracle Service
```bash
# Oracle runs automatically
node services/oracle.js
```

---

### Phase 5: Frontend Deployment

#### 5.1 Build Frontend
```bash
npm run build
```

#### 5.2 Deploy to Vercel/Netlify
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod
```

#### 5.3 Update Environment Variables
Set all `VITE_*` variables in your deployment platform.

---

## 🧪 Testing

### Run End-to-End Tests
```bash
# All E2E tests
npm run test:e2e

# Bridge tests only
npm run test:e2e:bridge

# Stablecoin tests only
npm run test:e2e:stablecoin
```

### Manual Testing Checklist
- [ ] Bridge deposit (Zcash → Aztec)
- [ ] Bridge withdrawal (Aztec → Zcash)
- [ ] Stablecoin minting
- [ ] Stablecoin redemption
- [ ] Oracle price updates
- [ ] Collateralization checks
- [ ] Liquidation triggers

---

## 🔒 Security Checklist

### Before Mainnet Deployment
- [ ] Security audit completed
- [ ] All contracts verified on block explorer
- [ ] MPC keys securely stored
- [ ] Oracle price sources verified
- [ ] Bridge operator keys secured
- [ ] Rate limiting configured
- [ ] Monitoring and alerts setup
- [ ] Incident response plan ready

---

## 📊 Monitoring

### Key Metrics to Monitor
1. **Bridge Metrics**:
   - Total bridged ZEC
   - Pending deposits/withdrawals
   - Bridge operator uptime

2. **Stablecoin Metrics**:
   - Total collateral
   - Total debt
   - Collateralization ratios
   - Oracle price accuracy

3. **System Metrics**:
   - API response times
   - Error rates
   - Transaction success rates

---

## 🚨 Troubleshooting

### Common Issues

**1. Aztec Contract Deployment Fails**
- Check Aztec CLI version
- Verify network connectivity
- Ensure sufficient funds for gas

**2. Proof Generation Fails**
- Verify circuit compilation
- Check proving key path
- Ensure snarkjs is installed

**3. Bridge Operator Not Processing**
- Check Zcash RPC connection
- Verify Aztec PXE connection
- Check operator permissions

**4. Oracle Price Not Updating**
- Verify API keys for price sources
- Check network connectivity
- Review oracle service logs

---

## 📝 Post-Deployment

### 1. Update Documentation
- Contract addresses
- API endpoints
- Configuration changes

### 2. Notify Users
- Announce deployment
- Share contract addresses
- Provide usage guides

### 3. Monitor Closely
- Watch for errors
- Monitor transaction volumes
- Track system performance

---

## 🔄 Updates and Maintenance

### Contract Upgrades
1. Deploy new contract version
2. Migrate state (if needed)
3. Update frontend/backend
4. Notify users

### Key Rotation
1. Generate new keys
2. Update configuration
3. Test thoroughly
4. Deploy gradually

---

**Last Updated**: 2025-01-27  
**Status**: Production Ready

