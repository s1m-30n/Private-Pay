import { ChainProvider } from '@cosmos-kit/react';
import { default as osmosisChain } from '@chain-registry/osmosis/chain';
import { default as osmosisAssets } from '@chain-registry/osmosis/assets';
import { default as osmosisTestnetChain } from '@chain-registry/osmosis/testnet';
import { default as osmosisTestnetAssets } from '@chain-registry/osmosis/testnet_assets';
import { wallets as keplrWallets } from '@cosmos-kit/keplr';
import { wallets as leapWallets } from '@cosmos-kit/leap';
import '@interchain-ui/react/styles';

// 1. Override RPC endpoints to fix CORS/Timeout issues
const osmosisChainModified = {
  ...osmosisChain,
  apis: {
    rpc: [
      { address: 'https://osmosis-rpc.publicnode.com', provider: 'PublicNode' },
      { address: 'https://rpc.osmosis.zone', provider: 'Osmosis Foundation' },
      { address: 'https://osmosis-rpc.polkachu.com', provider: 'Polkachu' },
      { address: 'https://rpc.osmosis.interbloc.org', provider: 'Interbloc' },
      { address: 'https://osmosis.rpc.stakin-nodes.com', provider: 'Stakin' }
    ],
    rest: [
      { address: 'https://osmosis-rest.publicnode.com', provider: 'PublicNode' },
      { address: 'https://lcd.osmosis.zone', provider: 'Osmosis Foundation' }
    ]
  }
};

const osmosisTestnetChainModified = {
  ...osmosisTestnetChain,
  apis: {
    rpc: [
      { address: 'https://osmosis-testnet-rpc.publicnode.com', provider: 'PublicNode' },
      { address: 'https://rpc.testnet.osmosis.zone', provider: 'Osmosis Foundation' },
      { address: 'https://osmosis-testnet-rpc.polkachu.com', provider: 'Polkachu' }
    ],
    rest: [
      { address: 'https://osmosis-testnet-rest.publicnode.com', provider: 'PublicNode' },
      { address: 'https://lcd.testnet.osmosis.zone', provider: 'Osmosis Foundation' }
    ]
  }
};

const supportedChains = [osmosisChainModified, osmosisTestnetChainModified];
const supportedAssets = [osmosisAssets, osmosisTestnetAssets];

export function CosmosProvider({ children }) {
  return (
    <ChainProvider
      chains={supportedChains}
      assetLists={supportedAssets}
      // Explicitly find the extension wallets to ensure we don't load mobile or missing ones
      wallets={[
        keplrWallets.find(w => w.mode === 'extension' || w.walletInfo?.mode === 'extension'),
        leapWallets.find(w => w.mode === 'extension' || w.walletInfo?.mode === 'extension')
      ].filter(Boolean)}
      endpointOptions={{
        osmosis: {
          rpc: [
            'https://osmosis-rpc.publicnode.com', 
            'https://rpc.osmosis.zone',
            'https://osmosis-rpc.polkachu.com'
          ],
          rest: [
            'https://osmosis-rest.publicnode.com',
            'https://lcd.osmosis.zone'
          ]
        },
        osmosistestnet: {
            rpc: [
                'https://osmosis-testnet-rpc.publicnode.com',
                'https://rpc.testnet.osmosis.zone'
            ],
            rest: [
                'https://osmosis-testnet-rest.publicnode.com',
                'https://lcd.testnet.osmosis.zone'
            ]
        }
      }}
    >
      {children}
    </ChainProvider>
  );
}
