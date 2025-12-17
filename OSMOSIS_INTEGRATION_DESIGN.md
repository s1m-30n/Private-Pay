# Osmosis Integration Architecture

This document outlines the technical implementation of the Osmosis integration within PrivatePay, visualizing the component hierarchy and data flow using standard diagrams.

## 1. Provider Architecture
We integrated the **Cosmos Layer** by wrapping the existing provider tree. This ensures that Cosmos wallet context is available globally alongside Solana, Aptos, and Zcash.

```mermaid
graph TD
    Root[RootProvider] --> NP[NextUIProvider]
    NP --> SP[SolanaProvider]
    SP --> MP[MinaProvider]
    MP --> CP[CosmosProvider]
    CP --> ZP[ZcashProvider]
    ZP --> AP[AptosProvider]
```

## 2. Component Hierarchy & Flow
The `OsmosisPage` serves as the main entry point, composing the specialized privacy components and accessing the chain context.

```mermaid
graph TD
    Router[React Router] -->|/osmosis| Page[OsmosisPage.jsx]
    
    subgraph "Page Layout"
        Page --> Header[Header Section]
        Header --> PrivacyToggle[Privacy Mode Toggle]
        Header --> WalletBtn[CosmosWalletButton]
        
        Page --> Grid[Main Grid]
        Grid --> Balance[Asset Card]
        Grid --> Bridge[BridgeComponent]
        Grid --> Payment[PrivacyPayment]
    end

    subgraph "State & Hooks"
        Page -.->|useChain| Hook[Cosmos Kit Hook]
        Hook -.->|provides| Address[Wallet Address]
        Hook -.->|provides| Client[CosmWasm Client]
        Client -.->|fetches| OnChainData[OSMO Balance]
    end
```

## 3. Data Flow: Wallet Connection
How the application talks to Keplr behind the scenes.

```mermaid
sequenceDiagram
    participant User
    participant UI as OsmosisPage
    participant P as CosmosProvider
    participant K as Keplr Extension
    participant RPC as Osmosis Node

    User->>UI: Clicks "Connect Wallet"
    UI->>P: connect()
    P->>K: Request Access
    K-->>P: Approve Connection
    P-->>UI: Update Status (Connected)
    
    UI->>P: getCosmWasmClient()
    P->>K: Request OfflineSigner
    P->>RPC: Connect to Node
    RPC-->>UI: Authenticated Client
    
    UI->>RPC: query.bank.balance(address)
    RPC-->>UI: Balance Data
    UI->>UI: Update Display
```
