#!/bin/bash

# PrivatePay Starknet Contract Deployment Script
# Deploys all contracts to Starknet Sepolia

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RPC_URL="https://starknet-sepolia.public.blastapi.io/rpc/v0_7"
CONTRACTS_DIR="target/dev"

# Output file for deployed addresses
DEPLOYED_FILE="deployed_addresses.txt"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PrivatePay Starknet Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if environment variables are set
if [ -z "$STARKNET_ACCOUNT" ] || [ -z "$STARKNET_KEYSTORE" ]; then
    echo -e "${RED}Error: STARKNET_ACCOUNT and STARKNET_KEYSTORE must be set${NC}"
    echo ""
    echo "Run these commands first:"
    echo "  export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json"
    echo "  export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json"
    exit 1
fi

echo -e "${YELLOW}Account file: $STARKNET_ACCOUNT${NC}"
echo ""

echo "Enter your wallet address (from ArgentX):"
read WALLET_ADDRESS
echo -e "${YELLOW}Deployer wallet: $WALLET_ADDRESS${NC}"
echo ""

# Create/clear deployed addresses file
echo "# PrivatePay Starknet Deployed Addresses" > $DEPLOYED_FILE
echo "# Network: Sepolia" >> $DEPLOYED_FILE
echo "# Date: $(date)" >> $DEPLOYED_FILE
echo "" >> $DEPLOYED_FILE

echo ""
echo -e "${GREEN}Starting deployment...${NC}"
echo ""

# Arrays to store results
declare -A CLASS_HASHES
declare -A CONTRACT_ADDRESSES

# Function to declare a contract
declare_contract() {
    local name=$1
    local file=$2
    
    echo -e "${YELLOW}Declaring: $name${NC}"
    
    OUTPUT=$(starkli declare "$CONTRACTS_DIR/$file" --rpc $RPC_URL --compiler-version 2.9.1 2>&1) || true
    
    # Extract class hash
    HASH=$(echo "$OUTPUT" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
    
    if [ -n "$HASH" ]; then
        echo -e "${GREEN}Class Hash: $HASH${NC}"
        CLASS_HASHES[$name]=$HASH
    else
        echo -e "${RED}Failed to declare $name${NC}"
        echo "$OUTPUT"
        exit 1
    fi
}

# Function to deploy a contract
deploy_contract() {
    local name=$1
    local args=$2
    
    echo -e "${YELLOW}Deploying: $name${NC}"
    
    HASH=${CLASS_HASHES[$name]}
    
    if [ -z "$args" ]; then
        OUTPUT=$(starkli deploy $HASH --rpc $RPC_URL 2>&1)
    else
        OUTPUT=$(starkli deploy $HASH $args --rpc $RPC_URL 2>&1)
    fi
    
    # Extract contract address
    ADDR=$(echo "$OUTPUT" | grep -oE '0x[a-fA-F0-9]{64}' | tail -1)
    
    if [ -n "$ADDR" ]; then
        echo -e "${GREEN}Deployed: $ADDR${NC}"
        CONTRACT_ADDRESSES[$name]=$ADDR
        echo "${name}=${ADDR}" >> $DEPLOYED_FILE
    else
        echo -e "${RED}Failed to deploy $name${NC}"
        echo "$OUTPUT"
        exit 1
    fi
    echo ""
}

# Step 1: Declare all contracts
echo -e "${GREEN}Step 1: Declaring contract classes...${NC}"
echo ""

declare_contract "StealthAddress" "privatepay_starknet_StealthAddressRegistry.contract_class.json"
declare_contract "PaymentManager" "privatepay_starknet_PaymentManager.contract_class.json"
declare_contract "ZcashBridge" "privatepay_starknet_ZcashBridge.contract_class.json"
declare_contract "PrivateLending" "privatepay_starknet_PrivateLending.contract_class.json"
declare_contract "AtomicSwap" "privatepay_starknet_AtomicSwap.contract_class.json"
declare_contract "GaragaVerifier" "privatepay_starknet_GaragaVerifier.contract_class.json"

echo ""
echo -e "${GREEN}Step 2: Deploying contracts...${NC}"
echo ""

deploy_contract "StealthAddress" ""
deploy_contract "PaymentManager" "$WALLET_ADDRESS"
deploy_contract "ZcashBridge" "$WALLET_ADDRESS"
deploy_contract "PrivateLending" "$WALLET_ADDRESS"
deploy_contract "AtomicSwap" ""
deploy_contract "GaragaVerifier" ""

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
cat $DEPLOYED_FILE
echo ""
echo -e "${YELLOW}Add to .env.local:${NC}"
echo ""
echo "VITE_STARKNET_STEALTH_CONTRACT=${CONTRACT_ADDRESSES[StealthAddress]}"
echo "VITE_STARKNET_PAYMENT_MANAGER=${CONTRACT_ADDRESSES[PaymentManager]}"
echo "VITE_STARKNET_BRIDGE_CONTRACT=${CONTRACT_ADDRESSES[ZcashBridge]}"
echo "VITE_STARKNET_LENDING_CONTRACT=${CONTRACT_ADDRESSES[PrivateLending]}"
echo "VITE_STARKNET_SWAP_CONTRACT=${CONTRACT_ADDRESSES[AtomicSwap]}"
echo "VITE_STARKNET_GARAGA_VERIFIER=${CONTRACT_ADDRESSES[GaragaVerifier]}"
