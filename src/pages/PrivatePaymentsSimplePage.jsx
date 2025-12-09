import React, { useState } from "react";
import { Button, Card, CardBody, Input } from "@nextui-org/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Icons } from "../components/shared/Icons.jsx";

/**
 * Simplified Private Payments Page (Without Arcium MPC)
 * 
 * This is a temporary version that works without Arcium infrastructure.
 * It demonstrates the UI and basic Solana integration.
 * 
 * TODO: Once Arcium localnet is set up, switch back to full MPC version.
 */
export default function PrivatePaymentsSimplePage() {
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkBalance = async () => {
    if (!connected || !publicKey) {
      toast.error("Cüzdan bağlayın.");
      return;
    }

    setLoading(true);
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / 1e9); // Convert lamports to SOL
      toast.success(`Bakiye: ${(bal / 1e9).toFixed(4)} SOL`);
    } catch (error) {
      console.error("Balance check error:", error);
      toast.error("Bakiye kontrolü başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-start justify-center py-20 px-4 md:px-10 bg-gradient-to-br from-white to-indigo-50/30">
      <div className="relative flex flex-col gap-4 w-full max-w-md">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-3xl p-6">
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between w-full mb-2">
              <h1 className="font-bold text-xl text-gray-900">Private Payments (Demo)</h1>
              <Button
                onClick={() => navigate("/arcium")}
                className="bg-white border border-gray-200 rounded-full px-4 h-10 flex items-center gap-2"
                variant="flat"
              >
                <Icons.back className="size-4" />
                <span className="text-sm">Back</span>
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Demo Mode</strong><br />
                Arcium MPC infrastructure is not available yet. This is a simplified demo showing the UI.
              </p>
            </div>

            {!connected ? (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-gray-500 text-center mb-4">
                  Connect your Solana wallet to continue
                </p>
              </div>
            ) : (
              <>
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg space-y-1">
                  <div className="font-medium mb-2">Wallet Info:</div>
                  <div>Connected: ✓</div>
                  <div>Address: {publicKey?.toBase58()?.slice(0, 8) + "..." ?? "N/A"}</div>
                  {balance !== null && <div>Balance: {balance.toFixed(4)} SOL</div>}
                </div>

                <Button 
                  color="primary" 
                  onClick={checkBalance} 
                  isLoading={loading} 
                  isDisabled={!connected}
                  className="w-full"
                >
                  Check Balance
                </Button>

                <div className="border-t border-gray-200 my-2" />

                <div className="text-sm text-gray-600 space-y-2">
                  <p><strong>Next Steps:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Install Arcium CLI</li>
                    <li>Start Arcium localnet: <code className="bg-gray-100 px-1 rounded">arcium localnet start</code></li>
                    <li>Deploy programs to localnet</li>
                    <li>Switch to full MPC version</li>
                  </ol>
                </div>

                <Input
                  label="Amount (SOL)"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  variant="bordered"
                  isDisabled
                />
                <Button 
                  color="primary" 
                  isDisabled
                  className="w-full"
                >
                  Send Private Payment (Coming Soon)
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
