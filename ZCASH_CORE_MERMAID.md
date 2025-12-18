## Zcash Core Integration – Detailed Architecture (Mermaid)

### Component Topology

```mermaid
flowchart LR
  subgraph Browser[User Browser]
    REACT[React App<br/>Vite + Router]
    ZCASH_PAGE[ZcashPage.jsx<br/>/zcash]
    BRIDGE_PAGES[Bridge Pages<br/>(Solana, Starknet, Miden, Osmosis)]
    ZCASH_LIB[Zcash JS Libs<br/>zcash-bitcore-lib, proofs.js]
  end

  subgraph Backend
    RELAYER[Relayer / Orchestrator<br/>src/relayer/*]
    RELAYER_CFG[Relayer Config<br/>relayer/config.js]
  end

  subgraph ZcashNode[Zcash Node / Lightwalletd]
    RPC[Zcash RPC / Lightwalletd<br/>(ZCASH_RPC_URL)]
    WALLET[Zcash Wallet / Bridge Address<br/>(ZCASH_BRIDGE_ADDRESS)]
  end

  subgraph Integrations
    SOL_BRIDGE[Solana–Zcash Bridge]
    STARK_BRIDGE[Ztarknet Bridge]
    MIDEN_BRIDGE[Miden Bridge]
    OSMO_BRIDGE[Osmosis Vault / Bridge]
  end

  REACT --> ZCASH_PAGE
  REACT --> BRIDGE_PAGES

  ZCASH_PAGE --> ZCASH_LIB
  BRIDGE_PAGES --> ZCASH_LIB

  ZCASH_LIB --> RELAYER
  RELAYER --> RELAYER_CFG

  RELAYER --> RPC
  RPC --> WALLET

  RELAYER --> SOL_BRIDGE
  RELAYER --> STARK_BRIDGE
  RELAYER --> MIDEN_BRIDGE
  RELAYER --> OSMO_BRIDGE
```

### Core Zcash Interaction Flow (Sequence)

```mermaid
sequenceDiagram
  participant User
  participant UI as ZcashPage / Bridges
  participant Lib as Zcash JS Libs
  participant Relayer as Relayer Core
  participant RPC as Zcash RPC / Lightwalletd
  participant Wallet as Zcash Wallet / Bridge Addr

  User->>UI: View Zcash balances / bridge status
  UI->>Lib: derive addresses, build viewing keys
  Lib->>RPC: getAddressBalance, listUnspent, getTransactions
  RPC-->>Lib: balances, UTXOs, tx history
  Lib-->>UI: formatted balances + tx list

  User->>UI: Initiate Zcash deposit to any bridge
  UI->>Lib: buildZecTx(to=bridgeAddress, amount, memo)
  Lib->>RPC: sendrawtransaction(tx)
  RPC-->>Lib: txid
  Lib-->>UI: txid, status

  UI->>Relayer: notifyNewTx(txid, bridgeType)
  Relayer->>RPC: fetch tx, confirmations, outputs
  RPC-->>Relayer: full tx data

  Note over Relayer,Wallet: Relayer checks if output matches bridge address / memo scheme

  Relayer-->>UI: mark deposit as confirmed (per bridge logic)
  UI-->>User: show updated bridge / sZEC / ticket state
```


