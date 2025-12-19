import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createBridgeOperator } from './services/bridgeOperator.js';
import { createZECOracle } from './services/oracle.js';
import { createWebhookRouter, HeliusWebhookHandler } from './services/heliusWebhook.js';

// Configuration
const config = {
  zcash: {
    rpcUrl: process.env.ZCASH_RPC_URL || 'http://localhost:18232',
    rpcUser: process.env.ZCASH_RPC_USER || '',
    rpcPassword: process.env.ZCASH_RPC_PASSWORD || '',
    bridgeAddress: process.env.ZCASH_BRIDGE_ADDRESS || '',
    scanInterval: 60000, // 1 minute
  },
  aztec: {
    pxeUrl: process.env.AZTEC_PXE_URL || 'http://localhost:8080',
    bridgeContract: process.env.AZTEC_BRIDGE_CONTRACT || '',
    scanInterval: 60000, // 1 minute
  },
  oracle: {
    updateInterval: 60000, // 1 minute
    coinmarketcap: {
      apiKey: process.env.COINMARKETCAP_API_KEY || '',
    },
  },
  helius: {
    apiKey: process.env.HELIUS_API_KEY || '',
    network: process.env.SOLANA_NETWORK || 'mainnet',
    operatorPrivateKey: process.env.BRIDGE_OPERATOR_PRIVATE_KEY || '',
    zcashBridgeAddress: process.env.ZCASH_BRIDGE_ADDRESS || '',
  },
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
  },
};

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Bridge Backend Services...\n');

  try {
    // Create Express app for webhook endpoints
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Initialize bridge operator
    const bridgeOperator = createBridgeOperator(config);
    await bridgeOperator.initialize();
    await bridgeOperator.start();

    // Initialize oracle
    const oracle = createZECOracle(config.oracle);
    await oracle.initialize();
    await oracle.start();

    // Initialize Helius webhook handler
    let heliusHandler = null;
    if (config.helius.apiKey) {
      const { router: webhookRouter, handler } = createWebhookRouter({
        heliusApiKey: config.helius.apiKey,
        network: config.helius.network,
        operatorPrivateKey: config.helius.operatorPrivateKey,
        zcashBridgeAddress: config.helius.zcashBridgeAddress,
        zcashRpcClient: bridgeOperator.zcashClient,
        zcashWallet: bridgeOperator.zcashWallet,
      });
      
      heliusHandler = handler;
      await heliusHandler.initialize();
      
      app.use('/api', webhookRouter);
      console.log('✅ Helius webhook handler initialized');
    }

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        services: {
          bridgeOperator: bridgeOperator.isRunning,
          oracle: oracle.isRunning,
          heliusWebhook: !!heliusHandler,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Start HTTP server
    const server = app.listen(config.server.port, config.server.host, () => {
      console.log(`✅ HTTP server listening on ${config.server.host}:${config.server.port}`);
    });

    console.log('\n✅ All services started successfully');
    console.log('Press Ctrl+C to stop\n');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      server.close();
      await bridgeOperator.stop();
      await oracle.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start services:', error);
    process.exit(1);
  }
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createBridgeOperator, createZECOracle, HeliusWebhookHandler, createWebhookRouter };





