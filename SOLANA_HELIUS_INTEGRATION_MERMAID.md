## Solana + Helius + Zcash Bridge – Detailed Architecture (Mermaid)

### Component Topology

```mermaid
flowchart LR
  subgraph Browser[User Browser]
    REACT[React App<br/>Vite + Router]
    BRIDGE_PAGE[SolanaZcashBridgePage.jsx<br/>/solana-zcash-bridge]
    SOLANA_PROVIDER[SolanaProvider.jsx<br/>HeliusSolanaProvider]
  end

  subgraph Wallets
    PHANTOM[Phantom Wallet]
    SOLFLARE[Solflare Wallet]
  end

  subgraph SolanaDevnet[Solana Devnet]
    ZBRIDGE[zcash_bridge Program<br/>(VITE_ZCASH_BRIDGE_PROGRAM_ID)]
    VAULT[Bridge Vault PDA]
    META[Stealth Meta-Address PDA Accounts]
    TICKETS[Deposit / Withdraw Ticket Accounts]
    USDC[USDC Mint<br/>(VITE_USDC_MINT)]
  end

  subgraph HeliusInfra[Helius]
    HELIUS[Helius RPC + APIs<br/>(VITE_HELIUS_API_KEY)]
  end

  subgraph ZcashSide[Zcash]
    ZECCHAIN[Zcash Chain<br/>(VITE_ZCASH_NETWORK)]
    ZECBRIDGE[Zcash Bridge Address<br/>(ZCASH_BRIDGE_ADDRESS)]
  end

  subgraph Relayer
    RELAYER[Solana–Zcash Relayer<br/>(Node.js)]
  end

  REACT --> SOLANA_PROVIDER
  SOLANA_PROVIDER --> BRIDGE_PAGE

  BRIDGE_PAGE -->|connect()| PHANTOM
  BRIDGE_PAGE -->|connect()| SOLFLARE

  PHANTOM -->|sign deposit/withdraw ix| ZBRIDGE
  SOLFLARE -->|sign deposit/withdraw ix| ZBRIDGE

  ZBRIDGE --> VAULT
  ZBRIDGE --> META
  ZBRIDGE --> TICKETS
  ZBRIDGE --> USDC

  BRIDGE_PAGE -->|priority fees, tx parse| HELIUS
  HELIUS --> ZBRIDGE

  RELAYER -->|subscribe via Helius| HELIUS
  RELAYER -->|submit proofs| ZECCHAIN
  ZECCHAIN --> ZECBRIDGE
```

### Deposit / Withdraw Flow (Sequence)

```mermaid
sequenceDiagram
  participant User
  participant UI as SolanaZcashBridgePage.jsx
  participant Ctx as SolanaProvider / Helius client
  participant Wallet as Phantom/Solflare
  participant H as Helius RPC/API
  participant Prog as zcash_bridge Program
  participant Vault as Bridge Vault
  participant Ticket as Ticket PDA
  participant Relayer as Zcash Relayer
  participant ZEC as Zcash Chain

  User->>UI: Open /solana-zcash-bridge
  UI->>Ctx: initialize() – connect to devnet, load program IDs

  User->>UI: Click "Connect Wallet"
  UI->>Ctx: connectWallet()
  Ctx->>Wallet: connect()
  Wallet-->>Ctx: publicKey
  Ctx-->>UI: wallet + connection

  User->>UI: Select "Deposit SOL → ZEC" and amount
  UI->>Ctx: buildDepositIx(amount, metaAddress)
  Ctx->>H: getPriorityFeeEstimate()
  H-->>Ctx: fee suggestions
  Ctx-->>UI: transaction with fees, ix

  UI->>Wallet: signAndSendTransaction(tx)
  Wallet->>Prog: invoke deposit (create Ticket, move SOL to Vault)
  Prog->>Vault: update balance
  Prog->>Ticket: store metadata (amount, stealth meta-address)

  Note over Prog,H: Helius sees confirmed tx, parses logs + accounts

  H-->>Relayer: webhook / parsed transaction with Ticket info
  Relayer->>ZEC: create ZEC tx to user's Zcash address / stealth scheme
  ZEC-->>Relayer: txid, confirmations
  Relayer-->>UI: (via backend) status + ZEC txid
  UI-->>User: show \"Deposit complete\" and ZEC tx link

  User->>UI: Later choose \"Withdraw ZEC → SOL\"
  User->>UI: Paste ZEC txid / proof
  UI->>Ctx: buildWithdrawIx(ticket, proof)
  Ctx->>Wallet: signAndSendTransaction(tx)
  Wallet->>Prog: invoke withdraw (redeem Ticket, release SOL/USDC)
  Prog->>Ticket: mark spent
  Prog->>Wallet: transfer SOL/USDC back
  UI-->>User: show final Solana receipt
```


