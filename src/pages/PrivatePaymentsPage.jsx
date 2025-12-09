import React, { useMemo, useState } from "react";
import { Button, Card, CardBody, Input } from "@nextui-org/react";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import * as anchor from "@coral-xyz/anchor";
import { randomBytes } from "crypto";
import { useNavigate } from "react-router-dom";
import { ARCIUM_PROGRAM_ID, PRIVATE_PAY_PROGRAM_ID } from "../lib/arcium/constants.js";
import { useArciumClient, getPrivatePayProgram } from "../lib/arcium/index.js";
import {
  getArciumEnvSafe,
  getClockAccAddressSafe,
  getCompDefAccOffsetSafe,
  getCompDefAccAddressSafe,
  getComputationAccAddressSafe,
  getExecutingPoolAccAddressSafe,
  getFeePoolAccAddressSafe,
  getMempoolAccAddressSafe,
  awaitComputationFinalizationSafe,
} from "../lib/arcium/env.js";
import { Icons } from "../components/shared/Icons.jsx";

// SIGN_PDA_SEED from arcium-anchor derive_seed!(SignerAccount)
const SIGN_PDA_SEED = "SignerAccount";

export default function PrivatePaymentsPage() {
  const navigate = useNavigate();
  const { publicKey, connected, sendTransaction } = useWallet();
  const arciumClient = useArciumClient();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const provider = useMemo(() => {
    if (!arciumClient?.provider) return null;
    return arciumClient.provider;
  }, [arciumClient]);

  const program = useMemo(() => {
    if (!provider) return null;
    try {
      return getPrivatePayProgram(provider);
    } catch (error) {
      console.error("Failed to get Private Pay Program:", error);
      return null;
    }
  }, [provider]);

  const ensureReady = () => {
    if (!connected || !publicKey) {
      toast.error("Cüzdan bağlayın.");
      return false;
    }
    
    if (!arciumClient) {
      if (!connected) {
        toast.error("Cüzdan bağlayın.");
      } else if (!publicKey) {
        toast.error("Cüzdan adresi alınamadı.");
      } else {
        toast.error("Arcium client oluşturulamadı. Lütfen sayfayı yenileyin.");
      }
      return false;
    }
    
    if (!program) {
      toast.error("Program yüklenemedi. Program ID kontrol edin.");
      return false;
    }
    
    if (!PRIVATE_PAY_PROGRAM_ID) {
      toast.error("Private Pay Program ID yapılandırılmamış.");
      return false;
    }
    
    return true;
  };

  const deriveSignPda = () => {
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(SIGN_PDA_SEED)],
      ARCIUM_PROGRAM_ID
    );
    return pda;
  };

  const deriveBalancePda = (owner) => {
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("balance"), owner.toBuffer()],
      PRIVATE_PAY_PROGRAM_ID
    );
    return pda;
  };

  const deriveCompDef = (ixName) => {
    const offset = getCompDefAccOffsetSafe(ixName);
    return getCompDefAccAddressSafe(PRIVATE_PAY_PROGRAM_ID, offset);
  };

  const handleInitBalance = async () => {
    if (!ensureReady()) return;
    setLoading(true);
    toast.loading("Init balance başlatılıyor...");
    try {
      const compOffset = new anchor.BN(randomBytes(8), "hex");
      const nonce = new anchor.BN(randomBytes(16), "hex");

      const env = getArciumEnvSafe();
      const signPda = deriveSignPda();
      const balancePda = deriveBalancePda(publicKey);
      const compDef = deriveCompDef("init_balance");
      const mempool = getMempoolAccAddressSafe(env.arciumClusterOffset);
      const executingPool = getExecutingPoolAccAddressSafe(env.arciumClusterOffset);
      const clusterAccount = arciumClient.clusterAccount;
      const feePool = getFeePoolAccAddressSafe(env.arciumClusterOffset);
      const clockAcc = getClockAccAddressSafe(env.arciumClusterOffset);
      const computationAcc = getComputationAccAddressSafe(env.arciumClusterOffset, compOffset);

      const tx = await program.methods
        .createBalanceAccount(compOffset, nonce)
        .accounts({
          payer: publicKey,
          signPdaAccount: signPda,
          mxeAccount: arciumClient.mxeAccount,
          mempoolAccount: mempool,
          executingPool,
          computationAccount: computationAcc,
          compDefAccount: compDef,
          clusterAccount: clusterAccount,
          poolAccount: feePool,
          clockAccount: clockAcc,
          systemProgram: anchor.web3.SystemProgram.programId,
          arciumProgram: ARCIUM_PROGRAM_ID,
          balanceAccount: balancePda,
        })
        .transaction();

      const sig = await sendTransaction(tx, provider.connection);
      await provider.connection.confirmTransaction(sig, "confirmed");
      toast.success(`Tx gönderildi: ${sig}`);

      toast.loading("MPC hesaplaması bekleniyor...");
      await awaitComputationFinalizationSafe(provider.connection, compOffset, PRIVATE_PAY_PROGRAM_ID, "confirmed");
      toast.success("Init balance tamamlandı.");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Init balance hatası");
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!ensureReady()) return;
    if (!amount || Number(amount) <= 0) {
      toast.error("Geçerli bir miktar girin.");
      return;
    }
    setLoading(true);
    toast.loading("Deposit gönderiliyor...");
    try {
      const compOffset = new anchor.BN(randomBytes(8), "hex");
      const amountBn = new anchor.BN(amount);

      const env = getArciumEnvSafe();
      const signPda = deriveSignPda();
      const balancePda = deriveBalancePda(publicKey);
      const compDef = deriveCompDef("deposit");
      const mempool = getMempoolAccAddressSafe(env.arciumClusterOffset);
      const executingPool = getExecutingPoolAccAddressSafe(env.arciumClusterOffset);
      const clusterAccount = arciumClient.clusterAccount;
      const feePool = getFeePoolAccAddressSafe(env.arciumClusterOffset);
      const clockAcc = getClockAccAddressSafe(env.arciumClusterOffset);
      const computationAcc = getComputationAccAddressSafe(env.arciumClusterOffset, compOffset);

      const tx = await program.methods
        .depositFunds(compOffset, amountBn)
        .accounts({
          payer: publicKey,
          signPdaAccount: signPda,
          mxeAccount: arciumClient.mxeAccount,
          mempoolAccount: mempool,
          executingPool,
          computationAccount: computationAcc,
          compDefAccount: compDef,
          clusterAccount: clusterAccount,
          poolAccount: feePool,
          clockAccount: clockAcc,
          systemProgram: anchor.web3.SystemProgram.programId,
          arciumProgram: ARCIUM_PROGRAM_ID,
          balanceAccount: balancePda,
          owner: publicKey,
        })
        .transaction();

      const sig = await sendTransaction(tx, provider.connection);
      await provider.connection.confirmTransaction(sig, "confirmed");
      toast.success(`Tx gönderildi: ${sig}`);

      toast.loading("MPC hesaplaması bekleniyor...");
      await awaitComputationFinalizationSafe(provider.connection, compOffset, PRIVATE_PAY_PROGRAM_ID, "confirmed");
      toast.success("Deposit tamamlandı.");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Deposit hatası");
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
              <h1 className="font-bold text-xl text-gray-900">Private Payments</h1>
              <Button
                onClick={() => navigate("/arcium")}
                className="bg-white border border-gray-200 rounded-full px-4 h-10 flex items-center gap-2"
                variant="flat"
              >
                <Icons.back className="size-4" />
                <span className="text-sm">Back</span>
              </Button>
            </div>

            {!connected ? (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-gray-500 text-center mb-4">
                  Connect your Solana wallet to use private payments
                </p>
              </div>
            ) : (
              <>
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg space-y-1">
                  <div className="font-medium mb-2">Debug Info:</div>
                  <div>Connected: {connected ? "✓" : "✗"}</div>
                  <div>Public Key: {publicKey?.toBase58()?.slice(0, 8) + "..." ?? "N/A"}</div>
                  <div>Arcium Client: {arciumClient ? "✓" : "✗"}</div>
                  <div>Program: {program ? "✓" : "✗"}</div>
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="font-medium mb-1">Program IDs:</div>
                    <div>Arcium: {ARCIUM_PROGRAM_ID?.toBase58?.() ?? "N/A"}</div>
                    <div>Private Pay: {PRIVATE_PAY_PROGRAM_ID?.toBase58?.() ?? "N/A"}</div>
                  </div>
                </div>

                <Button 
                  color="primary" 
                  onClick={handleInitBalance} 
                  isLoading={loading} 
                  isDisabled={!connected}
                  className="w-full"
                >
                  Init Balance Account
                </Button>

                <Input
                  label="Deposit Amount (lamports)"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  variant="bordered"
                />
                <Button 
                  color="primary" 
                  onClick={handleDeposit} 
                  isLoading={loading} 
                  isDisabled={!connected}
                  className="w-full"
                >
                  Deposit
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
