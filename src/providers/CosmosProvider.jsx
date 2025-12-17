import { ChainProvider } from '@cosmos-kit/react';
import { default as osmosisChain } from '@chain-registry/osmosis/chain';
import { default as osmosisAssets } from '@chain-registry/osmosis/assets';
import { wallets as keplrWallets } from '@cosmos-kit/keplr';
import { wallets as leapWallets } from '@cosmos-kit/leap';
import '@interchain-ui/react/styles';

const supportedChains = [osmosisChain];
const supportedAssets = [osmosisAssets];

export function CosmosProvider({ children }) {
  return (
    <ChainProvider
      chains={supportedChains}
      assetLists={supportedAssets}
      wallets={[...keplrWallets, ...leapWallets]}
      walletConnectOptions={{
        signClient: {
          projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID, // placeholder
          // relayUrl: 'wss://relay.walletconnect.org',
          metadata: {
            name: 'PrivatePay',
            description: 'PrivatePay Osmosis Integration',
            url: import.meta.env.VITE_WEBSITE_HOST,
            icons: [],
          },
        },
      }}
    >
      {children}
    </ChainProvider>
  );
}
