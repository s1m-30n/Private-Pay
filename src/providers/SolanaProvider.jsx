import { useMemo, createContext, useContext, useState, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

// Arcium-specific context for MPC operations
const ArciumContext = createContext(null);

export function useArcium() {
  const context = useContext(ArciumContext);
  if (!context) {
    throw new Error("useArcium must be used within an ArciumProvider");
  }
  return context;
}

// Arcium Provider for MPC-specific functionality
function ArciumProvider({ children }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [mxePublicKey, setMxePublicKey] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Arcium connection
  const initializeArcium = useCallback(async (programId) => {
    if (!connection || !programId) return null;

    try {
      // This will be replaced with actual getMXEPublicKey call when @arcium-hq/client is installed
      // For now, we create a placeholder that will work with the actual implementation
      console.log("Initializing Arcium for program:", programId.toString());
      setIsInitialized(true);
      return true;
    } catch (error) {
      console.error("Failed to initialize Arcium:", error);
      return false;
    }
  }, [connection]);

  // Get computation accounts for Arcium operations
  const getComputationAccounts = useCallback((clusterOffset, computationOffset) => {
    // These will be populated when the actual Arcium client is used
    return {
      clusterOffset,
      computationOffset,
    };
  }, []);

  const value = useMemo(
    () => ({
      connection,
      publicKey,
      signTransaction,
      signAllTransactions,
      mxePublicKey,
      isInitialized,
      initializeArcium,
      getComputationAccounts,
    }),
    [
      connection,
      publicKey,
      signTransaction,
      signAllTransactions,
      mxePublicKey,
      isInitialized,
      initializeArcium,
      getComputationAccounts,
    ]
  );

  return (
    <ArciumContext.Provider value={value}>{children}</ArciumContext.Provider>
  );
}

// Main Solana Provider component
export default function SolanaProvider({ children }) {
  // Use devnet for Arcium testnet
  const endpoint = useMemo(
    () =>
      import.meta.env.VITE_SOLANA_RPC_URL ||
      clusterApiUrl("devnet"),
    []
  );

  // Configure supported wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ArciumProvider>{children}</ArciumProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Export useful hooks
export { useWallet, useConnection } from "@solana/wallet-adapter-react";



