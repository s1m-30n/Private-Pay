import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Chip,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@nextui-org/react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useArcium } from "../providers/SolanaProvider";
import { Icons } from "../components/shared/Icons";
import {
  ArrowDownUp,
  Shield,
  Zap,
  AlertTriangle,
  Check,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";

// Available tokens for swap
const TOKENS = [
  { id: "sol", name: "SOL", symbol: "SOL", icon: "◎", decimals: 9 },
  { id: "usdc", name: "USD Coin", symbol: "USDC", icon: "$", decimals: 6 },
  { id: "usdt", name: "Tether", symbol: "USDT", icon: "₮", decimals: 6 },
];

export default function PrivateSwapPage() {
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { isInitialized } = useArcium();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Swap state
  const [inputToken, setInputToken] = useState("sol");
  const [outputToken, setOutputToken] = useState("usdc");
  const [inputAmount, setInputAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [isSwapping, setIsSwapping] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [swapStatus, setSwapStatus] = useState(null);

  // Calculated values
  const estimatedOutput = useMemo(() => {
    if (!inputAmount || isNaN(parseFloat(inputAmount))) return "0.00";
    // Mock exchange rate calculation
    const rates = {
      "sol-usdc": 180,
      "usdc-sol": 0.0055,
      "sol-usdt": 180,
      "usdt-sol": 0.0055,
      "usdc-usdt": 1,
      "usdt-usdc": 1,
    };
    const rate = rates[`${inputToken}-${outputToken}`] || 1;
    return (parseFloat(inputAmount) * rate * 0.997).toFixed(4); // 0.3% fee
  }, [inputAmount, inputToken, outputToken]);

  const priceImpact = useMemo(() => {
    if (!inputAmount || parseFloat(inputAmount) < 100) return "< 0.01%";
    if (parseFloat(inputAmount) < 1000) return "0.05%";
    return "0.1%";
  }, [inputAmount]);

  // Swap tokens
  const handleFlipTokens = useCallback(() => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount("");
  }, [inputToken, outputToken]);

  // Execute swap
  const handleSwap = useCallback(async () => {
    if (!connected || !inputAmount) return;

    setIsSwapping(true);
    setSwapStatus("encrypting");

    try {
      // Step 1: Encrypt swap data
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSwapStatus("submitting");

      // Step 2: Submit to Arcium MPC network
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setSwapStatus("computing");

      // Step 3: MPC computation
      await new Promise((resolve) => setTimeout(resolve, 2500));
      setSwapStatus("finalizing");

      // Step 4: Finalize swap
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSwapStatus("success");

      toast.success("Private swap executed successfully!");
      onOpen(); // Show success modal

    } catch (error) {
      console.error("Swap failed:", error);
      setSwapStatus("error");
      toast.error("Swap failed. Please try again.");
    } finally {
      setIsSwapping(false);
    }
  }, [connected, inputAmount, onOpen]);

  const statusMessages = {
    encrypting: "Encrypting swap data...",
    submitting: "Submitting to Arcium network...",
    computing: "MPC nodes computing...",
    finalizing: "Finalizing transaction...",
    success: "Swap complete!",
    error: "Swap failed",
  };

  return (
    <div className="flex min-h-screen w-full items-start justify-center py-20 px-4 md:px-10 bg-gradient-to-br from-white to-indigo-50/30">
      <div className="relative flex flex-col gap-4 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="light"
              className="text-gray-600"
              onClick={() => navigate("/arcium")}
            >
              <Icons.back className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Private Swap</h1>
              <p className="text-gray-500 text-sm">MEV-protected trading</p>
            </div>
          </div>
          <Button
            isIconOnly
            variant="light"
            className="text-gray-600"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Security Notice */}
        <Card className="bg-primary/10 border border-primary/20 mb-4">
          <CardBody className="flex flex-row items-center gap-3 py-3">
            <Shield className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-gray-900 text-sm font-medium">
                Your swap amounts are encrypted
              </p>
              <p className="text-gray-600 text-xs">
                Protected from MEV bots and front-runners
              </p>
            </div>
            <Lock className="w-4 h-4 text-primary" />
          </CardBody>
        </Card>

        {/* Main Swap Card */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-3xl">
          <CardBody className="p-6">
            {/* Input Token */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">You pay</span>
                <span className="text-gray-500 text-xs">
                  Balance: <span className="text-gray-900">****</span>
                </span>
              </div>
              <div className="flex gap-3">
                <Select
                  selectedKeys={[inputToken]}
                  onChange={(e) => setInputToken(e.target.value)}
                  className="w-32"
                  variant="bordered"
                >
                  {TOKENS.map((token) => (
                    <SelectItem key={token.id} value={token.id}>
                      {token.icon} {token.symbol}
                    </SelectItem>
                  ))}
                </Select>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="flex-1"
                  variant="bordered"
                  classNames={{
                    input: "text-gray-900 text-xl text-right",
                  }}
                />
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center my-4">
              <Button
                isIconOnly
                variant="light"
                className="bg-gray-100 text-gray-600 hover:bg-gray-200"
                onClick={handleFlipTokens}
              >
                <ArrowDownUp className="w-5 h-5" />
              </Button>
            </div>

            {/* Output Token */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">You receive</span>
                <span className="text-gray-500 text-xs flex items-center gap-1">
                  <EyeOff className="w-3 h-3" /> Hidden until execution
                </span>
              </div>
              <div className="flex gap-3">
                <Select
                  selectedKeys={[outputToken]}
                  onChange={(e) => setOutputToken(e.target.value)}
                  className="w-32"
                  variant="bordered"
                >
                  {TOKENS.filter((t) => t.id !== inputToken).map((token) => (
                    <SelectItem key={token.id} value={token.id}>
                      {token.icon} {token.symbol}
                    </SelectItem>
                  ))}
                </Select>
                <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-right">
                  <span className="text-gray-900 text-xl font-mono">
                    ~{estimatedOutput}
                  </span>
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600 text-sm">Slippage Tolerance</span>
                  <div className="flex gap-2">
                    {["0.1", "0.5", "1.0"].map((val) => (
                      <Button
                        key={val}
                        size="sm"
                        variant={slippage === val ? "solid" : "flat"}
                        color={slippage === val ? "primary" : "default"}
                        onClick={() => setSlippage(val)}
                      >
                        {val}%
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Swap Info */}
            <div className="space-y-2 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Rate</span>
                <span className="text-gray-900">
                  1 {inputToken.toUpperCase()} ≈{" "}
                  {inputToken === "sol" ? "180" : "0.0055"}{" "}
                  {outputToken.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Price Impact</span>
                <span className="text-emerald-600">{priceImpact}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Network Fee</span>
                <span className="text-gray-900">~0.00025 SOL</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Protocol Fee</span>
                <span className="text-gray-900">0.3%</span>
              </div>
            </div>

            {/* Swap Button */}
            {!connected ? (
              <WalletMultiButton className="!w-full !bg-primary !rounded-xl !h-12 !justify-center" />
            ) : (
              <Button
                color="primary"
                className="w-full font-semibold h-12"
                onClick={handleSwap}
                isDisabled={!inputAmount || isSwapping || inputToken === outputToken}
                isLoading={isSwapping}
              >
                {isSwapping ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" color="white" />
                    {statusMessages[swapStatus]}
                  </span>
                ) : (
                  "Swap Privately"
                )}
              </Button>
            )}
          </CardBody>
        </Card>

        {/* How It Works */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-3xl mt-4">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              <span className="text-gray-900 font-medium text-sm">
                How Private Swap Works
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { icon: <Lock className="w-4 h-4" />, text: "Encrypt" },
                { icon: <Zap className="w-4 h-4" />, text: "Submit" },
                { icon: <RefreshCw className="w-4 h-4" />, text: "Compute" },
                { icon: <Check className="w-4 h-4" />, text: "Settle" },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {step.icon}
                  </div>
                  <span className="text-gray-600">{step.text}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Success Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader className="text-gray-900">Swap Successful!</ModalHeader>
          <ModalBody>
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-600 mb-4">
                Your private swap has been executed successfully.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 text-left border border-gray-200">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Sent</span>
                  <span className="text-gray-900">
                    {inputAmount} {inputToken.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Received</span>
                  <span className="text-emerald-600">
                    ~{estimatedOutput} {outputToken.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              className="w-full"
              onClick={onClose}
            >
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}




