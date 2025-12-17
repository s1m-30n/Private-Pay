import { useChain } from '@cosmos-kit/react';
import { coins } from '@cosmjs/amino';
import { useState } from 'react';
import { motion } from 'framer-motion';

// PrivatePay Bridge Vault on Osmosis
const BRIDGE_VAULT_ADDRESS = 'osmo18s5lynnx550aw5rqlmg32cne6083893nq8p5q4'; 

export const BridgeComponent = () => {
  const { address, getSigningStargateClient } = useChain('osmosis');
  const [amount, setAmount] = useState('');
  const [isBridging, setIsBridging] = useState(false);
  const [step, setStep] = useState('idle'); // idle, signing, bridging, completed
  const [txHash, setTxHash] = useState('');

  const handleBridge = async () => {
    if (!amount || !address) return;
    
    setIsBridging(true);
    setStep('signing');

    try {
        const client = await getSigningStargateClient();
        
        // 1. Convert amount to uosmo (6 decimals)
        const microAmount = Math.floor(parseFloat(amount) * 1_000_000).toString();
        
        const fee = {
            amount: coins(5000, 'uosmo'),
            gas: '200000'
        };

        
        
        const memo = `BRIDGE_TO_ZCASH:zs1...`; 

        const result = await client.sendTokens(
            address,
            BRIDGE_VAULT_ADDRESS,
            coins(microAmount, 'uosmo'),
            fee,
            memo
        );

        if (result.code === 0) {
            setTxHash(result.transactionHash);
            setStep('bridging');
            // Simulate bridge operator time (on-chain part is done)
            setTimeout(() => {
                setStep('completed');
                setIsBridging(false);
            }, 2000);
        } else {
            console.error('Transaction Failed:', result);
            setIsBridging(false);
            setStep('idle');
            alert(`Transaction failed: ${result.rawLog}`);
        }

    } catch (error) {
        console.error('Bridge Error:', error);
        setIsBridging(false);
        setStep('idle');
        alert(error.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="border border-gray-800/20 rounded-xl p-6 relative overflow-hidden shadow-lg"
    >
      <div className="absolute top-0 right-0 p-4 opacity-20 text-purple-600/20">
        <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-black mb-6">
        Privacy Bridge (IBC ↔ Zcash)
      </h2>

      <div className="space-y-6">
        <div className="p-4 rounded-lg border border-gray-800/20">
             <label className="text-xs text-gray-500 uppercase font-semibold">From (Osmosis)</label>
             <div className="flex justify-between items-center mt-2">
                 <input 
                    type="number" 
                    placeholder="0.00"
                    value={amount}
                    
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-2xl font-bold focus:outline-none w-full"
                 />
                 <span className="px-3 py-1 rounded text-sm font-bold border border-purple-500/30">
                     OSMO
                 </span>
             </div>
        </div>

        <div className="flex justify-center -my-3 z-10 relative">
            <div className="bg-gray-800 p-2 rounded-full border border-gray-700 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-800/20">
             <label className="text-xs text-gray-500 uppercase font-semibold">To (Zcash Shielded)</label>
             <div className="flex justify-between items-center mt-2">
                 <span className="text-2xl font-bold text-gray-400">
                     {amount ? (parseFloat(amount) * 0.05).toFixed(4) : '0.00'}
                 </span>
                 <span className="bg-yellow-400 px-3 py-1 rounded text-sm">
                     ZEC
                 </span>
             </div>
             <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Shielded Address (zs1...)
             </p>
        </div>

        {step === 'completed' ? (
             <div className="bg-green-900/20 border  rounded-lg p-4 text-center">
                 <p className=" font-bold mb-1">Bridge Successful!</p>
                 <p className="text-xs text-green-600">Assets sent to Bridge Vault.</p>
                 {txHash && (
                    <a 
                        href={`https://www.mintscan.io/osmosis/tx/${txHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-gray-500 hover:text-purple-400 block mt-1 break-all"
                    >
                        TX: {txHash}
                    </a>
                 )}
                 <button onClick={() => setStep('idle')} className="text-xs text-gray-400 underline mt-2 hover:text-white">Bridge more</button>
             </div>
        ) : (
            <button
                disabled={!amount || isBridging}
                onClick={handleBridge}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                    !amount 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : isBridging 
                        ? 'bg-gray-800 text-white cursor-wait'
                        : 'text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/20'
                }`}
            >
                {step === 'signing' ? 'Signing Transaction...' : 
                 step === 'bridging' ? 'Bridging Assets...' : 
                 'Bridge to Privacy'}
            </button>
        )}
      </div>
    </motion.div>
  );
};
