import React, { useEffect, useState } from 'react';
import { useChain } from '@cosmos-kit/react';
import { CosmosWalletButton } from '../components/osmosis/CosmosWalletButton';
import { BridgeComponent } from '../components/osmosis/BridgeComponent';
import { PrivacyPayment } from '../components/osmosis/PrivacyPayment';
import { motion } from 'framer-motion';
import { Card, CardBody, Chip, Tabs, Tab } from '@nextui-org/react';
import { Shield, Eye, EyeOff, ArrowLeftRight, Coins, Zap } from 'lucide-react';

export default function OsmosisPage() {
  const { address, status, getCosmWasmClient } = useChain('osmosis');
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    async function fetchBalance() {
      if (status === 'Connected' && address) {
        try {
          setLoading(true);
          const client = await getCosmWasmClient();
          const coin = await client.getBalance(address, 'uosmo');
          setBalance(coin);
        } catch (error) {
          console.error('Error fetching balance:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setBalance(null);
      }
    }
    fetchBalance();
  }, [status, address, getCosmWasmClient]);

  const togglePrivacy = () => setPrivacyMode(!privacyMode);

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[80vh] gap-8 p-4 pb-24">
      <div className="flex items-center gap-3">
        <img src="/assets/osmosis-logo.png" alt="Osmosis" className="w-10 h-10 rounded-full" />
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Osmosis Privacy Layer
        </h1>
      </div>

      <p className="text-gray-600 max-w-lg text-center">
        Interchain shielded pool and asset bridge with privacy-preserving transactions.
      </p>

      {status !== 'Connected' ? (
        <Card className="max-w-md w-full">
          <CardBody className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <Shield className="w-10 h-10 text-blue-600" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Wallet</h3>
              <p className="text-gray-500 text-sm">
                Connect your Keplr or Leap wallet to access Osmosis privacy features
              </p>
            </div>
            <CosmosWalletButton />
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col w-full max-w-6xl gap-6">
          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 shadow-sm rounded-3xl">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Balance</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-3xl font-bold text-gray-900">
                      {showBalance && !privacyMode 
                        ? (loading ? '...' : balance ? `$${(Number(balance.amount) / 1_000_000 * 1.5).toFixed(2)}` : '$0.00')
                        : '****'}
                    </h2>
                    <div className="flex items-center gap-1">
                      <img src="/assets/osmosis-logo.png" alt="OSMO" className="w-6 h-6 rounded-full" />
                      <span className="text-lg font-semibold text-blue-600">OSMO</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-gray-500">
                      {showBalance && !privacyMode
                        ? (loading ? '...' : balance ? `${(Number(balance.amount) / 1_000_000).toFixed(4)} OSMO` : '0.0000 OSMO')
                        : '**** OSMO'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-2 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    {showBalance ? <EyeOff className="w-5 h-5 text-gray-600" /> : <Eye className="w-5 h-5 text-gray-600" />}
                  </button>
                  <button
                    onClick={togglePrivacy}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                      privacyMode 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-md' 
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-medium">{privacyMode ? 'Privacy ON' : 'Privacy OFF'}</span>
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Main Content with Tabs */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-3xl">
            <CardBody className="p-0">
              <Tabs
                selectedKey={activeTab}
                onSelectionChange={setActiveTab}
                aria-label="Osmosis Options"
                color="secondary"
                variant="underlined"
                classNames={{
                  tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider px-6",
                  tab: "max-w-fit px-0 h-12",
                  tabContent: "group-data-[selected=true]:text-blue-600 group-data-[selected=true]:font-semibold",
                  cursor: "bg-gradient-to-r from-blue-600 to-indigo-600",
                }}
              >
                <Tab
                  key="overview"
                  title={
                    <div className="flex items-center gap-2">
                      <Coins size={18} />
                      <span>Overview</span>
                    </div>
                  }
                >
                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Bridge Component */}
                      <div>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                          Cross-Chain Bridge
                        </h3>
                        <BridgeComponent />
                      </div>

                      {/* Privacy Payment */}
                      <div>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-blue-600" />
                          Private Payments
                        </h3>
                        <PrivacyPayment />
                      </div>
                    </div>
                  </div>
                </Tab>

                <Tab
                  key="bridge"
                  title={
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight size={18} />
                      <span>Bridge</span>
                    </div>
                  }
                >
                  <div className="p-6">
                    <BridgeComponent />
                  </div>
                </Tab>

                <Tab
                  key="payments"
                  title={
                    <div className="flex items-center gap-2">
                      <Shield size={18} />
                      <span>Private Payments</span>
                    </div>
                  }
                >
                  <div className="p-6">
                    <PrivacyPayment />
                  </div>
                </Tab>
              </Tabs>
            </CardBody>
          </Card>

          {/* Info Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
            <CardBody className="p-6">
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Interchain Privacy</h3>
                  <p className="text-gray-600 text-sm">
                    Osmosis enables private cross-chain transactions through IBC. Your transaction amounts and 
                    recipient addresses remain hidden using shielded pools and zero-knowledge proofs, providing 
                    complete privacy across the Cosmos ecosystem.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
