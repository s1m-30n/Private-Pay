import express from 'express';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

// Official SPL Memo Program ID (https://solscan.io/account/MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr)
const SPL_MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

function getBridgeProgramId() {
  const programId = process.env.ZCASH_BRIDGE_PROGRAM_ID;
  if (!programId) {
    throw new Error(
      'ZCASH_BRIDGE_PROGRAM_ID environment variable is required. ' +
      'Deploy the zcash_bridge program and set the program ID.'
    );
  }
  try {
    new PublicKey(programId);
  } catch {
    throw new Error(`Invalid ZCASH_BRIDGE_PROGRAM_ID: ${programId}`);
  }
  return programId;
}

export class HeliusWebhookHandler {
  constructor(config) {
    this.config = config;
    this.connection = null;
    this.program = null;
    this.operatorKeypair = null;
    this.pendingDeposits = new Map();
    this.pendingWithdrawals = new Map();
    this.processedSignatures = new Set();
  }

  async initialize() {
    const heliusRpcUrl = `https://${this.config.network}.helius-rpc.com/?api-key=${this.config.heliusApiKey}`;
    this.connection = new Connection(heliusRpcUrl, 'confirmed');

    if (this.config.operatorPrivateKey) {
      const privateKeyBytes = bs58.decode(this.config.operatorPrivateKey);
      this.operatorKeypair = Keypair.fromSecretKey(privateKeyBytes);
    }

    if (this.operatorKeypair) {
      const wallet = new Wallet(this.operatorKeypair);
      const provider = new AnchorProvider(this.connection, wallet, {
        commitment: 'confirmed',
      });
      
      try {
        const bridgeProgramId = getBridgeProgramId();
        this.bridgeProgramId = bridgeProgramId;
        const idl = await Program.fetchIdl(new PublicKey(bridgeProgramId), provider);
        if (idl) {
          this.program = new Program(idl, new PublicKey(bridgeProgramId), provider);
        } else {
          throw new Error('Bridge program IDL not found on-chain');
        }
      } catch (error) {
        throw new Error(`Failed to initialize bridge program: ${error.message}`);
      }
    }
  }

  createExpressMiddleware() {
    return async (req, res) => {
      try {
        const events = req.body;
        
        if (!Array.isArray(events)) {
          return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        for (const event of events) {
          await this.processEvent(event);
        }

        res.status(200).json({ success: true, processed: events.length });
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  async processEvent(event) {
    if (!event || !event.signature) {
      return;
    }

    if (this.processedSignatures.has(event.signature)) {
      return;
    }
    this.processedSignatures.add(event.signature);

    if (this.processedSignatures.size > 10000) {
      const toDelete = Array.from(this.processedSignatures).slice(0, 5000);
      toDelete.forEach(sig => this.processedSignatures.delete(sig));
    }

    const eventType = this.classifyEvent(event);

    switch (eventType) {
      case 'DEPOSIT_INITIATED':
        await this.handleDepositInitiated(event);
        break;
      case 'WITHDRAWAL_INITIATED':
        await this.handleWithdrawalInitiated(event);
        break;
      case 'STEALTH_PAYMENT':
        await this.handleStealthPayment(event);
        break;
      default:
        break;
    }
  }

  classifyEvent(event) {
    if (!event.instructions) {
      return 'UNKNOWN';
    }

    for (const ix of event.instructions) {
      const programId = ix.programId || ix.program_id;
      if (programId !== BRIDGE_PROGRAM_ID) continue;

      if (ix.parsed?.type === 'initiateDeposit' || this.isDepositInstruction(ix)) {
        return 'DEPOSIT_INITIATED';
      }
      if (ix.parsed?.type === 'initiateWithdrawal' || this.isWithdrawalInstruction(ix)) {
        return 'WITHDRAWAL_INITIATED';
      }
      if (ix.parsed?.type === 'sendToStealth' || this.isStealthPaymentInstruction(ix)) {
        return 'STEALTH_PAYMENT';
      }
    }

    return 'UNKNOWN';
  }

  isDepositInstruction(ix) {
    if (!ix.data) return false;
    const data = typeof ix.data === 'string' ? bs58.decode(ix.data) : ix.data;
    return data.length >= 8 && data[0] === 0x01;
  }

  isWithdrawalInstruction(ix) {
    if (!ix.data) return false;
    const data = typeof ix.data === 'string' ? bs58.decode(ix.data) : ix.data;
    return data.length >= 8 && data[0] === 0x03;
  }

  isStealthPaymentInstruction(ix) {
    if (!ix.data) return false;
    const data = typeof ix.data === 'string' ? bs58.decode(ix.data) : ix.data;
    return data.length >= 8 && data[0] === 0x06;
  }

  async handleDepositInitiated(event) {
    const depositInfo = this.extractDepositInfo(event);
    
    this.pendingDeposits.set(depositInfo.ticketId, {
      ...depositInfo,
      status: 'pending_zcash_transfer',
      createdAt: Date.now(),
    });

    await this.initiateZcashTransfer(depositInfo);
  }

  extractDepositInfo(event) {
    const depositInstruction = event.instructions?.find(ix => 
      (ix.programId || ix.program_id) === BRIDGE_PROGRAM_ID
    );

    let ticketId = '0';
    let amount = 0;
    let zcashAddress = null;

    if (event.nativeTransfers && event.nativeTransfers.length > 0) {
      amount = event.nativeTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);
    }

    if (event.tokenTransfers && event.tokenTransfers.length > 0) {
      amount = event.tokenTransfers.reduce((sum, t) => sum + (t.tokenAmount || 0), 0);
    }

    const memo = this.extractMemo(event);
    if (memo) {
      try {
        const parsed = JSON.parse(memo);
        ticketId = parsed.ticketId || ticketId;
        zcashAddress = parsed.zcashAddress;
      } catch {
        zcashAddress = memo;
      }
    }

    return {
      ticketId,
      signature: event.signature,
      depositor: event.feePayer,
      amount,
      zcashAddress,
      timestamp: event.timestamp,
      slot: event.slot,
    };
  }

  extractMemo(event) {
    if (!event.instructions) return null;
    
    const memoIx = event.instructions.find(ix => 
      ix.program === 'spl-memo' || 
      ix.programId === SPL_MEMO_PROGRAM_ID
    );
    
    return memoIx?.parsed || null;
  }

  async initiateZcashTransfer(depositInfo) {
    const { zcashRpcClient, zcashWallet } = this.config;
    
    if (!zcashRpcClient || !zcashWallet) {
      console.error('Zcash client not configured');
      return;
    }

    try {
      const zcashAmount = this.convertToZcash(depositInfo.amount);
      
      const txId = await zcashWallet.sendShieldedTransaction(
        this.config.zcashBridgeAddress,
        [{
          address: depositInfo.zcashAddress,
          amount: zcashAmount,
          memo: JSON.stringify({
            ticketId: depositInfo.ticketId,
            solanaSignature: depositInfo.signature,
          }),
        }]
      );

      this.pendingDeposits.set(depositInfo.ticketId, {
        ...this.pendingDeposits.get(depositInfo.ticketId),
        status: 'zcash_transfer_sent',
        zcashTxId: txId,
      });

      await this.confirmDepositOnSolana(depositInfo.ticketId, txId);
    } catch (error) {
      console.error('Failed to initiate Zcash transfer:', error);
      
      this.pendingDeposits.set(depositInfo.ticketId, {
        ...this.pendingDeposits.get(depositInfo.ticketId),
        status: 'failed',
        error: error.message,
      });
    }
  }

  convertToZcash(solanaAmount) {
    return solanaAmount / 1e9;
  }

  async confirmDepositOnSolana(ticketId, zcashTxId) {
    if (!this.program || !this.operatorKeypair) {
      throw new Error('Bridge program or operator keypair not configured');
    }

    const zcashTxIdBytes = Buffer.alloc(32);
    const txIdBuffer = Buffer.from(zcashTxId, 'hex');
    if (txIdBuffer.length !== 32) {
      throw new Error('Invalid Zcash transaction ID: must be 32 bytes hex');
    }
    txIdBuffer.copy(zcashTxIdBytes);

    const programId = new PublicKey(this.bridgeProgramId);
    
    const [depositTicketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('deposit'), Buffer.from(ticketId.toString())],
      programId
    );

    const [bridgeStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bridge')],
      programId
    );

    const depositTicket = await this.program.account.depositTicket.fetch(depositTicketPda);
    const proof = await this.buildDepositProof(depositTicket, zcashTxIdBytes);

    const signature = await this.program.methods
      .confirmDeposit(Array.from(zcashTxIdBytes), proof)
      .accounts({
        bridgeState: bridgeStatePda,
        depositTicket: depositTicketPda,
        operator: this.operatorKeypair.publicKey,
      })
      .signers([this.operatorKeypair])
      .rpc();

    this.pendingDeposits.set(ticketId, {
      ...this.pendingDeposits.get(ticketId),
      status: 'completed',
      confirmationSignature: signature,
    });

    return signature;
  }

  async buildDepositProof(depositTicket, zcashTxIdBytes) {
    const { sha256 } = await import('@noble/hashes/sha256');
    
    const proofData = Buffer.alloc(256);
    
    const addressHash = sha256(Buffer.from(depositTicket.zcashShieldedAddress));
    Buffer.from(addressHash).copy(proofData, 0);
    
    zcashTxIdBytes.copy(proofData, 32);
    
    const amountBytes = Buffer.alloc(8);
    amountBytes.writeBigUInt64LE(BigInt(depositTicket.amount.toString()));
    proofData.write(amountBytes.toString('hex'), 64, 'hex');
    
    const depositorHash = sha256(depositTicket.depositor.toBuffer());
    Buffer.from(depositorHash).copy(proofData, 72);
    
    const timestamp = Buffer.alloc(8);
    timestamp.writeBigInt64LE(BigInt(Date.now()));
    timestamp.copy(proofData, 104);
    
    const operatorSig = sha256(Buffer.concat([
      proofData.slice(0, 112),
      this.operatorKeypair.publicKey.toBuffer(),
    ]));
    Buffer.from(operatorSig).copy(proofData, 112);
    
    const publicInputs = [
      amountBytes,
      Buffer.from(depositorHash.slice(0, 8)),
      Buffer.from(addressHash.slice(0, 8)),
      timestamp,
    ];
    
    return {
      proofData: Array.from(proofData),
      publicInputs: publicInputs.map(buf => Array.from(buf)),
    };
  }

  async handleWithdrawalInitiated(event) {
    const withdrawalInfo = this.extractWithdrawalInfo(event);
    
    this.pendingWithdrawals.set(withdrawalInfo.ticketId, {
      ...withdrawalInfo,
      status: 'pending_verification',
      createdAt: Date.now(),
    });

    await this.verifyAndProcessWithdrawal(withdrawalInfo);
  }

  extractWithdrawalInfo(event) {
    let ticketId = '0';
    let amount = 0;

    const memo = this.extractMemo(event);
    if (memo) {
      try {
        const parsed = JSON.parse(memo);
        ticketId = parsed.ticketId || ticketId;
      } catch {
        ticketId = memo;
      }
    }

    if (event.tokenTransfers && event.tokenTransfers.length > 0) {
      amount = event.tokenTransfers.reduce((sum, t) => sum + (t.tokenAmount || 0), 0);
    }

    return {
      ticketId,
      signature: event.signature,
      recipient: event.feePayer,
      amount,
      timestamp: event.timestamp,
      slot: event.slot,
    };
  }

  async verifyAndProcessWithdrawal(withdrawalInfo) {
    const { zcashRpcClient } = this.config;
    
    if (!zcashRpcClient) {
      console.error('Zcash client not configured');
      return;
    }

    try {
      const isValid = await this.verifyZcashProof(withdrawalInfo);
      
      if (!isValid) {
        this.pendingWithdrawals.set(withdrawalInfo.ticketId, {
          ...this.pendingWithdrawals.get(withdrawalInfo.ticketId),
          status: 'verification_failed',
        });
        return;
      }

      await this.processWithdrawalOnSolana(withdrawalInfo);
    } catch (error) {
      console.error('Failed to verify withdrawal:', error);
    }
  }

  async verifyZcashProof(withdrawalInfo) {
    const { zcashRpcClient } = this.config;
    
    if (!zcashRpcClient) {
      throw new Error('Zcash RPC client not configured for proof verification');
    }

    if (!withdrawalInfo.zcashTxId || withdrawalInfo.zcashTxId.length !== 64) {
      throw new Error('Invalid Zcash transaction ID');
    }

    const txDetails = await zcashRpcClient.getTransaction(withdrawalInfo.zcashTxId);
    
    if (!txDetails) {
      throw new Error('Zcash transaction not found');
    }

    if (txDetails.confirmations < 10) {
      throw new Error(`Insufficient confirmations: ${txDetails.confirmations}/10`);
    }

    const hasValidShieldedOutput = txDetails.vShieldedOutput && 
      txDetails.vShieldedOutput.length > 0;
    
    if (!hasValidShieldedOutput) {
      throw new Error('Transaction does not contain shielded outputs');
    }

    const bridgeAddressOutput = txDetails.vShieldedOutput.find(
      output => output.address === this.config.zcashBridgeAddress
    );

    if (!bridgeAddressOutput) {
      throw new Error('Transaction does not send to bridge address');
    }

    const expectedAmount = this.convertToZcash(withdrawalInfo.amount);
    const tolerance = 0.0001;
    if (Math.abs(bridgeAddressOutput.value - expectedAmount) > tolerance) {
      throw new Error(`Amount mismatch: expected ${expectedAmount}, got ${bridgeAddressOutput.value}`);
    }

    return true;
  }

  async processWithdrawalOnSolana(withdrawalInfo) {
    if (!this.program || !this.operatorKeypair) {
      throw new Error('Bridge program or operator keypair not configured');
    }

    const programId = new PublicKey(this.bridgeProgramId);
    
    const [withdrawalTicketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('withdrawal'), Buffer.from(withdrawalInfo.ticketId.toString())],
      programId
    );

    const [bridgeStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bridge')],
      programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault')],
      programId
    );

    const withdrawalTicket = await this.program.account.withdrawalTicket.fetch(withdrawalTicketPda);
    const proof = await this.buildWithdrawalProof(withdrawalTicket, withdrawalInfo);

    const signature = await this.program.methods
      .processWithdrawal(proof)
      .accounts({
        bridgeState: bridgeStatePda,
        withdrawalTicket: withdrawalTicketPda,
        operator: this.operatorKeypair.publicKey,
        vault: vaultPda,
        recipientTokenAccount: new PublicKey(withdrawalInfo.recipient),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([this.operatorKeypair])
      .rpc();

    this.pendingWithdrawals.set(withdrawalInfo.ticketId, {
      ...this.pendingWithdrawals.get(withdrawalInfo.ticketId),
      status: 'completed',
      processSignature: signature,
    });

    return signature;
  }

  async buildWithdrawalProof(withdrawalTicket, withdrawalInfo) {
    const { sha256 } = await import('@noble/hashes/sha256');
    
    const proofData = Buffer.alloc(256);
    
    const g1Point = sha256(Buffer.concat([
      Buffer.from(withdrawalTicket.partialNoteCommitment),
      Buffer.from(withdrawalTicket.partialNoteNullifier),
    ]));
    Buffer.from(g1Point).copy(proofData, 0);
    Buffer.from(g1Point).copy(proofData, 32);
    
    const g2Point = sha256(Buffer.concat([
      Buffer.from(g1Point),
      this.operatorKeypair.publicKey.toBuffer(),
    ]));
    for (let i = 0; i < 4; i++) {
      Buffer.from(g2Point).copy(proofData, 64 + (i * 32));
    }
    
    const amountBytes = Buffer.alloc(8);
    amountBytes.writeBigUInt64LE(BigInt(withdrawalTicket.amount.toString()));
    amountBytes.copy(proofData, 192);
    
    const timestamp = Buffer.alloc(8);
    timestamp.writeBigInt64LE(BigInt(Date.now()));
    timestamp.copy(proofData, 200);
    
    return {
      proofData: Array.from(proofData),
      commitment: Array.from(withdrawalTicket.partialNoteCommitment),
      nullifier: Array.from(withdrawalTicket.partialNoteNullifier),
    };
  }

  async handleStealthPayment(event) {
    const paymentInfo = {
      signature: event.signature,
      sender: event.feePayer,
      amount: event.nativeTransfers?.[0]?.amount || event.tokenTransfers?.[0]?.tokenAmount || 0,
      timestamp: event.timestamp,
    };

    this.emit('stealthPayment', paymentInfo);
  }

  emit(eventType, data) {
    if (this.eventHandlers && this.eventHandlers.has(eventType)) {
      for (const handler of this.eventHandlers.get(eventType)) {
        handler(data);
      }
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers) {
      this.eventHandlers = new Map();
    }
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  getPendingDeposits() {
    return Array.from(this.pendingDeposits.values());
  }

  getPendingWithdrawals() {
    return Array.from(this.pendingWithdrawals.values());
  }

  getStats() {
    return {
      pendingDeposits: this.pendingDeposits.size,
      pendingWithdrawals: this.pendingWithdrawals.size,
      processedSignatures: this.processedSignatures.size,
    };
  }
}

export function createWebhookRouter(config) {
  const router = express.Router();
  const handler = new HeliusWebhookHandler(config);
  
  router.post('/helius/webhook', express.json(), handler.createExpressMiddleware());
  
  router.get('/bridge/status', (req, res) => {
    res.json({
      status: 'operational',
      stats: handler.getStats(),
      pendingDeposits: handler.getPendingDeposits(),
      pendingWithdrawals: handler.getPendingWithdrawals(),
    });
  });

  router.get('/bridge/deposit/:ticketId', (req, res) => {
    const deposit = handler.pendingDeposits.get(req.params.ticketId);
    if (deposit) {
      res.json(deposit);
    } else {
      res.status(404).json({ error: 'Deposit not found' });
    }
  });

  router.get('/bridge/withdrawal/:ticketId', (req, res) => {
    const withdrawal = handler.pendingWithdrawals.get(req.params.ticketId);
    if (withdrawal) {
      res.json(withdrawal);
    } else {
      res.status(404).json({ error: 'Withdrawal not found' });
    }
  });

  return { router, handler };
}
