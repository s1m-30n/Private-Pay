# Starknet Integration (Ztarknet)

## Overview

This document describes the Starknet integration for PrivatePay, enabling cross-chain privacy transfers between Zcash and Starknet. The integration follows the existing patterns used for Aptos, Mina, and Zcash integrations.

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "User Interface"
        A[StarknetPage.jsx] --> B[StarknetProvider]
        C[ZcashStarknetBridgePage.jsx] --> B
        C --> D[ZcashProvider]
    end

    subgraph "Library Layer"
        B --> E[lib/starknet/client.js]
        B --> F[lib/starknet/stealthAddress.js]
        B --> G[lib/starknet/bridge.js]
        D --> H[lib/zcash/]
    end

    subgraph "Starknet Network"
        E --> I[StealthAddressRegistry]
        E --> J[PaymentManager]
        G --> K[ZcashBridge]
    end

    subgraph "Zcash Network"
        H --> L[Shielded Pool]
    end

    K <-.->|Cross-Chain Relay| L

    style A fill:#9f7aea
    style C fill:#48bb78
    style I fill:#ed8936
    style J fill:#ed8936
    style K fill:#38b2ac
    style L fill:#ecc94b
```

### Component Architecture

```mermaid
graph LR
    subgraph "React Components"
        A[App.jsx] --> B[RootProvider]
        B --> C[StarknetProvider]
        C --> D[StarknetPage]
        C --> E[ZcashStarknetBridgePage]
    end

    subgraph "Provider Stack"
        B --> F[SolanaProvider]
        F --> G[MinaProvider]
        G --> H[ZcashProvider]
        H --> C
        C --> I[AptosProvider]
    end

    style C fill:#9f7aea
    style D fill:#9f7aea
    style E fill:#48bb78
```

### Smart Contract Architecture

```mermaid
classDiagram
    class StealthAddressRegistry {
        +Map~address,MetaAddress~ meta_addresses
        +Map~address,u32~ meta_address_count
        +register_meta_address()
        +get_meta_address()
        +get_meta_address_count()
    }

    class PaymentManager {
        +u256 payment_count
        +Map~u256,Payment~ payments
        +send_private_payment()
        +get_payment()
        +get_payment_count()
    }

    class ZcashBridge {
        +ContractAddress operator
        +u256 total_bridged
        +Map~felt252,Deposit~ deposits
        +Map~felt252,Withdrawal~ withdrawals
        +register_deposit()
        +claim_szec()
        +burn_szec()
        +process_withdrawal()
    }

    StealthAddressRegistry --> PaymentManager : references
    PaymentManager --> ZcashBridge : integrates
```

## Bridge Flow Diagrams

### Deposit Flow: Zcash → Starknet (ZEC → sZEC)

```mermaid
sequenceDiagram
    participant User
    participant ZcashWallet
    participant ZcashChain
    participant BridgeRelay
    participant StarknetBridge
    participant StarknetWallet

    Note over User,StarknetWallet: Deposit Flow (ZEC → sZEC)

    User->>ZcashWallet: 1. Initiate deposit
    ZcashWallet->>ZcashChain: 2. Send shielded TX to bridge vault
    ZcashChain-->>ZcashWallet: 3. TX confirmed + Ticket ID

    User->>User: 4. Generate ZK proof (SPV)

    BridgeRelay->>StarknetBridge: 5. register_deposit(ticket_id, proof)
    StarknetBridge->>StarknetBridge: 6. Verify proof hash
    StarknetBridge-->>BridgeRelay: 7. Deposit registered

    User->>StarknetBridge: 8. claim_szec(ticket_id)
    StarknetBridge->>StarknetBridge: 9. Verify not claimed
    StarknetBridge->>StarknetBridge: 10. Mint sZEC tokens
    StarknetBridge-->>StarknetWallet: 11. sZEC credited

    Note over User,StarknetWallet: User now has sZEC on Starknet
```

### Withdrawal Flow: Starknet → Zcash (sZEC → ZEC)

```mermaid
sequenceDiagram
    participant User
    participant StarknetWallet
    participant StarknetBridge
    participant BridgeOperator
    participant ZcashChain
    participant ZcashWallet

    Note over User,ZcashWallet: Withdrawal Flow (sZEC → ZEC)

    User->>StarknetWallet: 1. Initiate withdrawal
    StarknetWallet->>StarknetBridge: 2. burn_szec(amount, zcash_addr_hash)
    StarknetBridge->>StarknetBridge: 3. Burn sZEC tokens
    StarknetBridge->>StarknetBridge: 4. Record withdrawal request
    StarknetBridge-->>User: 5. Withdrawal ID returned

    BridgeOperator->>StarknetBridge: 6. Monitor WithdrawalInitiated events
    BridgeOperator->>BridgeOperator: 7. Decrypt zcash address

    BridgeOperator->>ZcashChain: 8. Send shielded TX to user
    ZcashChain-->>ZcashWallet: 9. ZEC received

    BridgeOperator->>StarknetBridge: 10. process_withdrawal(id, proof)
    StarknetBridge-->>BridgeOperator: 11. Withdrawal marked complete

    Note over User,ZcashWallet: User now has ZEC on Zcash
```

### Stealth Payment Flow

```mermaid
sequenceDiagram
    participant Sender
    participant StarknetUI
    participant Registry as StealthAddressRegistry
    participant Manager as PaymentManager
    participant Recipient

    Note over Recipient: Initial Setup (One-time)
    Recipient->>StarknetUI: 1. Generate meta address keys
    StarknetUI->>StarknetUI: 2. Create spend + viewing key pairs
    Recipient->>Registry: 3. register_meta_address(spend_pub, viewing_pub)
    Registry-->>Recipient: 4. Meta address registered

    Note over Sender,Recipient: Payment Flow
    Sender->>Registry: 5. get_meta_address(recipient, index)
    Registry-->>Sender: 6. (spend_pub_key, viewing_pub_key)

    Sender->>StarknetUI: 7. Generate ephemeral key pair
    Sender->>StarknetUI: 8. Compute stealth address (ECDH + SHA256)

    Sender->>Manager: 9. send_private_payment(...)
    Manager->>Manager: 10. Record payment with view hint
    Manager-->>Sender: 11. PrivatePaymentSent event

    Note over Recipient: Scanning & Claiming
    Recipient->>Manager: 12. Scan PrivatePaymentSent events
    Recipient->>Recipient: 13. Check view hint match
    Recipient->>Recipient: 14. Derive stealth private key
    Recipient->>Recipient: 15. Access funds at stealth address
```

## Cryptographic Flow

### Stealth Address Generation

```mermaid
flowchart TD
    A[Generate Ephemeral Key Pair] --> B[Compute Shared Secret]
    B --> C[Hash with Index k]
    C --> D[Derive Tweak]
    D --> E[Add to Spend Public Key]
    E --> F[Stealth Public Key]
    F --> G[Keccak256 Hash]
    G --> H[Truncate to felt252]
    H --> I[Starknet Stealth Address]

    subgraph "ECDH"
        B
    end

    subgraph "Key Derivation"
        C
        D
        E
    end

    subgraph "Address Generation"
        F
        G
        H
        I
    end
```

### Meta Address Key Structure

```mermaid
flowchart LR
    subgraph "Meta Address"
        A[Spend Key Pair]
        B[Viewing Key Pair]
    end

    A --> C[spend_private_key]
    A --> D[spend_public_key]
    B --> E[viewing_private_key]
    B --> F[viewing_public_key]

    D --> G[On-Chain Registry]
    F --> G

    C --> H[Secure Local Storage]
    E --> H

    style C fill:#ff6b6b
    style E fill:#ff6b6b
    style D fill:#4ecdc4
    style F fill:#4ecdc4
```

## File Structure

```
Private-Pay/
├── starknet/                           # Cairo Smart Contracts
│   ├── Scarb.toml                      # Package manifest
│   ├── README.md                       # Contract documentation
│   └── src/
│       ├── lib.cairo                   # Module root
│       ├── stealth_address.cairo       # Meta address registry
│       ├── payment_manager.cairo       # Stealth payments
│       └── zcash_bridge.cairo          # ZEC ↔ sZEC bridge
│
├── src/
│   ├── lib/starknet/                   # Frontend Library
│   │   ├── index.js                    # Main exports
│   │   ├── client.js                   # Starknet.js setup
│   │   ├── stealthAddress.js           # Stealth address crypto
│   │   ├── bridge.js                   # Bridge operations
│   │   └── constants.js                # Configuration
│   │
│   ├── providers/
│   │   └── StarknetProvider.jsx        # React context provider
│   │
│   ├── pages/
│   │   ├── StarknetPage.jsx            # Main dashboard
│   │   └── ZcashStarknetBridgePage.jsx # Bridge UI
│   │
│   └── components/
│       └── shared/
│           └── PrivacyNavbar.jsx       # Updated with Starknet links
│
└── STARKNET_INTEGRATION.md             # This file (root level)
```

## Configuration

### Environment Variables

```bash
# Starknet Configuration
VITE_STARKNET_NETWORK=testnet
VITE_STARKNET_RPC_URL=https://starknet-sepolia-rpc.publicnode.com
VITE_STARKNET_STEALTH_REGISTRY=<deployed_address>
VITE_STARKNET_PAYMENT_MANAGER=<deployed_address>
VITE_STARKNET_ZCASH_BRIDGE=<deployed_address>
VITE_STARKNET_SZEC_TOKEN=<deployed_address>
```

### Chain Configuration

```javascript
// Added to src/config.js
{
  id: "SN_SEPOLIA",
  name: "Starknet Sepolia",
  rpcUrl: "https://starknet-sepolia-rpc.publicnode.com",
  nativeToken: "ETH",
  blockExplorerUrl: "https://sepolia.starkscan.co",
  isTestnet: true,
  isStarknet: true,
}
```

## Wallet Support

### Supported Wallets

| Wallet | Status | Detection |
|--------|--------|-----------|
| ArgentX | Supported | `window.starknet_argentX` |
| Braavos | Supported | `window.starknet_braavos` |

### Connection Flow

```mermaid
flowchart TD
    A[User Clicks Connect] --> B{Wallet Detected?}
    B -->|ArgentX| C[Enable ArgentX]
    B -->|Braavos| D[Enable Braavos]
    B -->|None| E[Show Install Prompt]

    C --> F[Get Selected Address]
    D --> F

    F --> G[Set Account State]
    G --> H[Update Balance]
    H --> I[Setup Event Listeners]
    I --> J[Connection Complete]

    E --> K[Open Wallet Website]
```

## Security Considerations

### Key Management

1. **Private Keys**: Spend and viewing private keys are stored in browser localStorage. Users should back up these keys securely.

2. **Stealth Addresses**: Each payment generates a unique stealth address, ensuring transaction unlinkability.

3. **View Hints**: Only the first byte of the shared secret is revealed as a view hint, minimizing information leakage while enabling efficient scanning.

### Bridge Security

1. **Operator Trust**: The bridge currently uses a trusted operator model. In production, implement:
   - Multi-signature operator set
   - Threshold signatures (TSS)
   - Decentralized verification

2. **Proof Verification**: Current implementation uses proof hashes. Production should:
   - Verify full ZK proofs on-chain
   - Implement SPV proofs for Zcash transactions
   - Use Garaga for efficient elliptic curve operations

3. **Rate Limiting**: Implement deposit/withdrawal limits to prevent bridge drainage attacks.

## API Reference

### StarknetProvider

```typescript
interface StarknetContextValue {
  // State
  account: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: Provider | null;
  walletType: 'argentX' | 'braavos' | null;
  chainId: string | null;
  network: 'mainnet' | 'testnet';
  balance: {
    eth: string;
    strk: string;
    szec: string;
    simulated: number;
  };
  availableWallets: { argentX: boolean; braavos: boolean };

  // Actions
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  executeTransaction: (calls: Call[]) => Promise<TransactionResult>;
  signMessage: (message: any) => Promise<Signature>;
  simulateDeposit: (amount: number) => void;
  updateBalance: () => Promise<void>;
  getExplorerUrl: (txHash: string) => string;
  truncateAddress: (address?: string) => string;
}
```

### Stealth Address Functions

```typescript
// Generate new meta address keys
generateMetaAddressKeys(): {
  spend: { privateKey: string; publicKey: string };
  viewing: { privateKey: string; publicKey: string };
}

// Generate stealth address for payment
generateStealthAddress(
  spendPubKeyHex: string,
  viewingPubKeyHex: string,
  ephemeralPrivKey: Uint8Array,
  k?: number
): {
  stealthAddress: string;
  stealthPubKey: string;
  ephemeralPubKey: string;
  viewHint: string;
  k: number;
}

// Validate public key format
validatePublicKey(pubKeyHex: string): {
  valid: boolean;
  error?: string;
}
```

## Testing

### Unit Tests

```bash
# Run Cairo contract tests
cd starknet
scarb test
```

### Integration Tests

```bash
# Run frontend tests
npm run test
```

### Manual Testing Checklist

- [ ] ArgentX wallet connects successfully
- [ ] Braavos wallet connects successfully
- [ ] Meta address generation works
- [ ] Stealth address derivation is deterministic
- [ ] Bridge deposit flow completes
- [ ] Bridge withdrawal flow completes
- [ ] Simulated deposits update balance
- [ ] Navigation links work correctly
- [ ] Existing integrations (Aptos, Mina, Zcash) still function

## Deployment

### Cairo Contracts

```bash
# Install Scarb
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh

# Build contracts
cd starknet
scarb build

# Deploy using Starkli
starkli deploy ./target/dev/privatepay_starknet_StealthAddressRegistry.contract_class.json \
  --network sepolia

starkli deploy ./target/dev/privatepay_starknet_PaymentManager.contract_class.json \
  --network sepolia

starkli deploy ./target/dev/privatepay_starknet_ZcashBridge.contract_class.json \
  <OPERATOR_ADDRESS> \
  --network sepolia
```

### Frontend

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview build
npm run preview
```

## Private Lending Protocol

### Lending Architecture

```mermaid
graph TB
    subgraph "User Actions"
        A[Deposit Collateral] --> B[PrivateLending Contract]
        C[Borrow sZEC] --> B
        D[Repay Loan] --> B
        E[Liquidate] --> B
    end

    subgraph "Contract State"
        B --> F[Collaterals Map]
        B --> G[Loans Map]
        B --> H[Stealth Addresses]
    end

    subgraph "Privacy Layer"
        H --> I[Hidden Positions]
        I --> J[Unlinkable Deposits]
    end

    style B fill:#9f7aea
    style H fill:#48bb78
```

### Lending Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as LendingPage
    participant Contract as PrivateLending
    participant Stealth as StealthRegistry

    User->>UI: 1. Deposit collateral
    UI->>Stealth: 2. Generate stealth address
    Stealth-->>UI: 3. Stealth address
    UI->>Contract: 4. deposit_collateral(amount, type)
    Contract->>Contract: 5. Store with stealth addr
    Contract-->>User: 6. Collateral ID

    User->>UI: 7. Request borrow
    UI->>Contract: 8. borrow(amount, collateral_id)
    Contract->>Contract: 9. Check health factor
    Contract->>Contract: 10. Lock collateral
    Contract-->>User: 11. Loan ID + sZEC
```

## Atomic Swap (HTLC)

### Swap Architecture

```mermaid
graph LR
    subgraph "Zcash Side"
        A[ZEC Holder] --> B[Lock ZEC]
        B --> C[HTLC Contract]
    end

    subgraph "Starknet Side"
        D[ETH/STRK Holder] --> E[Lock Assets]
        E --> F[AtomicSwap Contract]
    end

    C <-.->|Same Hashlock| F

    G[Preimage Reveal] --> C
    G --> F

    style C fill:#ecc94b
    style F fill:#9f7aea
```

### Atomic Swap Flow

```mermaid
sequenceDiagram
    participant Alice as Alice (ZEC)
    participant ZcashHTLC as Zcash HTLC
    participant StarknetHTLC as AtomicSwap Contract
    participant Bob as Bob (ETH)

    Note over Alice,Bob: Phase 1: Setup
    Alice->>Alice: Generate secret preimage
    Alice->>Alice: Compute hashlock = hash(preimage)

    Note over Alice,Bob: Phase 2: Lock Assets
    Alice->>ZcashHTLC: Lock 10 ZEC with hashlock
    Bob->>StarknetHTLC: Lock 0.5 ETH with same hashlock

    Note over Alice,Bob: Phase 3: Claim
    Alice->>StarknetHTLC: claim_swap(preimage)
    StarknetHTLC->>StarknetHTLC: Verify hash(preimage) == hashlock
    StarknetHTLC-->>Alice: 0.5 ETH

    Bob->>ZcashHTLC: Claim with revealed preimage
    ZcashHTLC-->>Bob: 10 ZEC

    Note over Alice,Bob: Swap Complete!
```

## Cross-Chain Relay Orchestrator

### Relay Architecture

```mermaid
graph TB
    subgraph "Zcash Network"
        A[Shielded Pool] --> B[Lightwalletd]
    end

    subgraph "Relay Layer"
        C[RelayOrchestrator] --> D[Event Listener]
        C --> E[Message Queue]
        C --> F[State Manager]
    end

    subgraph "Starknet Network"
        G[ZcashBridge] --> H[Events]
        I[AtomicSwap] --> H
        J[PrivateLending] --> H
    end

    B --> D
    H --> D
    E --> G
    E --> I

    style C fill:#38b2ac
    style D fill:#ed8936
```

### Message Flow

```mermaid
sequenceDiagram
    participant Zcash as Zcash Chain
    participant Relay as RelayOrchestrator
    participant Starknet as Starknet Chain

    loop Poll Events
        Relay->>Zcash: Check for deposits
        Zcash-->>Relay: New shielded TX
        Relay->>Relay: Queue deposit message
    end

    loop Process Queue
        Relay->>Relay: Dequeue message
        Relay->>Starknet: register_deposit()
        Starknet-->>Relay: Deposit confirmed
        Relay->>Relay: Emit deposit:verified
    end
```

## Garaga Verifier

### Cryptographic Operations

```mermaid
graph LR
    subgraph "Input"
        A[Message Hash]
        B[Signature r,s]
        C[Public Key]
    end

    subgraph "Garaga Verifier"
        D[ECDSA Verify]
        E[Schnorr Verify]
        F[Groth16 Verify]
        G[Pedersen Commit]
    end

    subgraph "Output"
        H[Valid/Invalid]
    end

    A --> D
    B --> D
    C --> D
    D --> H

    style D fill:#ed8936
    style F fill:#48bb78
```

## Complete System Architecture

```mermaid
graph TB
    subgraph "Frontend"
        A[StarknetPage] --> B[StarknetProvider]
        C[ZcashStarknetBridgePage] --> B
        D[ZtarknetLendingPage] --> B
        E[ZtarknetSwapPage] --> B
    end

    subgraph "Library Layer"
        B --> F[client.js]
        B --> G[stealthAddress.js]
        B --> H[bridge.js]
        B --> I[relay.js]
    end

    subgraph "Smart Contracts"
        J[StealthAddressRegistry]
        K[PaymentManager]
        L[ZcashBridge]
        M[PrivateLending]
        N[AtomicSwap]
        O[GaragaVerifier]
    end

    F --> J
    F --> K
    H --> L
    I --> L
    I --> N
    D --> M
    E --> N
    O --> L
    O --> N

    style B fill:#9f7aea
    style I fill:#38b2ac
    style O fill:#ed8936
```

## License

MIT

---

*Last updated: December 2024*
*Integration by: PrivatePay Team*
