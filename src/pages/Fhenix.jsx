import React from "react";
import PrivateBalanceCard from "../components/fhenix/PrivateBalanceCard";

export default function FhenixDemoPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">
        Fhenix Private Ledger Demo
      </h1>

      <PrivateBalanceCard />
    </div>
  );
}
