# Starknet Contract Deployment Guide

## Prerequisites
You already have:
- ✅ starkli 0.4.2
- ✅ scarb 2.14.0
- ✅ ArgentX wallet with 100 STRK on Sepolia

## Step 1: Setup Starkli Account

### 1.1 Export your ArgentX Private Key
1. Open ArgentX browser extension
2. Click the hamburger menu (☰) → Settings
3. Click "Security & Recovery"
4. Click "Export Private Key"
5. Enter your password
6. Copy the private key (starts with `0x`)

### 1.2 Create Starkli Keystore
```bash
# Create keystore directory
mkdir -p ~/.starkli-wallets/deployer

# Create keystore from your private key
starkli signer keystore from-key ~/.starkli-wallets/deployer/keystore.json
# When prompted, paste your ArgentX private key
# Enter a password to encrypt the keystore
```

### 1.3 Fetch Account Descriptor
```bash
# Get your ArgentX wallet address from the extension (click to copy)
# Then fetch the account descriptor:
starkli account fetch <YOUR_ARGENTX_ADDRESS> \
  --rpc https://starknet-sepolia.public.blastapi.io/rpc/v0_7 \
  --output ~/.starkli-wallets/deployer/account.json
```

### 1.4 Set Environment Variables
```bash
# Add to your shell profile (~/.zshrc or ~/.bashrc)
export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json
export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json
export STARKNET_RPC=https://starknet-sepolia.public.blastapi.io/rpc/v0_7

# Then reload
source ~/.zshrc
```

## Step 2: Compile Contracts

```bash
cd /Users/anubhavsingh/Desktop/OpenSource/Private-Pay/starknet

# Clean and rebuild
scarb clean
scarb build
```

This creates compiled contracts in `target/dev/`:
- `privatepay_starknet_StealthAddress.contract_class.json`
- `privatepay_starknet_PaymentManager.contract_class.json`
- `privatepay_starknet_ZcashBridge.contract_class.json`
- `privatepay_starknet_PrivateLending.contract_class.json`
- `privatepay_starknet_AtomicSwap.contract_class.json`
- `privatepay_starknet_GaragaVerifier.contract_class.json`

## Step 3: Declare Contracts

Before deploying, you must declare each contract class:

```bash
cd /Users/anubhavsingh/Desktop/OpenSource/Private-Pay/starknet

# Declare StealthAddress
starkli declare target/dev/privatepay_starknet_StealthAddress.contract_class.json \
  --compiler-version 2.9.1

# Declare PaymentManager
starkli declare target/dev/privatepay_starknet_PaymentManager.contract_class.json \
  --compiler-version 2.9.1

# Declare ZcashBridge
starkli declare target/dev/privatepay_starknet_ZcashBridge.contract_class.json \
  --compiler-version 2.9.1

# Declare PrivateLending
starkli declare target/dev/privatepay_starknet_PrivateLending.contract_class.json \
  --compiler-version 2.9.1

# Declare AtomicSwap
starkli declare target/dev/privatepay_starknet_AtomicSwap.contract_class.json \
  --compiler-version 2.9.1

# Declare GaragaVerifier
starkli declare target/dev/privatepay_starknet_GaragaVerifier.contract_class.json \
  --compiler-version 2.9.1
```

**Save each class hash returned!** You'll need them for deployment.

## Step 4: Deploy Contracts

Replace `<CLASS_HASH>` with the class hash from the declare step:

```bash
# Deploy StealthAddress (no constructor args)
starkli deploy <STEALTH_CLASS_HASH>

# Deploy PaymentManager (constructor: owner address)
starkli deploy <PAYMENT_MANAGER_CLASS_HASH> <YOUR_WALLET_ADDRESS>

# Deploy ZcashBridge (constructor: owner address)
starkli deploy <ZCASH_BRIDGE_CLASS_HASH> <YOUR_WALLET_ADDRESS>

# Deploy PrivateLending (constructor: owner address)
starkli deploy <PRIVATE_LENDING_CLASS_HASH> <YOUR_WALLET_ADDRESS>

# Deploy AtomicSwap (no constructor args typically)
starkli deploy <ATOMIC_SWAP_CLASS_HASH>

# Deploy GaragaVerifier (no constructor args)
starkli deploy <GARAGA_VERIFIER_CLASS_HASH>
```

**Save each deployed contract address!**

## Step 5: Update Frontend

After deployment, create a `.env.local` file in the project root:

```bash
# /Users/anubhavsingh/Desktop/OpenSource/Private-Pay/.env.local

VITE_STARKNET_STEALTH_CONTRACT=0x<stealth_address>
VITE_STARKNET_PAYMENT_MANAGER=0x<payment_manager_address>
VITE_STARKNET_BRIDGE_CONTRACT=0x<zcash_bridge_address>
VITE_STARKNET_LENDING_CONTRACT=0x<private_lending_address>
VITE_STARKNET_SWAP_CONTRACT=0x<atomic_swap_address>
VITE_STARKNET_GARAGA_VERIFIER=0x<garaga_verifier_address>
```

Then restart the dev server:
```bash
npm run dev
```

## Quick Reference: Starknet Sepolia

- **Network**: Starknet Sepolia Testnet
- **Chain ID**: SN_SEPOLIA
- **RPC URLs**:
  - `https://starknet-sepolia.public.blastapi.io/rpc/v0_7`
  - `https://free-rpc.nethermind.io/sepolia-juno`
- **Explorer**: https://sepolia.starkscan.co/
- **Faucet**: https://starknet-faucet.vercel.app/

## Troubleshooting

### "Account not deployed"
Your ArgentX account must be deployed first. Send any transaction from ArgentX to deploy it.

### "Insufficient funds"
Make sure you have STRK for gas. Get from faucet: https://starknet-faucet.vercel.app/

### "Class hash already declared"
The contract class is already on-chain. Use the existing class hash for deployment.

### Version mismatch
If you get compiler version errors, try:
```bash
starkli declare <contract> --compiler-version 2.9.1
```
