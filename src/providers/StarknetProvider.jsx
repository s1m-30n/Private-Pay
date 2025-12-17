/**
 * Starknet Provider
 * React context provider for Starknet wallet integration
 * Supports ArgentX and Braavos wallets
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { Contract, RpcProvider, uint256 } from "starknet";
import {
  STARKNET_CONFIG,
  getExplorerTxUrl,
  getAvailableWallets,
  getWalletExtension,
  truncateAddress,
  parseEthFromWei,
} from "../lib/starknet";

const StarknetContext = createContext({});

export const useStarknet = () => {
  const context = useContext(StarknetContext);
  if (!context) {
    throw new Error("useStarknet must be used within StarknetProvider");
  }
  return context;
};

export default function StarknetProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletType, setWalletType] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState({
    eth: "0",
    strk: "0",
    szec: "0",
    simulated: parseFloat(localStorage.getItem("simulated_szec_starknet") || "0"),
  });
  const [network, setNetwork] = useState(STARKNET_CONFIG.NETWORK);

  // Check for available wallets
  const availableWallets = useMemo(() => getAvailableWallets(), []);

  // Load persisted connection
  useEffect(() => {
    const storedWallet = localStorage.getItem("starknet_wallet_type");
    if (storedWallet) {
      reconnectWallet(storedWallet);
    }
  }, []);

  // Reconnect to previously connected wallet
  const reconnectWallet = async (walletId) => {
    try {
      const wallet = getWalletExtension(walletId);
      if (wallet && wallet.isConnected) {
        setAccount(wallet.selectedAddress);
        setProvider(wallet.provider);
        setIsConnected(true);
        setWalletType(walletId);
        if (wallet.chainId) {
          setChainId(wallet.chainId);
        }
        await updateBalance(wallet.selectedAddress);
      }
    } catch (error) {
      console.error("Failed to reconnect wallet:", error);
      localStorage.removeItem("starknet_wallet_type");
    }
  };

  // Connect wallet
  const connect = async (preferredWallet = "argentX") => {
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      let wallet = getWalletExtension(preferredWallet);

      // Fallback to any available wallet
      if (!wallet) {
        if (availableWallets.argentX) {
          wallet = getWalletExtension("argentX");
          preferredWallet = "argentX";
        } else if (availableWallets.braavos) {
          wallet = getWalletExtension("braavos");
          preferredWallet = "braavos";
        }
      }

      if (!wallet) {
        toast.error("Please install ArgentX or Braavos wallet");
        window.open("https://www.argent.xyz/argent-x/", "_blank");
        setIsConnecting(false);
        return;
      }

      // Enable the wallet
      await wallet.enable();

      if (wallet.isConnected) {
        const address = wallet.selectedAddress;
        setAccount(address);
        setProvider(wallet.provider);
        setIsConnected(true);
        setWalletType(preferredWallet);
        if (wallet.chainId) {
          setChainId(wallet.chainId);
        }

        // Persist connection
        localStorage.setItem("starknet_wallet_type", preferredWallet);

        // Update balance
        await updateBalance(address);

        toast.success(`Connected to ${preferredWallet === "argentX" ? "ArgentX" : "Braavos"}!`);

        // Set up event listeners
        setupWalletListeners(wallet);
      }
    } catch (error) {
      console.error("Failed to connect Starknet wallet:", error);
      toast.error(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  // Set up wallet event listeners
  const setupWalletListeners = (wallet) => {
    if (wallet.on) {
      wallet.on("accountsChanged", (accounts) => {
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
          updateBalance(accounts[0]);
        } else {
          disconnect();
        }
      });

      wallet.on("networkChanged", (newChainId) => {
        setChainId(newChainId);
        if (account) {
          updateBalance(account);
        }
      });
    }
  };

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setIsConnected(false);
    setWalletType(null);
    setChainId(null);
    setBalance({
      eth: "0",
      strk: "0",
      szec: "0",
      simulated: 0,
    });
    localStorage.removeItem("starknet_wallet_type");
    toast.success("Wallet disconnected");
  }, []);

  // Update balance
  const updateBalance = async (address) => {
    try {
      // For demo purposes, we use simulated balance
      // In production, query the actual token balances
      const simulated = parseFloat(localStorage.getItem("simulated_szec_starknet") || "0");

      setBalance(prev => ({
        ...prev,
        eth: "0.1", // Demo balance
        strk: "100", // Demo balance
        simulated,
      }));
    } catch (error) {
      console.error("Failed to update balance:", error);
    }
  };

  // Simulate deposit (for demo)
  const simulateDeposit = useCallback((amount) => {
    const numAmount = parseFloat(amount);
    const newSimulated = (balance.simulated || 0) + numAmount;
    setBalance(prev => ({
      ...prev,
      simulated: newSimulated,
    }));
    localStorage.setItem("simulated_szec_starknet", newSimulated.toString());
    toast.success(`Received incoming transfer: ${amount} sZEC (Simulated)`);
  }, [balance.simulated]);

  // Execute transaction
  const executeTransaction = async (calls) => {
    if (!account || !provider) {
      throw new Error("Wallet not connected");
    }

    const wallet = getWalletExtension(walletType);
    if (!wallet || !wallet.account) {
      throw new Error("Wallet account not available");
    }

    try {
      const result = await wallet.account.execute(calls);
      return result;
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  };

  // Sign message
  const signMessage = async (message) => {
    if (!account) {
      throw new Error("Wallet not connected");
    }

    const wallet = getWalletExtension(walletType);
    if (!wallet || !wallet.account) {
      throw new Error("Wallet account not available");
    }

    try {
      const signature = await wallet.account.signMessage(message);
      return signature;
    } catch (error) {
      console.error("Signing failed:", error);
      throw error;
    }
  };

  // ============ LENDING OPERATIONS ============

  // Deposit collateral to lending protocol
  const depositCollateral = async (amount, assetType) => {
    if (!account) throw new Error("Wallet not connected");

    const lendingAddress = STARKNET_CONFIG.LENDING_CONTRACT;
    if (!lendingAddress) {
      toast.error("Lending contract not configured");
      throw new Error("Lending contract not deployed");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("🏦 PRIVATE LENDING - DEPOSIT COLLATERAL");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 Contract: PrivateLending");
    console.log("📍 Address:", lendingAddress);
    console.log("🔧 Function: deposit_collateral()");
    console.log("💰 Amount:", amount, assetType);
    console.log("⏳ Sending transaction to Starknet Sepolia...");

    try {
      const amountUint256 = uint256.bnToUint256(BigInt(Math.floor(amount * 1e18)));
      const assetFelt = assetType === "ETH" ? "0x455448" : assetType === "STRK" ? "0x5354524b" : "0x735a4543";

      const result = await executeTransaction([{
        contractAddress: lendingAddress,
        entrypoint: "deposit_collateral",
        calldata: [amountUint256.low, amountUint256.high, assetFelt],
      }]);

      console.log("✅ Collateral Deposited!");
      console.log("🔗 Tx Hash:", result.transaction_hash);
      console.log("🌐 Explorer: https://sepolia.starkscan.co/tx/" + result.transaction_hash);
      console.log("═══════════════════════════════════════════════════════════\n");

      toast.success("Collateral deposited successfully!");
      return result;
    } catch (error) {
      console.error("❌ Deposit Failed:", error.message);
      toast.error(`Deposit failed: ${error.message}`);
      throw error;
    }
  };

  // Borrow against collateral
  const borrow = async (amount, collateralId) => {
    if (!account) throw new Error("Wallet not connected");

    const lendingAddress = STARKNET_CONFIG.LENDING_CONTRACT;
    if (!lendingAddress) {
      toast.error("Lending contract not configured");
      throw new Error("Lending contract not deployed");
    }

    try {
      const amountUint256 = uint256.bnToUint256(BigInt(Math.floor(amount * 1e18)));
      const collateralUint256 = uint256.bnToUint256(BigInt(collateralId));

      const result = await executeTransaction([{
        contractAddress: lendingAddress,
        entrypoint: "borrow",
        calldata: [amountUint256.low, amountUint256.high, collateralUint256.low, collateralUint256.high],
      }]);

      toast.success("Borrow successful!");
      return result;
    } catch (error) {
      toast.error(`Borrow failed: ${error.message}`);
      throw error;
    }
  };

  // Repay loan
  const repayLoan = async (loanId, amount) => {
    if (!account) throw new Error("Wallet not connected");

    const lendingAddress = STARKNET_CONFIG.LENDING_CONTRACT;
    if (!lendingAddress) {
      toast.error("Lending contract not configured");
      throw new Error("Lending contract not deployed");
    }

    try {
      const loanUint256 = uint256.bnToUint256(BigInt(loanId));
      const amountUint256 = uint256.bnToUint256(BigInt(Math.floor(amount * 1e18)));

      const result = await executeTransaction([{
        contractAddress: lendingAddress,
        entrypoint: "repay",
        calldata: [loanUint256.low, loanUint256.high, amountUint256.low, amountUint256.high],
      }]);

      toast.success("Loan repaid successfully!");
      return result;
    } catch (error) {
      toast.error(`Repay failed: ${error.message}`);
      throw error;
    }
  };

  // Withdraw collateral
  const withdrawCollateral = async (collateralId) => {
    if (!account) throw new Error("Wallet not connected");

    const lendingAddress = STARKNET_CONFIG.LENDING_CONTRACT;
    if (!lendingAddress) {
      toast.error("Lending contract not configured");
      throw new Error("Lending contract not deployed");
    }

    try {
      const collateralUint256 = uint256.bnToUint256(BigInt(collateralId));

      const result = await executeTransaction([{
        contractAddress: lendingAddress,
        entrypoint: "withdraw_collateral",
        calldata: [collateralUint256.low, collateralUint256.high],
      }]);

      toast.success("Collateral withdrawn successfully!");
      return result;
    } catch (error) {
      toast.error(`Withdrawal failed: ${error.message}`);
      throw error;
    }
  };

  // ============ ATOMIC SWAP OPERATIONS ============

  // Initiate atomic swap
  const initiateSwap = async (zecAmount, starknetAsset, starknetAmount, recipient, hashlock, timelock) => {
    if (!account) throw new Error("Wallet not connected");

    const swapAddress = STARKNET_CONFIG.SWAP_CONTRACT;
    if (!swapAddress) {
      toast.error("Swap contract not configured");
      throw new Error("Swap contract not deployed");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("🔄 ATOMIC SWAP - INITIATE");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 Contract: AtomicSwap (HTLC)");
    console.log("📍 Address:", swapAddress);
    console.log("🔧 Function: initiate_swap()");
    console.log("📦 Swap Details:");
    console.log("   • ZEC Amount:", zecAmount);
    console.log("   • Starknet Asset:", starknetAsset);
    console.log("   • Starknet Amount:", starknetAmount);
    console.log("   • Recipient:", recipient);
    console.log("   • Hashlock:", hashlock);
    console.log("   • Timelock:", timelock, "seconds");
    console.log("⏳ Sending transaction to Starknet Sepolia...");

    try {
      const zecUint256 = uint256.bnToUint256(BigInt(Math.floor(zecAmount * 1e8)));
      const starknetUint256 = uint256.bnToUint256(BigInt(Math.floor(starknetAmount * 1e18)));

      const result = await executeTransaction([{
        contractAddress: swapAddress,
        entrypoint: "initiate_swap",
        calldata: [
          zecUint256.low, zecUint256.high,
          starknetAsset,
          starknetUint256.low, starknetUint256.high,
          recipient,
          hashlock,
          timelock.toString(),
        ],
      }]);

      console.log("✅ Swap Initiated!");
      console.log("🔗 Tx Hash:", result.transaction_hash);
      console.log("🌐 Explorer: https://sepolia.starkscan.co/tx/" + result.transaction_hash);
      console.log("═══════════════════════════════════════════════════════════\n");

      toast.success("Swap initiated successfully!");
      return result;
    } catch (error) {
      console.error("❌ Swap Initiation Failed:", error.message);
      toast.error(`Swap initiation failed: ${error.message}`);
      throw error;
    }
  };

  // Claim atomic swap with preimage
  const claimSwap = async (swapId, preimage) => {
    if (!account) throw new Error("Wallet not connected");

    const swapAddress = STARKNET_CONFIG.SWAP_CONTRACT;
    if (!swapAddress) {
      toast.error("Swap contract not configured");
      throw new Error("Swap contract not deployed");
    }

    try {
      const swapUint256 = uint256.bnToUint256(BigInt(swapId));

      const result = await executeTransaction([{
        contractAddress: swapAddress,
        entrypoint: "claim_swap",
        calldata: [swapUint256.low, swapUint256.high, preimage],
      }]);

      toast.success("Swap claimed successfully!");
      return result;
    } catch (error) {
      toast.error(`Claim failed: ${error.message}`);
      throw error;
    }
  };

  // Refund expired swap
  const refundSwap = async (swapId) => {
    if (!account) throw new Error("Wallet not connected");

    const swapAddress = STARKNET_CONFIG.SWAP_CONTRACT;
    if (!swapAddress) {
      toast.error("Swap contract not configured");
      throw new Error("Swap contract not deployed");
    }

    try {
      const swapUint256 = uint256.bnToUint256(BigInt(swapId));

      const result = await executeTransaction([{
        contractAddress: swapAddress,
        entrypoint: "refund_swap",
        calldata: [swapUint256.low, swapUint256.high],
      }]);

      toast.success("Swap refunded successfully!");
      return result;
    } catch (error) {
      toast.error(`Refund failed: ${error.message}`);
      throw error;
    }
  };

  // ============ STEALTH ADDRESS OPERATIONS ============

  // Register meta address on-chain
  const registerMetaAddress = async (spendPubKeyX, spendPubKeyY, viewingPubKeyX, viewingPubKeyY) => {
    if (!account) throw new Error("Wallet not connected");

    const stealthRegistry = STARKNET_CONFIG.STEALTH_REGISTRY;
    if (!stealthRegistry) {
      toast.error("Stealth registry contract not configured");
      throw new Error("Stealth registry contract not deployed");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("🔐 STEALTH ADDRESS REGISTRATION");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 Contract: StealthAddressRegistry");
    console.log("📍 Address:", stealthRegistry);
    console.log("🔧 Function: register_meta_address()");
    console.log("📦 Calldata:");
    console.log("   • spend_pub_key_x:", spendPubKeyX);
    console.log("   • spend_pub_key_y:", spendPubKeyY);
    console.log("   • viewing_pub_key_x:", viewingPubKeyX);
    console.log("   • viewing_pub_key_y:", viewingPubKeyY);
    console.log("⏳ Sending transaction to Starknet Sepolia...");

    try {
      const result = await executeTransaction([{
        contractAddress: stealthRegistry,
        entrypoint: "register_meta_address",
        calldata: [spendPubKeyX, spendPubKeyY, viewingPubKeyX, viewingPubKeyY],
      }]);

      console.log("✅ Transaction Submitted!");
      console.log("🔗 Tx Hash:", result.transaction_hash);
      console.log("🌐 Explorer: https://sepolia.starkscan.co/tx/" + result.transaction_hash);
      console.log("═══════════════════════════════════════════════════════════\n");

      toast.success("Meta address registered on-chain!");
      return result;
    } catch (error) {
      console.error("❌ Registration Failed:", error.message);
      toast.error(`Registration failed: ${error.message}`);
      throw error;
    }
  };

  // Send private payment to stealth address
  const sendPrivatePayment = async (recipient, stealthAddress, ephemeralPubKeyX, ephemeralPubKeyY, amount, k, viewHint) => {
    if (!account) throw new Error("Wallet not connected");

    const paymentManager = STARKNET_CONFIG.PAYMENT_MANAGER;
    if (!paymentManager) {
      toast.error("Payment manager contract not configured");
      throw new Error("Payment manager contract not deployed");
    }

    try {
      const amountUint256 = uint256.bnToUint256(BigInt(Math.floor(amount * 1e18)));

      const result = await executeTransaction([{
        contractAddress: paymentManager,
        entrypoint: "send_private_payment",
        calldata: [
          recipient,
          stealthAddress,
          ephemeralPubKeyX,
          ephemeralPubKeyY,
          amountUint256.low,
          amountUint256.high,
          k.toString(),
          viewHint,
        ],
      }]);

      toast.success("Private payment sent!");
      return result;
    } catch (error) {
      toast.error(`Payment failed: ${error.message}`);
      throw error;
    }
  };

  // ============ BRIDGE OPERATIONS ============

  // Claim bridged sZEC tokens
  const claimBridgedTokens = async (ticketId) => {
    if (!account) throw new Error("Wallet not connected");

    const bridgeAddress = STARKNET_CONFIG.ZCASH_BRIDGE;
    if (!bridgeAddress) {
      toast.error("Bridge contract not configured");
      throw new Error("Bridge contract not deployed");
    }

    try {
      const result = await executeTransaction([{
        contractAddress: bridgeAddress,
        entrypoint: "claim_szec",
        calldata: [ticketId],
      }]);

      toast.success("sZEC claimed successfully!");
      await updateBalance(account);
      return result;
    } catch (error) {
      toast.error(`Claim failed: ${error.message}`);
      throw error;
    }
  };

  // Burn sZEC to withdraw to Zcash
  const burnForWithdrawal = async (amount, zcashAddressHash) => {
    if (!account) throw new Error("Wallet not connected");

    const bridgeAddress = STARKNET_CONFIG.ZCASH_BRIDGE;
    if (!bridgeAddress) {
      toast.error("Bridge contract not configured");
      throw new Error("Bridge contract not deployed");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("🌉 ZCASH BRIDGE - BURN sZEC FOR WITHDRAWAL");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 Contract: ZcashBridge");
    console.log("📍 Address:", bridgeAddress);
    console.log("🔧 Function: burn_szec()");
    console.log("📦 Withdrawal Details:");
    console.log("   • Amount:", amount, "sZEC");
    console.log("   • Zcash Address Hash:", zcashAddressHash);
    console.log("⏳ Sending transaction to Starknet Sepolia...");

    try {
      const amountUint256 = uint256.bnToUint256(BigInt(Math.floor(amount * 1e8)));

      const result = await executeTransaction([{
        contractAddress: bridgeAddress,
        entrypoint: "burn_szec",
        calldata: [amountUint256.low, amountUint256.high, zcashAddressHash],
      }]);

      console.log("✅ sZEC Burned Successfully!");
      console.log("🔗 Tx Hash:", result.transaction_hash);
      console.log("🌐 Explorer: https://sepolia.starkscan.co/tx/" + result.transaction_hash);
      console.log("📤 Withdrawal ID generated - ZEC will be sent to Zcash shielded address");
      console.log("═══════════════════════════════════════════════════════════\n");

      toast.success("Withdrawal initiated! ZEC will arrive shortly.");
      await updateBalance(account);
      return result;
    } catch (error) {
      console.error("❌ Withdrawal Failed:", error.message);
      toast.error(`Withdrawal failed: ${error.message}`);
      throw error;
    }
  };

  // Get explorer URL
  const getExplorerUrl = useCallback((txHash) => {
    return getExplorerTxUrl(txHash, network);
  }, [network]);

  // Context value
  const value = useMemo(() => ({
    // State
    account,
    isConnected,
    isConnecting,
    provider,
    walletType,
    chainId,
    network,
    balance: {
      eth: balance.eth,
      strk: balance.strk,
      szec: (parseFloat(balance.szec) + (balance.simulated || 0)).toFixed(4),
      simulated: balance.simulated,
    },
    availableWallets,

    // Actions
    connect,
    disconnect,
    executeTransaction,
    signMessage,
    simulateDeposit,
    updateBalance: () => updateBalance(account),
    getExplorerUrl,

    // Lending operations
    depositCollateral,
    borrow,
    repayLoan,
    withdrawCollateral,

    // Swap operations
    initiateSwap,
    claimSwap,
    refundSwap,

    // Stealth address operations
    registerMetaAddress,
    sendPrivatePayment,

    // Bridge operations
    claimBridgedTokens,
    burnForWithdrawal,

    // Utilities
    truncateAddress: (addr) => truncateAddress(addr || account),
  }), [
    account,
    isConnected,
    isConnecting,
    provider,
    walletType,
    chainId,
    network,
    balance,
    availableWallets,
    connect,
    disconnect,
    simulateDeposit,
    getExplorerUrl,
  ]);

  return (
    <StarknetContext.Provider value={value}>
      {children}
    </StarknetContext.Provider>
  );
}
