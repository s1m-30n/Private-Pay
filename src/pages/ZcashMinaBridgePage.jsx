import { useState } from "react";
import { Button, Card, CardBody, Progress, Chip } from "@nextui-org/react";
import { useZcash } from "../providers/ZcashProvider";
import { useMina } from "../components/mina-protocol/MinaProvider";
import toast from "react-hot-toast";
import { ArrowRight, ShieldCheck, FileCode, CheckCircle2, Zap, Lock, Shield, ArrowLeftRight, Loader2 } from "lucide-react";

export default function ZcashMinaBridgePage() {
    const { zcashAccount, isConnected: isZcashConnected, createWallet: createZcashWallet } = useZcash();
    const { minaAccount, isConnected: isMinaConnected, connect: connectMina } = useMina();

    const [step, setStep] = useState(0);
    // 0: Init, 1: Lock ZEC, 2: Prove (SPV), 3: Verify (Recursive), 4: Mint

    const [proofData, setProofData] = useState(null);

    const handleStart = async () => {
        if (!isZcashConnected) {
            createZcashWallet(); // Auto-create for demo flow if needed
            // Ideally wait for user to confirm
        }
        if (!isMinaConnected && window.mina) {
            await connectMina();
        }

        if (isZcashConnected) setStep(1);
        else toast("Please connect wallets first");
    };

    const handleLock = async () => {
        // Step 1: Simulate sending ZEC
        toast.loading("Broadcasting Zcash Transaction...", { duration: 2000 });
        await new Promise(r => setTimeout(r, 2000));

        // Mock transaction data
        const tx = {
            txid: 'mock-tx-' + Date.now(),
            amount: 10,
            recipient: 'bridge-vault'
        };
        console.log("Locked ZEC:", tx);

        toast.success("ZEC Locked! Block #24501");
        setStep(2);
    };

    const handleProve = async () => {
        // Step 2: Simulate Generating SPV Proof (Client Side)
        setStep(2.5); // "Proving" internal state

        // Mock heavy computation
        for (let i = 0; i < 100; i += 10) {
            await new Promise(r => setTimeout(r, 300)); // Simulate proving loop
        }

        setProofData({
            proof: "pi_zec_snark_bytes_xyz...",
            publicInput: { root: "0x123", amount: 10 }
        });

        toast.success("ZK Proof Generated!");
        setStep(3);
    };

    const handleVerifyAndMint = async () => {
        // Step 3: Submit to Mina zkApp
        toast.loading("Submitting to Mina network...", { duration: 2000 });
        await new Promise(r => setTimeout(r, 2000));

        // Simulate recursion check
        toast.success("Recursion Verified! Minting wZEC...");
        setStep(4);
    };

    return (
        <div className="flex flex-col items-center w-full min-h-[85vh] p-4 py-12 gap-8 pb-24">
            <div className="text-center max-w-2xl space-y-4">
                <div className="flex items-center justify-center gap-4 mb-4">
                    <img src="/assets/zcash_logo.png" alt="Zcash" className="w-12 h-12 rounded-full" />
                    <ArrowLeftRight className="w-8 h-8 text-gray-400" />
                    <img src="/assets/mina_logo.png" alt="Mina" className="w-12 h-12 rounded-full" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                    Zcash × Mina Bridge
                </h1>
                <p className="text-xl font-semibold text-gray-700">
                    Programmable Privacy Bridge
                </p>
                <p className="text-gray-500">
                    Trustless bridging using recursive ZK proofs. Verifying Zcash chain state inside a Mina zkApp.
                </p>
            </div>

            <Card className="w-full max-w-5xl shadow-lg bg-white border border-gray-200 rounded-3xl">
                <CardBody className="p-8 gap-8">

                    {/* Visual Architecture Diagram */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative">
                        {/* Zcash Node */}
                        <Card className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all min-w-[180px] ${step >= 1 ? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-md" : "border-gray-200 bg-white"}`}>
                            <div className={`p-4 rounded-full transition-all ${step >= 1 ? "bg-gradient-to-br from-yellow-400 to-amber-400" : "bg-gray-100"}`}>
                                <img src="/assets/zcash_logo.png" alt="Zcash" className="w-10 h-10 rounded-full" />
                            </div>
                            <div className="text-center">
                                <span className="font-bold text-gray-900 block">Zcash Chain</span>
                                <span className="text-xs text-gray-500">Source of Truth</span>
                            </div>
                            {step >= 1 && (
                                <Chip size="sm" color="warning" variant="flat">
                                    Locked
                                </Chip>
                            )}
                        </Card>

                        {/* Arrow */}
                        <div className="flex flex-col items-center">
                            <ArrowRight className={`hidden md:block w-8 h-8 transition-all ${step >= 2 ? "text-yellow-500 animate-pulse" : "text-gray-300"}`} />
                            {step >= 2 && (
                                <Zap className="w-5 h-5 text-yellow-500 mt-2 animate-pulse" />
                            )}
                        </div>

                        {/* Prover Node */}
                        <Card className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all min-w-[180px] ${step >= 2 ? "border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md" : "border-gray-200 bg-white"}`}>
                            <div className={`p-4 rounded-full transition-all ${step >= 2 ? "bg-gradient-to-br from-blue-400 to-indigo-400" : "bg-gray-100"}`}>
                                <ShieldCheck size={32} className={step >= 2 ? "text-white" : "text-gray-400"} />
                            </div>
                            <div className="text-center">
                                <span className="font-bold text-gray-900 block">ZK Prover</span>
                                <span className="text-xs text-gray-500">Client-Side</span>
                            </div>
                            {step >= 2 && (
                                <Chip size="sm" color="primary" variant="flat">
                                    Proving
                                </Chip>
                            )}
                        </Card>

                        {/* Arrow */}
                        <div className="flex flex-col items-center">
                            <ArrowRight className={`hidden md:block w-8 h-8 transition-all ${step >= 3 ? "text-orange-500 animate-pulse" : "text-gray-300"}`} />
                            {step >= 3 && (
                                <Zap className="w-5 h-5 text-orange-500 mt-2 animate-pulse" />
                            )}
                        </div>

                        {/* Mina Node */}
                        <Card className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all min-w-[180px] ${step >= 3 ? "border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md" : "border-gray-200 bg-white"}`}>
                            <div className={`p-4 rounded-full transition-all ${step >= 3 ? "bg-gradient-to-br from-orange-400 to-amber-400" : "bg-gray-100"}`}>
                                <img src="/assets/mina_logo.png" alt="Mina" className="w-10 h-10 rounded-full" />
                            </div>
                            <div className="text-center">
                                <span className="font-bold text-gray-900 block">Mina zkApp</span>
                                <span className="text-xs text-gray-500">Recursive Verify</span>
                            </div>
                            {step >= 3 && (
                                <Chip size="sm" color="warning" variant="flat">
                                    Verifying
                                </Chip>
                            )}
                        </Card>
                    </div>

                    {/* Interactive Flow */}
                    <Card className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 min-h-[300px]">
                        <CardBody className="p-8 flex flex-col justify-center items-center gap-6">
                        {step === 0 && (
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center">
                                    <ArrowLeftRight className="w-10 h-10 text-orange-600" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Initialize Bridge</h3>
                                    <p className="text-gray-600 mb-6">Connect your Zcash and Mina wallets to start the bridge process</p>
                                </div>
                                <Button
                                    size="lg"
                                    className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-lg px-8 py-6 h-14 shadow-lg hover:shadow-xl transition-all"
                                    onClick={handleStart}
                                    startContent={<Zap className="w-5 h-5" />}
                                >
                                    Initialize Bridge
                                </Button>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-4 text-center w-full max-w-md animate-in fade-in">
                                <div className="flex items-center justify-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-400 flex items-center justify-center">
                                        <Lock className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Step 1: Lock Assets</h3>
                                        <p className="text-sm text-gray-500">Lock ZEC on Zcash</p>
                                    </div>
                                </div>
                                <p className="text-gray-600">Send 10 ZEC to the bridge vault address on the Zcash network.</p>
                                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <img src="/assets/zcash_logo.png" alt="ZEC" className="w-6 h-6 rounded-full" />
                                            <span className="font-semibold text-gray-900">10 ZEC</span>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm text-gray-600">Bridge Vault</span>
                                    </div>
                                </div>
                                <Button 
                                    className="w-full h-12 font-bold bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg hover:shadow-xl transition-all" 
                                    onClick={handleLock}
                                    startContent={<Lock className="w-5 h-5" />}
                                >
                                    Sign Zcash Transaction
                                </Button>
                            </div>
                        )}

                        {(step === 2 || step === 2.5) && (
                            <div className="space-y-4 text-center w-full max-w-md animate-in fade-in">
                                <div className="flex items-center justify-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center">
                                        <Shield className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Step 2: Generate ZK Proof</h3>
                                        <p className="text-sm text-gray-500">Client-Side Proving</p>
                                    </div>
                                </div>
                                <p className="text-gray-600">Prove that your transaction is included in a valid Zcash block header.</p>
                                {step === 2.5 && (
                                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                                        <CardBody className="p-4">
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                                <div className="flex-1">
                                                    <Progress size="sm" isIndeterminate color="primary" aria-label="Proving..." className="max-w-full" />
                                                    <p className="text-xs text-gray-600 mt-2">Generating zk-SNARK proof...</p>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                )}
                                <Button
                                    className="w-full h-12 font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all"
                                    onClick={handleProve}
                                    isLoading={step === 2.5}
                                    startContent={step !== 2.5 && <Shield className="w-5 h-5" />}
                                >
                                    {step === 2.5 ? "Generating Circuit Proof..." : "Generate SPV Proof"}
                                </Button>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4 text-center w-full max-w-md animate-in fade-in">
                                <div className="flex items-center justify-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center">
                                        <FileCode className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Step 3: Recursive Verification</h3>
                                        <p className="text-sm text-gray-500">Mina zkApp Verify</p>
                                    </div>
                                </div>
                                <p className="text-gray-600">The Mina zkApp will verify your Zcash proof recursively inside its own circuit.</p>
                                <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700">
                                    <CardBody className="p-4">
                                        <div className="text-green-400 font-mono text-xs text-left space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400">Proof:</span>
                                                <span className="truncate">{proofData?.proof.slice(0, 40)}...</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400">Root:</span>
                                                <span>{proofData?.publicInput.root}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400">Amount:</span>
                                                <span>{proofData?.publicInput.amount} ZEC</span>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                                <Button 
                                    className="w-full h-12 font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg hover:shadow-xl transition-all" 
                                    onClick={handleVerifyAndMint}
                                    startContent={<Zap className="w-5 h-5" />}
                                >
                                    Verify on Mina & Mint
                                </Button>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                                    <CheckCircle2 size={48} className="text-green-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-green-700">Bridge Successful!</h2>
                                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 max-w-md">
                                    <CardBody className="p-6 text-center">
                                        <p className="text-gray-700 mb-3">
                                            The Mina zkApp cryptographically verified the Zcash state.
                                        </p>
                                        <div className="flex items-center justify-center gap-2 bg-white rounded-lg p-3 border border-green-200">
                                            <img src="/assets/zcash_logo.png" alt="wZEC" className="w-6 h-6 rounded-full" />
                                            <span className="text-lg font-bold text-gray-900">10 wZEC</span>
                                            <span className="text-sm text-gray-600">minted to</span>
                                            <code className="text-sm font-mono text-gray-700">{minaAccount?.slice(0, 8)}...</code>
                                        </div>
                                    </CardBody>
                                </Card>
                                <Button 
                                    variant="bordered" 
                                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                    onClick={() => setStep(0)}
                                >
                                    Reset Demo
                                </Button>
                            </div>
                        )}
                        </CardBody>
                    </Card>

                </CardBody>
            </Card>

            <Card className="bg-transparent border border-gray-200 max-w-2xl">
                <CardBody className="p-4">
                    <p className="text-xs text-gray-500 text-center">
                        <strong className="text-gray-700">Note:</strong> This is a simulation. In production, this requires `zcash-light-client-ffi` compiled to WASM and a Pickles-compatible circuit implementation.
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
