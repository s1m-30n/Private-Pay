## Aztec / L2 Privacy Integration – Detailed Architecture (Mermaid)

### Component Topology

```mermaid
flowchart LR
  subgraph Browser[User Browser]
    REACT[React App<br/>Vite + Router]
    AZTEC_DASH[Aztec Dashboard / PrivatePay Cards]
  end

  subgraph AztecL2[Aztec L2]
    ROLLUP[Aztec Rollup Sequencer]
    NOTES[Encrypted Notes Storage]
    BRIDGEPORTAL[Bridge / Portal Contracts]
    VIEWKEYS[Viewing Keys / Note Decryption]
  end

  subgraph L1[Ethereum L1]
    L1BRIDGE[L1 Bridge / Rollup Contract]
    L1TOKENS[L1 Tokens / Collateral]
  end

  subgraph ZcashSide[Zcash / External Chains]
    ZCASH[Zcash Chain]
    EXTERNAL[Other Chains (Aptos, Osmosis, etc.)]
  end

  REACT --> AZTEC_DASH

  AZTEC_DASH --> ROLLUP
  ROLLUP --> NOTES
  ROLLUP --> BRIDGEPORTAL

  BRIDGEPORTAL --> L1BRIDGE
  L1BRIDGE --> L1TOKENS

  BRIDGEPORTAL <-.- ZCASH
  BRIDGEPORTAL <-.- EXTERNAL
```

### High-Level Private Flow (Sequence)

```mermaid
sequenceDiagram
  participant User
  participant UI as Aztec Dashboard
  participant L1 as Ethereum L1
  participant Bridge as L1 Bridge / Portal
  participant Rollup as Aztec Rollup
  participant Notes as Encrypted Notes
  participant View as Viewing Key Holder

  User->>UI: Deposit from L1 into Aztec
  UI->>L1: send tx to Bridge (lock tokens)
  L1->>Bridge: lock funds, emit deposit event

  Bridge->>Rollup: proof of deposit
  Rollup->>Notes: create encrypted note for User

  User->>UI: Open Aztec balance view
  UI->>View: derive viewing key from wallet / meta-address
  View->>Notes: decrypt notes for User
  Notes-->>View: plain-text amounts
  View-->>UI: balances, note metadata

  User->>UI: Create private transfer / swap
  UI->>Rollup: submit encrypted transaction
  Rollup->>Notes: update nullifiers, new notes

  User->>UI: Withdraw to L1 or external chain
  UI->>Rollup: create withdrawal proof
  Rollup->>Bridge: submit proof
  Bridge->>L1: unlock tokens to User L1 address
```


