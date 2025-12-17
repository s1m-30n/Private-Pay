import React from 'react';
import { useChain } from '@cosmos-kit/react';

export function CosmosWalletButton() {
  const { status, username, address, connect, disconnect, wallet } = useChain('osmosis');

  if (status === 'Connected') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={disconnect}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        >
          Disconnect {username || 'Wallet'}
        </button>
        <div className="text-xs text-gray-400 font-mono bg-gray-900 px-2 py-1 rounded">
          {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : ''}
        </div>
      </div>
    );
  }

  if (status === 'Connecting') {
    return (
      <button
        disabled
        className="px-4 py-2 text-sm font-medium text-white bg-gray-500 rounded-lg cursor-not-allowed"
      >
        Connecting...
      </button>
    );
  }

  return (
    <button
      onClick={() => connect()}
      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
    >
      Connect Keplr
    </button>
  );
}
