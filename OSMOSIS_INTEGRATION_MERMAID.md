## Osmosis / CosmosKit Integration – Detailed Architecture (Mermaid)

### Component Topology

```mermaid
flowchart LR
  subgraph Browser[User Browser]
    REACT[React App<br/>Vite + Router]
    OSMOSIS_PAGE[OsmosisPage.jsx<br/>/osmosis route]
    COSMOS_PROVIDER[CosmosProvider.jsx<br/>ChainProvider wrapper]
  end

  subgraph Wallets
    KEPLR[Keplr Wallet Extension]
    LEAP[Leap Wallet Extension]
  end

  subgraph CosmosKitLayer[CosmosKit]
    CKIT[ChainProvider<br/>@cosmos-kit/react]
    OSMOCHAIN[Osmosis Chain Config<br/>@chain-registry/osmosis]
  end

  subgraph OsmosisZone[Osmosis Chain]
    OSMO_RPC[OSMO RPC / LCD]
    OSMOPOOL[OSMO Pools / Vault Contracts]
    BRIDGEADDR[Zcash Bridge / Vault Address]
  end

  subgraph Backend
    API[Backend / Indexer (optional)]
  end

  REACT --> COSMOS_PROVIDER
  COSMOS_PROVIDER --> CKIT
  CKIT --> OSMOCHAIN

  COSMOS_PROVIDER --> OSMOSIS_PAGE

  OSMOSIS_PAGE -->|connect()| KEPLR
  OSMOSIS_PAGE -->|connect()| LEAP

  KEPLR -->|sign send / IBC tx| OSMO_RPC
  LEAP -->|sign send / IBC tx| OSMO_RPC

  OSMOSIS_PAGE -->|query balances, pools| OSMO_RPC
  OSMO_RPC --> OSMOPOOL
  OSMOPOOL --> BRIDGEADDR

  OSMOSIS_PAGE -->|analytics, history| API
  API --> OSMOPOOL
```

### User + Behind-the-Scenes Flow (Sequence)

```mermaid
sequenceDiagram
  participant User
  participant UI as OsmosisPage.jsx
  participant Ctx as CosmosProvider / ChainProvider
  participant Wallet as Keplr/Leap
  participant RPC as Osmosis RPC/LCD
  participant Pool as OSMO Pools / Bridge Vault
  participant API as Backend / Indexer

  User->>UI: Open /osmosis
  UI->>Ctx: initialize() – set Osmosis chain, endpoints

  User->>UI: Click "Connect Wallet"
  UI->>Ctx: getWallet()
  Ctx->>Wallet: connect(chainId=osmosis-*)
  Wallet-->>Ctx: accounts, pubkey
  Ctx-->>UI: wallet info, bech32 address

  UI->>Ctx: loadBalances()
  Ctx->>RPC: /cosmos/bank/v1beta1/balances/{address}
  RPC-->>Ctx: OSMO + IBC token balances
  Ctx-->>UI: balances, fiat est.

  User->>UI: Enter "Deposit to Private Vault (Zcash Bridge)"
  UI->>Ctx: buildSendTx(to=BRIDGEADDR, amount, memo=zcash_tag)
  Ctx->>Wallet: signAmino / signDirect(tx)
  Wallet-->>Ctx: signedTx
  Ctx->>RPC: broadcastTx(signedTx)
  RPC-->>Ctx: txHash
  Ctx-->>UI: tx pending, hash

  Note over RPC,Pool: block inclusion, state update, vault balance changes

  UI->>API: fetchHistory(address)
  API->>RPC: scan txs, memos, vault events
  RPC-->>API: tx list, events
  API-->>UI: structured "private deposit" history

  UI-->>User: show updated balances, bridge status, tx history
```


