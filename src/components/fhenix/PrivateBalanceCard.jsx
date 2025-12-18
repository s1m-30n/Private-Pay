import React, { useEffect, useState } from "react";
import {
  getPrivateBalance,
  depositPrivate,
  privateTransfer,
} from "../../lib/fhenix/actions";

export default function PrivateBalanceCard() {
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function refreshBalance() {
    setStatus("Requesting Permit...");
    try {
      const b = await getPrivateBalance();
      setBalance(b);
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus("Failed to fetch balance.");
    }
  }

  async function handleAction(actionFn, successMsg) {
    if (!amount || isNaN(Number(amount))) return;
    setLoading(true);
    setStatus("Processing encryption...");
    try {
      await actionFn();
      setStatus(successMsg);
      setAmount("");
      setTo("");
      await refreshBalance();
    } catch (err) {
      console.error(err);
      setStatus("Error: " + (err.reason || "Transaction failed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshBalance();
  }, []);

  return (
    <div className="border border-slate-200 rounded-xl p-6 max-w-md space-y-4 bg-white shadow-sm">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">
          🔐 Private Ledger
        </h2>
        <button 
          onClick={refreshBalance} 
          className="text-xs text-indigo-600 hover:underline"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg text-center">
        <div className="text-gray-500 text-xs uppercase tracking-wider font-semibold">
          Your Private Balance
        </div>
        <div className="text-3xl font-mono font-bold text-indigo-700 mt-1">
          {balance === null ? "---" : `${balance} FHE`}
        </div>
      </div>

      {status && (
        <div className="text-xs text-center py-1 px-2 bg-amber-50 text-amber-700 rounded animate-pulse">
          {status}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">Amount</label>
        <input
          type="number"
          className="border border-slate-300 p-2 w-full rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleAction(() => depositPrivate(Number(amount)), "Deposit Successful!")}
          disabled={loading}
          className="bg-slate-900 hover:bg-black text-white p-2 rounded-md disabled:opacity-50 transition-all"
        >
          Deposit
        </button>
        <button
          onClick={() => {
            if(!to) { setStatus("Enter recipient"); return; }
            handleAction(() => privateTransfer(to, Number(amount)), "Transfer Successful!");
          }}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-md disabled:opacity-50 transition-all"
        >
          Send Private
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">Recipient Address</label>
        <input
          className="border border-slate-300 p-2 w-full rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="0x..."
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      <p className="text-[10px] text-slate-400 text-center italic">
        Powered by Fhenix Nitrogen (FHE)
      </p>
    </div>
  );
}