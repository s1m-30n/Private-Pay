## Starknet + Ztarknet (Zcash Bridge, Lending, Swap) – Detailed Architecture (Mermaid)

### Component Topology

```mermaid
flowchart LR
  subgraph Browser[User Browser]
    REACT[React App<br/>Vite + Router]
    STARKNET_PAGE[StarknetPage.jsx<br/>/starknet]
    BRIDGE_PAGE[ZcashStarknetBridgePage.jsx<br/>/zcash-starknet-bridge]
    LEND_PAGE[ZtarknetLendingPage.jsx<br/>/ztarknet-lending]
    SWAP_PAGE[ZtarknetSwapPage.jsx<br/>/ztarknet-swap]
    STARKNET_PROVIDER[StarknetProvider.jsx<br/>useStarknet() context]
  end

  subgraph Wallet
    ARGENTX[ArgentX Wallet]
    BRAAVOS[Braavos Wallet]
  end

  subgraph StarknetSepolia[Starknet Sepolia]
    REG[Stealth Registry<br/>(VITE_STARKNET_STEALTH_CONTRACT)]
    PM[Payment Manager<br/>(VITE_STARKNET_PAYMENT_MANAGER)]
    BRIDGE[Zcash Bridge Contract<br/>(VITE_STARKNET_BRIDGE_CONTRACT)]
    LEND[Lending Contract<br/>(VITE_STARKNET_LENDING_CONTRACT)]
    SWAP[Swap Contract<br/>(VITE_STARKNET_SWAP_CONTRACT)]
    SZEC[sZEC Token<br/>(VITE_STARKNET_SZEC_TOKEN)]
    GARAGA[Garaga Verifier<br/>(VITE_STARKNET_GARAGA_VERIFIER)]
  end

  subgraph ZcashSide[Zcash]
    ZECCHAIN[Zcash Chain]
    ZECBRIDGE[Zcash Bridge Address]
  end

  subgraph Relayer
    RELAYER[Zcash–Starknet Relayer<br/>relay.js + bridge.js]
  end

  REACT --> STARKNET_PROVIDER
  STARKNET_PROVIDER --> STARKNET_PAGE
  STARKNET_PROVIDER --> BRIDGE_PAGE
  STARKNET_PROVIDER --> LEND_PAGE
  STARKNET_PROVIDER --> SWAP_PAGE

  STARKNET_PAGE -->|connect()| ARGENTX
  STARKNET_PAGE -->|connect()| BRAAVOS
  BRIDGE_PAGE --> ARGENTX
  LEND_PAGE --> ARGENTX
  SWAP_PAGE --> ARGENTX

  ARGENTX -->|register meta-address| REG
  ARGENTX -->|send private payment| PM
  ARGENTX -->|bridge deposit / withdraw| BRIDGE
  ARGENTX -->|deposit collateral| LEND
  ARGENTX -->|create / fill swaps| SWAP

  BRIDGE --> SZEC
  BRIDGE <-.-|Zcash proof / commitments| ZECCHAIN

  LEND --> SZEC
  SWAP --> SZEC

  GARAGA --> BRIDGE
  GARAGA --> LEND
  GARAGA --> SWAP

  RELAYER --> ZECCHAIN
  RELAYER --> BRIDGE
```

### Starknet Private Payment + Bridge Flow (Sequence)

```mermaid
sequenceDiagram
  participant User
  participant UI as StarknetPage.jsx
  participant Ctx as StarknetProvider / useStarknet
  participant Wallet as ArgentX/Braavos
  participant Reg as Stealth Registry
  participant PM as Payment Manager
  participant Bridge as Zcash Bridge Contract
  participant SZEC as sZEC Token
  participant ZEC as Zcash Chain
  participant Relayer as RelayOrchestrator

  User->>UI: Open /starknet
  UI->>Ctx: initialize() – network, contracts from env

  User->>UI: Click "Connect Wallet"
  UI->>Ctx: connectWallet()
  Ctx->>Wallet: connect()
  Wallet-->>Ctx: account address
  Ctx-->>UI: wallet + provider

  User->>UI: Generate meta-address
  UI->>Ctx: generateStealthMetaAddress()
  Ctx->>Reg: register(metaAddress)
  Reg-->>Ctx: tx hash
  Ctx-->>UI: metaAddress + hash

  User->>UI: Receive private payment
  UI->>PM: queryIncomingPayments(metaAddress)
  PM-->>UI: list of commitments / amounts

  Note over PM,Reg: payments locked as stealth commitments tied to meta-address

  User->>UI: Open /zcash-starknet-bridge
  UI->>Ctx: bridgeDeposit(amount, zcashAddress/meta)
  Ctx->>Wallet: sign and send tx to Bridge
  Wallet->>Bridge: depositZEC(amount, zcashCommitment)
  Bridge->>SZEC: mint sZEC to user

  Note over Bridge,ZEC: Relayer picks Zcash tx / commitments and finalizes

  Bridge-->>Relayer: event logs (deposit)
  Relayer->>ZEC: verify Zcash side, update off-chain state

  User->>UI: Later call withdrawZEC(amount, proof)
  UI->>Ctx: bridgeWithdraw(amount, proof)
  Ctx->>Wallet: sign withdraw tx
  Wallet->>Bridge: burn sZEC, request Zcash payout
  Bridge->>SZEC: burn sZEC
  Bridge-->>Relayer: withdraw event
  Relayer->>ZEC: construct Zcash tx to user shielded address
  ZEC-->>Relayer: txid, confirmations
  Relayer-->>UI: updated status
  UI-->>User: show bridge completion
```


