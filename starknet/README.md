# PrivatePay Starknet Contracts (Ztarknet)

Cairo smart contracts for cross-chain privacy bridge between Zcash and Starknet.

## Contracts

### StealthAddressRegistry
Manages stealth meta addresses for private payments following EIP-5564/BIP-0352.

**Functions:**
- `register_meta_address(spend_pub_key_x, spend_pub_key_y, viewing_pub_key_x, viewing_pub_key_y)` - Register a new meta address
- `get_meta_address(owner, index)` - Retrieve a meta address by owner and index
- `get_meta_address_count(owner)` - Get the number of meta addresses for an owner

### PaymentManager
Handles private payments to stealth addresses with view hints for efficient scanning.

**Functions:**
- `send_private_payment(recipient, stealth_address, ephemeral_pub_key_x, ephemeral_pub_key_y, amount, k, view_hint)` - Send a private payment
- `get_payment(payment_id)` - Retrieve payment details
- `get_payment_count()` - Get total number of payments

### ZcashBridge
Cross-chain bridge between Zcash shielded pool and Starknet.

**Deposit Flow (ZEC -> sZEC):**
1. User sends shielded ZEC to bridge vault on Zcash
2. Bridge operator registers deposit with `register_deposit()`
3. User claims sZEC on Starknet with `claim_szec()`

**Withdrawal Flow (sZEC -> ZEC):**
1. User burns sZEC with `burn_szec(amount, zcash_address_hash)`
2. Bridge operator processes and sends ZEC with `process_withdrawal()`

## Prerequisites

- [Scarb](https://docs.swmansion.com/scarb/) 2.8.0+
- [Starkli](https://github.com/xJonathanLEI/starkli) for deployment

## Build

```bash
cd starknet
scarb build
```

## Test

```bash
scarb test
```

## Deploy

### Testnet (Sepolia)

```bash
# Set up account
starkli account deploy --network sepolia

# Deploy StealthAddressRegistry
starkli deploy ./target/dev/privatepay_starknet_StealthAddressRegistry.contract_class.json \
  --network sepolia

# Deploy PaymentManager
starkli deploy ./target/dev/privatepay_starknet_PaymentManager.contract_class.json \
  --network sepolia

# Deploy ZcashBridge (requires operator address)
starkli deploy ./target/dev/privatepay_starknet_ZcashBridge.contract_class.json \
  <OPERATOR_ADDRESS> \
  --network sepolia
```

## Architecture

```
Zcash Shielded Pool
        |
        v
  [Bridge Vault] -----> [ZK Proof Generation]
        |                       |
        v                       v
  [Bridge Operator] <---- [Proof Verification]
        |
        v
  [ZcashBridge Contract on Starknet]
        |
        v
  [sZEC Tokens Minted]
        |
        v
  [StealthAddressRegistry + PaymentManager]
        |
        v
  [Private Stealth Payments on Starknet]
```

## Security Considerations

1. **Operator Trust**: The bridge operator is trusted to correctly register deposits. In production, use a decentralized operator set with threshold signatures.

2. **Proof Verification**: ZK proofs should be verified on-chain. Current implementation uses proof hashes for demo purposes.

3. **Stealth Keys**: Users must securely store their spend and viewing private keys. Loss of keys means loss of funds.

## License

MIT
