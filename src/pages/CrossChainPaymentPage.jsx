import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, Input, Select, SelectItem, Spinner, Chip, Tabs, Tab } from "@nextui-org/react";
import toast from "react-hot-toast";
import { useAxelarPayment, TX_STATUS } from "../hooks/useAxelarPayment.js";
import { scanStealthPayments, deriveStealthPrivateKey, ERC20_ABI, GATEWAY_ABI } from "../lib/axelar/crossChainPayment.js";
import { AXELAR_CHAINS, getSupportedChains, getAxelarscanUrl, getAvailableTokens } from "../lib/axelar/index.js";
import { deriveKeysFromSignature } from "../lib/aptos/stealthAddress.js";
import { ArrowLeftRight, Shield, Send, Eye, CheckCircle2, AlertCircle, Zap, ExternalLink, ArrowDown, ArrowUp, Coins } from "lucide-react";

// Bridge contract address (same on all chains)
const BRIDGE_ADDRESS = import.meta.env.VITE_AXELAR_BRIDGE_ADDRESS || "0x1764681c26D04f0E9EBb305368cfda808A9F6f8f";

// Bridge ABI for meta address lookup and registration
const BRIDGE_ABI = [
  "function getMetaAddress(address user) external view returns (bytes spendPubKey, bytes viewingPubKey)",
  "function registerMetaAddress(bytes spendPubKey, bytes viewingPubKey) external",
];

// Network detection
const isMainnet = import.meta.env.VITE_NETWORK === "mainnet";

// Fallback tokens if API fails
const FALLBACK_TOKENS = isMainnet
  ? [{ symbol: "axlUSDC", name: "Axelar USDC", decimals: 6 }]
  : [{ symbol: "TUSDC", name: "Test USDC", decimals: 6 }]; // Our deployed test token at 0x5EF8B232E6e5243bf9fAe7E725275A8B0800924B

export default function CrossChainPaymentPage() {
  const navigate = useNavigate();
  const {
    sendCrossChainPayment,
    estimateGas,
    reset,
    loading,
    txStatus,
    txHash,
    error,
    gasEstimate,
    getStatusLabel,
    isComplete,
    isFailed,
    isProcessing,
  } = useAxelarPayment();

  // EVM Wallet State
  const [evmAddress, setEvmAddress] = useState(null);
  const [evmConnecting, setEvmConnecting] = useState(false);
  const [chainId, setChainId] = useState(null);

  const [sourceChain, setSourceChain] = useState("");
  const [destinationChain, setDestinationChain] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("");
  const [availableTokens, setAvailableTokens] = useState(FALLBACK_TOKENS);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [estimatingGas, setEstimatingGas] = useState(false);

  // Stealth mode state
  const [stealthMode, setStealthMode] = useState(null); // null = checking, true = stealth, false = direct
  const [recipientMetaAddress, setRecipientMetaAddress] = useState(null);
  const [checkingStealthKeys, setCheckingStealthKeys] = useState(false);

  // Scanning State
  const [scanning, setScanning] = useState(false);
  const [scannedPayments, setScannedPayments] = useState([]);
  const [withdrawing, setWithdrawing] = useState(null); // ID of payment being withdrawn

  // Registration state
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Check if current user is registered for stealth
  useEffect(() => {
    async function checkUserRegistration() {
      if (!evmAddress || !window.ethereum) {
        setIsRegistered(false);
        return;
      }

      setCheckingRegistration(true);
      try {
        const { ethers } = await import("ethers");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const bridgeContract = new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI, provider);

        const [spendPubKey, viewingPubKey] = await bridgeContract.getMetaAddress(evmAddress);
        const spendPubKeyHex = ethers.hexlify(spendPubKey);

        if (spendPubKeyHex !== "0x" && spendPubKeyHex.length > 2) {
          setIsRegistered(true);
          console.log("User is registered for stealth payments");
        } else {
          setIsRegistered(false);
          console.log("User is NOT registered for stealth payments");
        }
      } catch (err) {
        console.log("Error checking registration:", err.message);
        setIsRegistered(false);
      } finally {
        setCheckingRegistration(false);
      }
    }

    checkUserRegistration();
  }, [evmAddress]);

  // Register with signature (Deterministic)
  const handleRegisterWithSignature = async () => {
    if (!evmAddress) {
      toast.error("Please connect wallet first");
      return;
    }

    setRegistering(true);
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // 1. Request signature
      const message = "Sign this message to enable Stealth Payments on PrivatePay.\n\nThis signature will be used to generate your unique stealth keys deterministically.\n\nIMPORTANT: Signing this does not cost gas.";
      const signature = await signer.signMessage(message);
      const signatureHash = ethers.keccak256(signature);

      // 2. Derive keys
      console.log("Deriving keys from signature...");
      const keys = deriveKeysFromSignature(signatureHash);

      // 3. Register on-chain
      const bridgeContract = new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI, signer);
      const spendPubKey = `0x${keys.spend.publicKey}`;
      const viewingPubKey = `0x${keys.viewing.publicKey}`;

      console.log("Registering meta address...");
      const tx = await bridgeContract.registerMetaAddress(spendPubKey, viewingPubKey);

      toast.loading("Registering on-chain...", { id: "register-tx" });
      await tx.wait();
      toast.success("Successfully registered!", { id: "register-tx" });

      setIsRegistered(true);

      // Optional: Save keys to local storage for convenience (encrypted ideally, but raw for now as they are recoverable)
      // localStorage.setItem(`stealth_keys_${evmAddress}`, JSON.stringify(keys));
      // Save signature hash to session storage for scanning without re-signing
      sessionStorage.setItem(`stealth_sig_${evmAddress}`, signatureHash);

    } catch (error) {
      console.error("Registration error:", error);
      toast.error(error.message || "Failed to register");
    } finally {
      setRegistering(false);
    }
  };

  // Scan for payments
  const handleScanPayments = async () => {
    if (!evmAddress) return;

    setScanning(true);
    setScannedPayments([]);

    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // 1. Get keys (either from session or ask to sign)
      let signatureHash = sessionStorage.getItem(`stealth_sig_${evmAddress}`);

      if (!signatureHash) {
        const message = "Sign this message to enable Stealth Payments on PrivatePay.\n\nThis signature will be used to generate your unique stealth keys deterministically.\n\nIMPORTANT: Signing this does not cost gas.";
        const signature = await signer.signMessage(message);
        signatureHash = ethers.keccak256(signature);
        sessionStorage.setItem(`stealth_sig_${evmAddress}`, signatureHash);
      }

      const keys = deriveKeysFromSignature(signatureHash);

      // 2. Scan
      console.log("Scanning for payments...");
      const payments = await scanStealthPayments({
        provider,
        bridgeAddress: BRIDGE_ADDRESS,
        viewingPrivateKey: keys.viewing.privateKey,
        spendPublicKey: keys.spend.publicKey,
        fromBlock: 0, // In prod, optimize this
      });

      console.log("Found payments:", payments);
      setScannedPayments(payments);

      if (payments.length === 0) {
        toast("No stealth payments found", { icon: "🔍" });
      } else {
        toast.success(`Found ${payments.length} payments!`);
      }

    } catch (error) {
      console.error("Scanning error:", error);
      toast.error("Failed to scan payments");
    } finally {
      setScanning(false);
    }
  };

  // Withdraw funds
  const handleWithdraw = async (payment) => {
    setWithdrawing(payment.txHash);
    const toastId = toast.loading("Initializing withdrawal...");

    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // 1. Get keys
      const signatureHash = sessionStorage.getItem(`stealth_sig_${evmAddress}`);
      if (!signatureHash) throw new Error("Please scan again to unlock keys");

      const keys = deriveKeysFromSignature(signatureHash);

      // 2. Derive stealth private key
      const stealthPrivateKey = deriveStealthPrivateKey(
        payment.ephemeralPubKey,
        keys.viewing.privateKey,
        keys.spend.privateKey,
        payment.k
      );

      // 3. Create stealth wallet connected to provider
      const stealthWallet = new ethers.Wallet(stealthPrivateKey, provider);

      // 4. Resolve Token Address
      // We need the Axelar Gateway to find the token address for the symbol
      const bridgeContract = new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI, provider);
      // Note: BRIDGE_ABI in this file is minimal, we need to ensure it has 'gateway()'
      // The ABI defined at the top of this file is missing 'gateway()'. 
      // Let's use the full ABI from the hook if possible, or just add it dynamically.
      // Actually, we imported GATEWAY_ABI, but we need to call bridge.gateway() first.

      // Let's use a direct call for gateway address since we know the bridge ABI has it
      // (It was added in the previous steps to the contract)
      const bridgeGatewayABI = ["function gateway() external view returns (address)"];
      const bridgeForGateway = new ethers.Contract(BRIDGE_ADDRESS, bridgeGatewayABI, provider);
      const gatewayAddress = await bridgeForGateway.gateway();

      const gatewayContract = new ethers.Contract(gatewayAddress, GATEWAY_ABI, provider);
      const tokenAddress = await gatewayContract.tokenAddresses(payment.symbol);

      if (tokenAddress === ethers.ZeroAddress) {
        throw new Error(`Token ${payment.symbol} not found on this chain`);
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, stealthWallet); // Connected to stealth wallet

      // 5. Check Stealth Wallet ETH Balance for Gas
      const gasPrice = (await provider.getFeeData()).gasPrice;
      const gasLimit = 100000n; // Standard ERC20 transfer is ~65k, buffer to 100k
      const gasCost = gasPrice * gasLimit;

      const stealthBalance = await provider.getBalance(stealthWallet.address);

      if (stealthBalance < gasCost) {
        toast.loading(`Stealth wallet needs gas. Sending ETH...`, { id: toastId });

        // Send ETH from Main Wallet -> Stealth Wallet
        // Add a buffer to gas cost (e.g. 2x) to be safe
        const topUpAmount = gasCost * 2n;

        const tx = await signer.sendTransaction({
          to: stealthWallet.address,
          value: topUpAmount
        });

        await tx.wait();
        toast.success("Gas topped up!", { id: toastId });
      }

      // 6. Execute Withdrawal (Stealth -> Main)
      toast.loading("Withdrawing funds...", { id: toastId });

      // Get full token balance to sweep
      const tokenBalance = await tokenContract.balanceOf(stealthWallet.address);

      if (tokenBalance === 0n) {
        throw new Error("Stealth wallet has 0 token balance. Already withdrawn?");
      }

      const withdrawTx = await tokenContract.transfer(evmAddress, tokenBalance);
      await withdrawTx.wait();

      toast.success("Withdrawal complete! Funds sent to your wallet.", { id: toastId });

      // Remove from list or mark as withdrawn
      setScannedPayments(prev => prev.filter(p => p.txHash !== payment.txHash));

    } catch (error) {
      console.error("Withdrawal error:", error);
      toast.error(`Withdrawal failed: ${error.message}`, { id: toastId });
    } finally {
      setWithdrawing(null);
    }
  };

  // Check for stealth keys when recipient address changes
  useEffect(() => {
    async function checkStealthKeys() {
      if (!recipientAddress || recipientAddress.length !== 42 || !recipientAddress.startsWith("0x")) {
        setStealthMode(null);
        setRecipientMetaAddress(null);
        return;
      }

      setCheckingStealthKeys(true);
      try {
        const { ethers } = await import("ethers");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const bridgeContract = new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI, provider);

        const [spendPubKey, viewingPubKey] = await bridgeContract.getMetaAddress(recipientAddress);

        // Check if keys are registered (not empty)
        const spendPubKeyHex = ethers.hexlify(spendPubKey);
        const viewingPubKeyHex = ethers.hexlify(viewingPubKey);

        if (spendPubKeyHex !== "0x" && viewingPubKeyHex !== "0x" && spendPubKeyHex.length > 2) {
          console.log("Stealth keys found for recipient:", { spendPubKeyHex, viewingPubKeyHex });
          setRecipientMetaAddress({
            spendPubKey: spendPubKeyHex,
            viewingPubKey: viewingPubKeyHex,
          });
          setStealthMode(true);
        } else {
          console.log("No stealth keys registered for recipient");
          setRecipientMetaAddress(null);
          setStealthMode(false);
        }
      } catch (err) {
        console.log("Error checking stealth keys (recipient may not be registered):", err.message);
        setRecipientMetaAddress(null);
        setStealthMode(false);
      } finally {
        setCheckingStealthKeys(false);
      }
    }

    // Debounce the check
    const timer = setTimeout(checkStealthKeys, 500);
    return () => clearTimeout(timer);
  }, [recipientAddress]);

  // Fetch available tokens when chains change
  useEffect(() => {
    async function fetchTokens() {
      if (!sourceChain || !destinationChain) {
        setAvailableTokens(FALLBACK_TOKENS);
        return;
      }

      setLoadingTokens(true);
      try {
        const tokens = await getAvailableTokens(sourceChain, destinationChain);
        if (tokens.length > 0) {
          setAvailableTokens(tokens);
          // Auto-select first token if none selected
          if (!selectedToken || !tokens.find(t => t.symbol === selectedToken)) {
            setSelectedToken(tokens[0].symbol);
          }
        } else {
          setAvailableTokens(FALLBACK_TOKENS);
          setSelectedToken(FALLBACK_TOKENS[0].symbol);
        }
      } catch (err) {
        console.error("Error fetching tokens:", err);
        setAvailableTokens(FALLBACK_TOKENS);
      } finally {
        setLoadingTokens(false);
      }
    }

    fetchTokens();
  }, [sourceChain, destinationChain]);

  // Check if MetaMask is connected on mount
  useEffect(() => {
    checkEvmConnection();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const checkEvmConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setEvmAddress(accounts[0]);
          const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
          setChainId(parseInt(chainIdHex, 16));
        }
      } catch (err) {
        console.error("Error checking EVM connection:", err);
      }
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length > 0) {
      setEvmAddress(accounts[0]);
    } else {
      setEvmAddress(null);
    }
  };

  const handleChainChanged = (chainIdHex) => {
    setChainId(parseInt(chainIdHex, 16));
  };

  const connectEvmWallet = async () => {
    if (!window.ethereum) {
      toast.error("Please install MetaMask!");
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    setEvmConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setEvmAddress(accounts[0]);
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(chainIdHex, 16));
      toast.success("Wallet connected!");
    } catch (err) {
      console.error("Error connecting:", err);
      toast.error("Failed to connect wallet");
    } finally {
      setEvmConnecting(false);
    }
  };

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia chainId
      });
    } catch (err) {
      // Chain not added, add it
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Sepolia Testnet",
            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      }
    }
  };

  const isOnSepolia = chainId === 11155111;

  // Get all available chains
  const availableChains = useMemo(() => {
    return getSupportedChains();
  }, []);

  // Filter destination chains (exclude source)
  const destinationChains = useMemo(() => {
    return availableChains.filter(chain => chain.key !== sourceChain);
  }, [availableChains, sourceChain]);

  // Handle gas estimation
  const handleEstimateGas = async () => {
    if (!sourceChain || !destinationChain) {
      toast.error("Select source and destination chains");
      return;
    }

    setEstimatingGas(true);
    try {
      const estimate = await estimateGas({ sourceChain, destinationChain });
      toast.success(`Gas estimated: ${(Number(estimate) / 1e18).toFixed(6)} ETH`);
    } catch (err) {
      toast.error("Failed to estimate gas");
    } finally {
      setEstimatingGas(false);
    }
  };

  // Handle payment submission
  const handleSendPayment = async () => {
    if (!evmAddress) {
      toast.error("Please connect your MetaMask wallet first");
      return;
    }
    if (!isOnSepolia) {
      toast.error("Please switch to Sepolia network");
      return;
    }
    if (!sourceChain || !destinationChain) {
      toast.error("Select source and destination chains");
      return;
    }
    if (!recipientAddress) {
      toast.error("Enter recipient address");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      let result;

      if (stealthMode && recipientMetaAddress) {
        // Stealth mode - use meta address to generate stealth address
        console.log("Using STEALTH mode with meta address");
        result = await sendCrossChainPayment({
          sourceChain,
          destinationChain,
          recipientMetaAddress, // Stealth transfer mode
          amount: parseFloat(amount),
          tokenSymbol: selectedToken,
          signer,
        });
        toast.success("Private stealth payment initiated!");
      } else {
        // Direct mode - send to regular address
        console.log("Using DIRECT mode (recipient not registered for stealth)");
        result = await sendCrossChainPayment({
          sourceChain,
          destinationChain,
          directAddress: recipientAddress, // Direct transfer mode
          amount: parseFloat(amount),
          tokenSymbol: selectedToken,
          signer,
        });
        toast.success("Cross-chain payment initiated!");
      }

      if (!result.success) {
        throw new Error(result.error || "Payment failed");
      }
    } catch (err) {
      console.error("Payment error:", err);
      toast.error(err.message || "Payment failed");
    }
  };

  // Get status color
  const getStatusColor = () => {
    if (isComplete) return "text-green-600";
    if (isFailed) return "text-red-600";
    if (isProcessing) return "text-blue-600";
    return "text-gray-600";
  };

  // Tabs state
  const [activeTab, setActiveTab] = useState("send");

  return (
    <div className="flex flex-col items-center w-full min-h-screen py-12 px-4 pb-24">
      <div className="w-full max-w-5xl">
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="flex items-center gap-3">
            <img src="/assets/axelar.png" alt="Axelar" className="w-10 h-10 rounded-full" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Cross-Chain Payments
            </h1>
          </div>
          <p className="text-gray-600 max-w-lg text-center">
            Send private stealth payments across blockchains via Axelar. Your transactions remain confidential.
          </p>
        </div>

        <Card className="bg-white border border-gray-200 shadow-lg rounded-3xl mb-6">
          <CardBody className="p-0">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={setActiveTab}
              variant="underlined"
              color="secondary"
              classNames={{
                tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider px-6",
                cursor: "bg-gradient-to-r from-indigo-600 to-purple-600",
                tab: "max-w-fit px-0 h-12",
                tabContent: "group-data-[selected=true]:text-indigo-600 group-data-[selected=true]:font-semibold"
              }}
            >
              <Tab
                key="send"
                title={
                  <div className="flex items-center gap-2">
                    <Send size={18} />
                    <span>Send</span>
                  </div>
                }
              >
                <div className="p-6 space-y-6">

                  {/* EVM Wallet Connection */}
                  {!evmAddress ? (
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm">
                      <CardBody className="p-8">
                        <div className="flex flex-col items-center gap-5 text-center">
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center shadow-lg">
                            <Shield className="w-10 h-10 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Wallet</h3>
                            <p className="text-sm text-gray-600">Connect MetaMask to send cross-chain payments</p>
                          </div>
                          <Button
                            onClick={connectEvmWallet}
                            isLoading={evmConnecting}
                            className="w-full h-14 font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-indigo-500 hover:to-purple-500 transition-all text-base"
                            startContent={
                              !evmConnecting && (
                                <svg className="w-6 h-6" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726" />
                                  <path d="M2.04858 1L15.0707 10.809L12.7402 4.99098L2.04858 1Z" fill="#E27625" />
                                </svg>
                              )
                            }
                          >
                            Connect MetaMask
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ) : (
                    <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 shadow-sm">
                      <CardBody className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-green-400 flex items-center justify-center shadow-md">
                              <CheckCircle2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-emerald-600 font-semibold mb-1">Connected</p>
                              <p className="text-sm font-mono text-emerald-800 font-bold">
                                {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
                              </p>
                            </div>
                          </div>
                          {!isOnSepolia && (
                            <Button
                              size="sm"
                              className="bg-amber-500 text-white hover:bg-amber-600 font-semibold shadow-md"
                              onClick={switchToSepolia}
                            >
                              Switch to Sepolia
                            </Button>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  )}

                  {evmAddress && (
                    <>

                      {/* Chain Selection */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                            <ArrowUp className="w-4 h-4 text-indigo-600" />
                            From Chain
                          </label>
                          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm">
                            <CardBody className="p-5">
                              <div className="flex items-center gap-3 mb-3">
                                {sourceChain && availableChains.find(c => c.key === sourceChain)?.image ? (
                                  <img 
                                    src={availableChains.find(c => c.key === sourceChain).image} 
                                    alt="Source" 
                                    className="w-10 h-10 rounded-full border-2 border-white shadow-md" 
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center">
                                    <ArrowUp className="w-5 h-5 text-indigo-600" />
                                  </div>
                                )}
                                <Select
                                  placeholder="Select source chain"
                                  selectedKeys={sourceChain ? [sourceChain] : []}
                                  onSelectionChange={(keys) => setSourceChain(Array.from(keys)[0])}
                                  variant="bordered"
                                  classNames={{
                                    trigger: "h-12 rounded-xl bg-white border-gray-200 flex-1",
                                    value: "text-foreground flex items-center",
                                  }}
                                >
                                  {availableChains.map((chain) => (
                                    <SelectItem key={chain.key} textValue={chain.name}>
                                      <div className="flex items-center gap-2">
                                        {chain.image && (
                                          <img src={chain.image} alt={chain.name} className="w-5 h-5 rounded-full" />
                                        )}
                                        <span>{chain.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </Select>
                              </div>
                            </CardBody>
                          </Card>
                        </div>

                        <div className="flex justify-center -my-2 z-10 relative">
                          <div className="bg-gradient-to-br from-indigo-100 to-purple-100 p-4 rounded-full border-2 border-indigo-300 shadow-lg flex items-center justify-center">
                            <img src="/assets/axelar.png" alt="Axelar" className="w-8 h-8 rounded-full" />
                            <ArrowLeftRight className="w-5 h-5 text-indigo-600 ml-2" />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                            <ArrowDown className="w-4 h-4 text-purple-600" />
                            To Chain
                          </label>
                          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 shadow-sm">
                            <CardBody className="p-5">
                              <div className="flex items-center gap-3 mb-3">
                                {destinationChain && destinationChains.find(c => c.key === destinationChain)?.image ? (
                                  <img 
                                    src={destinationChains.find(c => c.key === destinationChain).image} 
                                    alt="Destination" 
                                    className="w-10 h-10 rounded-full border-2 border-white shadow-md" 
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center">
                                    <ArrowDown className="w-5 h-5 text-purple-600" />
                                  </div>
                                )}
                                <Select
                                  placeholder="Select destination chain"
                                  selectedKeys={destinationChain ? [destinationChain] : []}
                                  onSelectionChange={(keys) => setDestinationChain(Array.from(keys)[0])}
                                  variant="bordered"
                                  isDisabled={!sourceChain}
                                  classNames={{
                                    trigger: "h-12 rounded-xl bg-white border-gray-200 flex-1",
                                    value: "text-foreground flex items-center",
                                  }}
                                >
                                  {destinationChains.map((chain) => (
                                    <SelectItem key={chain.key} textValue={chain.name}>
                                      <div className="flex items-center gap-2">
                                        {chain.image && (
                                          <img src={chain.image} alt={chain.name} className="w-5 h-5 rounded-full" />
                                        )}
                                        <span>{chain.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </Select>
                              </div>
                            </CardBody>
                          </Card>
                        </div>
                      </div>

                      {/* Token Selection */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                          <Coins className="w-4 h-4 text-blue-600" />
                          Token
                        </label>
                        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 shadow-sm">
                          <CardBody className="p-5">
                            <div className="flex items-center gap-3">
                              {selectedToken && (
                                <img 
                                  src="/assets/usdc.png" 
                                  alt={selectedToken} 
                                  className="w-10 h-10 rounded-full border-2 border-white shadow-md" 
                                />
                              )}
                              <Select
                                placeholder={loadingTokens ? "Loading tokens..." : "Select token"}
                                selectedKeys={selectedToken ? [selectedToken] : []}
                                onSelectionChange={(keys) => setSelectedToken(Array.from(keys)[0])}
                                variant="bordered"
                                classNames={{
                                  trigger: "h-12 rounded-xl bg-white border-gray-200 flex-1",
                                  value: "text-foreground flex items-center",
                                }}
                                disallowEmptySelection
                                isDisabled={loadingTokens}
                              >
                                {availableTokens.map((token) => (
                                  <SelectItem key={token.symbol} textValue={token.symbol}>
                                    <div className="flex items-center gap-2">
                                      <img src="/assets/usdc.png" alt={token.symbol} className="w-5 h-5 rounded-full" />
                                      <span className="font-medium">{token.symbol}</span>
                                      <span className="text-xs text-gray-500">({token.name})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </Select>
                            </div>
                          </CardBody>
                        </Card>
                      </div>

                      {/* Recipient Address */}
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-600" />
                            Recipient Address
                          </label>
                          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm">
                            <CardBody className="p-5">
                              <Input
                                placeholder="0x..."
                                value={recipientAddress}
                                onChange={(e) => setRecipientAddress(e.target.value)}
                                variant="bordered"
                                classNames={{
                                  inputWrapper: "h-12 rounded-xl bg-white border-gray-200",
                                  input: "font-mono text-sm",
                                }}
                                endContent={
                                  checkingStealthKeys && (
                                    <Spinner size="sm" />
                                  )
                                }
                              />
                            </CardBody>
                          </Card>
                        </div>
                        {/* Stealth Mode Indicator */}
                        {recipientAddress && recipientAddress.length === 42 && !checkingStealthKeys && (
                          <Card className={stealthMode ? "bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-sm" : "bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 shadow-sm"}>
                            <CardBody className="p-4">
                              <div className="flex items-center gap-3">
                                {stealthMode ? (
                                  <>
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center shadow-md">
                                      <Shield className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-green-900">Stealth Mode</p>
                                      <p className="text-xs text-green-700">Private Transfer Enabled</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-400 flex items-center justify-center shadow-md">
                                      <AlertCircle className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-amber-900">Direct Mode</p>
                                      <p className="text-xs text-amber-700">Recipient not registered for stealth</p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </CardBody>
                          </Card>
                        )}
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                          <Zap className="w-4 h-4 text-indigo-600" />
                          Amount
                        </label>
                        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm">
                          <CardBody className="p-5">
                            <div className="flex items-center gap-3">
                              <img 
                                src="/assets/usdc.png" 
                                alt="Token" 
                                className="w-12 h-12 rounded-full border-2 border-white shadow-md flex-shrink-0" 
                              />
                              <Input
                                placeholder="0.00"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                variant="bordered"
                                size="lg"
                                classNames={{
                                  input: "text-2xl font-bold",
                                  inputWrapper: "h-14 rounded-xl bg-white border-gray-200 flex-1",
                                }}
                                endContent={
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-700 font-semibold">{selectedToken || "Token"}</span>
                                  </div>
                                }
                              />
                            </div>
                          </CardBody>
                        </Card>
                      </div>

                      {/* Gas Estimate */}
                      <div className="space-y-3">
                        <Button
                          variant="bordered"
                          onClick={handleEstimateGas}
                          isLoading={estimatingGas}
                          isDisabled={!sourceChain || !destinationChain}
                          className="w-full rounded-xl border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold h-12"
                          startContent={<Zap className="w-5 h-5" />}
                        >
                          Estimate Gas Fee
                        </Button>

                        {gasEstimate && (
                          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-sm">
                            <CardBody className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-white" />
                                  </div>
                                  <span className="text-sm text-gray-700 font-semibold">Estimated Gas:</span>
                                </div>
                                <span className="font-mono font-bold text-gray-900 text-lg">{(Number(gasEstimate) / 1e18).toFixed(6)} ETH</span>
                              </div>
                            </CardBody>
                          </Card>
                        )}
                      </div>

                      {/* Status Display */}
                      {txStatus !== TX_STATUS.IDLE && (
                        <Card className={isComplete ? "bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-sm" : isFailed ? "bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 shadow-sm" : "bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm"}>
                          <CardBody className="p-5">
                            <div className="flex items-center gap-4">
                              {isProcessing && (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center shadow-md">
                                  <Spinner size="sm" className="text-white" />
                                </div>
                              )}
                              {isComplete && (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center shadow-md">
                                  <CheckCircle2 className="w-6 h-6 text-white" />
                                </div>
                              )}
                              {isFailed && (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-rose-400 flex items-center justify-center shadow-md">
                                  <AlertCircle className="w-6 h-6 text-white" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className={`text-base font-bold ${getStatusColor()}`}>{getStatusLabel()}</p>
                                {txHash && (
                                  <a
                                    href={getAxelarscanUrl(txHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 mt-2"
                                  >
                                    <img src="/assets/axelar.png" alt="Axelar" className="w-4 h-4 rounded-full" />
                                    View on Axelarscan <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      )}

                      {/* Error Display */}
                      {error && (
                        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200">
                          <CardBody className="p-4">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-5 h-5 text-red-600" />
                              <span className="text-sm text-red-700">{error}</span>
                            </div>
                          </CardBody>
                        </Card>
                      )}

                      {/* Send Button */}
                      <div className="pt-2">
                        <Button
                          onClick={handleSendPayment}
                          isLoading={loading}
                          isDisabled={!evmAddress || !isOnSepolia || !sourceChain || !destinationChain || !recipientAddress || !amount || isProcessing}
                          className="w-full h-14 font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-indigo-500 hover:to-purple-500 transition-all text-base"
                          size="lg"
                          startContent={!loading && (
                            <div className="flex items-center gap-2">
                              <img src="/assets/axelar.png" alt="Axelar" className="w-5 h-5 rounded-full" />
                              <Send className="w-5 h-5" />
                            </div>
                          )}
                        >
                          {!evmAddress ? "Connect Wallet First" : isProcessing ? "Processing..." : "Send Cross-Chain Payment"}
                        </Button>
                      </div>

                      {/* Reset Button (show after completion/failure) */}
                      {(isComplete || isFailed) && (
                        <Button
                          variant="bordered"
                          onClick={reset}
                          className="w-full rounded-xl border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          New Payment
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Tab>

              <Tab
                key="receive"
                title={
                  <div className="flex items-center gap-2">
                    <Eye size={18} />
                    <span>Receive</span>
                  </div>
                }
              >
                <div className="p-6 space-y-6">
                  <p className="text-sm text-gray-600 text-center">
                    Scan for private payments sent to your stealth address.
                  </p>

                  {/* Stealth Registration Section */}
                  {evmAddress && !isRegistered && (
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm">
                      <CardBody className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center flex-shrink-0 shadow-lg">
                              <Shield className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <span className="font-bold text-gray-900 block text-base">Enable Stealth Payments</span>
                              <span className="text-xs text-gray-600">Register to receive private payments</span>
                            </div>
                          </div>
                          <Button
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-500 hover:to-purple-500 w-full md:w-auto h-12 shadow-md"
                            onClick={handleRegisterWithSignature}
                            isLoading={registering}
                            startContent={!registering && <Shield className="w-5 h-5" />}
                          >
                            Sign to Register
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  )}

                  {evmAddress && isRegistered && (
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-sm">
                      <CardBody className="p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center shadow-md">
                            <CheckCircle2 className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-green-900 block">Registered for Stealth</span>
                            <span className="text-xs text-green-700">You can receive private payments</span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )}

                  {/* Scan Button */}
                  {evmAddress && (
                    <Button
                      onClick={handleScanPayments}
                      isLoading={scanning}
                      className="w-full h-14 font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-indigo-500 hover:to-purple-500 transition-all text-base"
                      size="lg"
                      startContent={!scanning && (
                        <div className="flex items-center gap-2">
                          <Shield className="w-5 h-5" />
                          <Eye className="w-5 h-5" />
                        </div>
                      )}
                    >
                      {scanning ? "Scanning Blockchain..." : "Scan for Payments"}
                    </Button>
                  )}

                  {/* Results List */}
                  {scannedPayments.length > 0 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-gray-900 text-lg">Found Payments ({scannedPayments.length})</h3>
                      </div>
                      {scannedPayments.map((payment, idx) => (
                        <Card key={idx} className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-md">
                          <CardBody className="p-5">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center shadow-lg">
                                  <img src="/assets/usdc.png" alt={payment.symbol} className="w-8 h-8 rounded-full" />
                                </div>
                                <div>
                                  <span className="font-bold text-2xl text-gray-900 block">
                                    {(Number(payment.amount) / 1e6).toFixed(6)} {payment.symbol}
                                  </span>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Chip size="sm" color="success" variant="flat" className="h-auto py-1">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      <span className="leading-tight">Verified</span>
                                    </Chip>
                                    <span className="text-xs text-gray-500">Block {payment.blockNumber}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Card className="bg-white border border-gray-200 mb-4">
                              <CardBody className="p-3">
                                <p className="text-xs text-gray-500 mb-1 font-semibold">Stealth Address:</p>
                                <code className="text-xs text-gray-700 break-all font-mono">
                                  {payment.stealthAddress}
                                </code>
                              </CardBody>
                            </Card>

                            <Button
                              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-500 hover:to-purple-500 shadow-md"
                              onClick={() => handleWithdraw(payment)}
                              isLoading={withdrawing === payment.txHash}
                              startContent={!withdrawing && <ArrowDown className="w-5 h-5" />}
                            >
                              {withdrawing === payment.txHash ? "Withdrawing..." : "Withdraw to Main Wallet"}
                            </Button>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  )}

                  {scannedPayments.length === 0 && !scanning && evmAddress && (
                    <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200">
                      <CardBody className="p-12">
                        <div className="flex flex-col items-center gap-4 text-center">
                          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                            <Eye className="w-10 h-10 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-gray-700 font-semibold mb-1">No Pending Payments</p>
                            <p className="text-gray-500 text-sm">Scan again later to check for new payments.</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )}
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm rounded-3xl">
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <img src="/assets/axelar.png" alt="Axelar" className="w-10 h-10 rounded-full" />
              <h3 className="font-bold text-gray-900 text-lg">How It Works</h3>
            </div>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">
                  1
                </div>
                <div className="flex-1 pt-1">
                  <p className="font-semibold text-gray-900 mb-1">Select Chains</p>
                  <p className="text-gray-600">Choose source and destination blockchains</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">
                  2
                </div>
                <div className="flex-1 pt-1">
                  <p className="font-semibold text-gray-900 mb-1">Enter Address</p>
                  <p className="text-gray-600">Recipient stealth address (or regular address)</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">
                  3
                </div>
                <div className="flex-1 pt-1">
                  <p className="font-semibold text-gray-900 mb-1">Axelar Routing</p>
                  <p className="text-gray-600">Payment is routed via Axelar network</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">
                  4
                </div>
                <div className="flex-1 pt-1">
                  <p className="font-semibold text-gray-900 mb-1">Private Delivery</p>
                  <p className="text-gray-600">Recipient receives funds privately (if stealth mode)</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
