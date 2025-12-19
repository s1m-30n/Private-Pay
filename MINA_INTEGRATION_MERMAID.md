## Mina Integration – Detailed Architecture (Mermaid)

### Component Topology

```mermaid
flowchart LR
  subgraph Browser[User Browser]
    REACT[React App<br/>Vite + React Router]
    MINA_PAGE[MinaPage.jsx<br/>/mina route]
    MINA_PROVIDER[MinaProvider.jsx<br/>Mina context]
  end

  subgraph WalletSide
    AURO[Auro Wallet<br/>(window.mina)]
  end

  subgraph ChainSide[Mina Network]
    MINA_RPC[Mina Archive / GraphQL Endpoint]
    ZKAPP[PrivatePay Mina zkApp<br/>(zk-SNARK logic)]
  end

  subgraph Config[Config / Env]
    ENV_VARS[Env Vars<br/>VITE_WEBSITE_HOST,<br/>Mina endpoints]
  end

  REACT --> MINA_PAGE
  REACT --> MINA_PROVIDER

  MINA_PROVIDER -->|injects| MINA_PAGE
  MINA_PROVIDER -->|reads| ENV_VARS

  MINA_PAGE -->|connect()| AURO
  AURO -->|exposes account, network| MINA_PROVIDER

  MINA_PAGE -->|load balance, zkApp state| MINA_PROVIDER
  MINA_PROVIDER -->|GraphQL queries| MINA_RPC

  MINA_PAGE -->|build tx payload| MINA_PROVIDER
  MINA_PROVIDER -->|create zkApp tx| ZKAPP
  AURO -->|sign & send tx| ZKAPP

  ZKAPP --> MINA_RPC
  MINA_RPC --> MINA_PROVIDER
  MINA_PROVIDER --> MINA_PAGE
```

### Payment Flow (Sequence)

```mermaid
sequenceDiagram
  participant User
  participant UI as MinaPage.jsx
  participant Ctx as MinaProvider (Context)
  participant Wallet as Auro (window.mina)
  participant Node as Mina GraphQL / Archive
  participant ZkApp as PrivatePay zkApp

  User->>UI: Open /mina
  UI->>Ctx: initialize() – read env, set network

  User->>UI: Click \"Connect Auro\"
  UI->>Wallet: requestAccounts()
  Wallet-->>UI: accounts, network
  UI->>Ctx: setAccount(account)

  UI->>Ctx: loadBalances()
  Ctx->>Node: GraphQL query (account, zkApp state)
  Node-->>Ctx: balances, zkApp fields
  Ctx-->>UI: state (Mina balance, zkApp view)

  User->>UI: Submit private payment form
  UI->>Ctx: buildPaymentTx(metaAddress, amount)
  Ctx->>ZkApp: construct zkApp tx (o1js)
  Ctx-->>UI: unsigned tx payload

  UI->>Wallet: signTransaction(payload)
  Wallet-->>UI: signed tx
  UI->>Wallet: sendTransaction(signed tx)

  Wallet->>Node: broadcast tx
  Node-->>ZkApp: update zkApp state

  Note over Node,ZkApp: block produced, zk-SNARK verified

  UI->>Ctx: poll for updated zkApp state
  Ctx->>Node: GraphQL query (zkApp state)
  Node-->>Ctx: updated commitments / balances
  Ctx-->>UI: refreshed state
  UI-->>User: show confirmed private payment
```


