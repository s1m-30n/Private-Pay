// relayer/config.js

const config = {
  // Zcash RPC configuration
  zcash: {
    rpcUrl: process.env.VITE_ZCASH_RPC_URL || 'http://localhost:18232',
    rpcUser: process.env.VITE_ZCASH_RPC_USER || 'your_rpc_user',
    rpcPassword: process.env.VITE_ZCASH_RPC_PASSWORD || 'your_rpc_password',
    walletPassphrase: process.env.VITE_TREASURY_PRIVATE_KEY || 'your_wallet_passphrase',
    minConfirmations: parseInt(process.env.VITE_ZCASH_MIN_CONFIRMATIONS || '6')
  },
  
  // Miden node configuration
  miden: {
    nodeUrl: process.env.VITE_MIDEN_NODE_URL || 'http://localhost:8080',
    bridgeProgramId: process.env.VITE_MIDEN_BRIDGE_PROGRAM_ID || 'bridge_program_123',
    privateKey: process.env.VITE_TREASURY_PRIVATE_KEY || 'your_private_key'
  },
  // Optional external ZK verifier service
  zkVerifierUrl: process.env.VITE_ZK_VERIFIER_URL || process.env.ZK_VERIFIER_URL || null,
  
  // Relayer configuration
  pollInterval: parseInt(process.env.VITE_RELAYER_POLL_INTERVAL || '15000'), // 15 seconds
  maxRetries: parseInt(process.env.VITE_RELAYER_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.VITE_RELAYER_RETRY_DELAY || '5000'), // 5 seconds
  
  // Logging
  logLevel: process.env.VITE_LOG_LEVEL || 'info',
  logFile: process.env.VITE_LOG_FILE || 'relayer.log'
};

export default config;