import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN, web3 } from '@coral-xyz/anchor';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import {
  deriveBridgeStatePDA,
  deriveVaultPDA,
  deriveDepositTicketPDA,
  deriveWithdrawalTicketPDA,
  deriveStealthMetaAddressPDA,
  deriveStealthPaymentPDA,
  generateStealthMetaAddress,
  generateStealthAddress,
  isValidZcashAddress,
  BRIDGE_CONSTANTS,
} from './index.js';
import { HeliusClient } from '../helius/index.js';

function getBridgeProgramPubkey() {
  return new PublicKey(BRIDGE_CONSTANTS.PROGRAM_ID);
}

function getUsdcMint() {
  const network = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
  const customMint = import.meta.env.VITE_USDC_MINT;
  
  if (customMint) {
    return new PublicKey(customMint);
  }
  
  if (network === 'mainnet-beta' || network === 'mainnet') {
    return new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  }
  
  throw new Error('VITE_USDC_MINT required for devnet/testnet');
}

export class SolanaZcashBridgeClient {
  constructor(connection, wallet, heliusClient = null) {
    this.connection = connection;
    this.wallet = wallet;
    this.heliusClient = heliusClient;
    this.program = null;
    this.bridgeState = null;
  }

  async initialize() {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    const provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: 'confirmed',
    });

    try {
      const programId = getBridgeProgramPubkey();
      const idl = await Program.fetchIdl(programId, provider);
      if (idl) {
        this.program = new Program(idl, programId, provider);
        await this.loadBridgeState();
      }
    } catch (error) {
      console.error('Failed to initialize bridge client:', error);
    }
  }

  async loadBridgeState() {
    if (!this.program) return null;

    try {
      const { pda: bridgeStatePda } = deriveBridgeStatePDA();
      this.bridgeState = await this.program.account.bridgeState.fetch(bridgeStatePda);
      return this.bridgeState;
    } catch (error) {
      console.error('Failed to load bridge state:', error);
      return null;
    }
  }

  async initiateDeposit(amount, zcashAddress, tokenMint = null) {
    if (!this.program) {
      throw new Error('Bridge program not initialized');
    }

    if (!isValidZcashAddress(zcashAddress)) {
      throw new Error('Invalid Zcash address');
    }

    const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
    if (amountLamports < BRIDGE_CONSTANTS.MIN_DEPOSIT_SOL * LAMPORTS_PER_SOL) {
      throw new Error(`Minimum deposit is ${BRIDGE_CONSTANTS.MIN_DEPOSIT_SOL} SOL`);
    }
    if (amountLamports > BRIDGE_CONSTANTS.MAX_DEPOSIT_SOL * LAMPORTS_PER_SOL) {
      throw new Error(`Maximum deposit is ${BRIDGE_CONSTANTS.MAX_DEPOSIT_SOL} SOL`);
    }

    const { pda: bridgeStatePda } = deriveBridgeStatePDA();
    const bridgeState = await this.program.account.bridgeState.fetch(bridgeStatePda);
    const ticketId = bridgeState.depositCounter.toNumber();

    const { pda: depositTicketPda } = deriveDepositTicketPDA(ticketId);
    const { pda: vaultPda } = deriveVaultPDA();

    const zcashAddressBytes = Buffer.alloc(128);
    Buffer.from(zcashAddress).copy(zcashAddressBytes);

    const accounts = {
      bridgeState: bridgeStatePda,
      depositTicket: depositTicketPda,
      depositor: this.wallet.publicKey,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    };

    if (tokenMint) {
      const mintPubkey = new PublicKey(tokenMint);
      const depositorTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        this.wallet.publicKey
      );
      const vaultTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        vaultPda,
        true
      );

      accounts.depositorTokenAccount = depositorTokenAccount;
      accounts.vaultTokenAccount = vaultTokenAccount;
      accounts.tokenMint = mintPubkey;
      accounts.tokenProgram = TOKEN_PROGRAM_ID;
    }

    let tx;
    if (this.heliusClient) {
      tx = await this.program.methods
        .initiateDeposit(new BN(amountLamports), Array.from(zcashAddressBytes))
        .accounts(accounts)
        .transaction();

      tx = await this.heliusClient.addPriorityFee(tx, this.wallet.publicKey.toBase58());
    } else {
      tx = await this.program.methods
        .initiateDeposit(new BN(amountLamports), Array.from(zcashAddressBytes))
        .accounts(accounts)
        .transaction();
    }

    const signature = await this.wallet.sendTransaction(tx, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return {
      ticketId,
      signature,
      amount: amountLamports,
      zcashAddress,
      status: 'initiated',
    };
  }

  async initiateWithdrawal(amount, zcashTxId, proof) {
    if (!this.program) {
      throw new Error('Bridge program not initialized');
    }

    const { pda: bridgeStatePda } = deriveBridgeStatePDA();
    const bridgeState = await this.program.account.bridgeState.fetch(bridgeStatePda);
    const ticketId = bridgeState.withdrawalCounter.toNumber();

    const { pda: withdrawalTicketPda } = deriveWithdrawalTicketPDA(ticketId);

    const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

    if (!zcashTxId || zcashTxId.length !== 64) {
      throw new Error('Valid Zcash transaction ID (64 hex characters) is required');
    }
    
    if (!proof || !proof.proofData || !proof.commitment || !proof.nullifier) {
      throw new Error('Valid ZK proof with proofData, commitment, and nullifier is required');
    }

    const zcashTxIdBytes = Buffer.from(zcashTxId, 'hex');
    if (zcashTxIdBytes.length !== 32) {
      throw new Error('Zcash transaction ID must decode to 32 bytes');
    }

    const accounts = {
      bridgeState: bridgeStatePda,
      withdrawalTicket: withdrawalTicketPda,
      recipient: this.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    };

    let tx = await this.program.methods
      .initiateWithdrawal(
        new BN(amountLamports),
        Array.from(zcashTxIdBytes),
        proof
      )
      .accounts(accounts)
      .transaction();

    if (this.heliusClient) {
      tx = await this.heliusClient.addPriorityFee(tx, this.wallet.publicKey.toBase58());
    }

    const signature = await this.wallet.sendTransaction(tx, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return {
      ticketId,
      signature,
      amount: amountLamports,
      status: 'initiated',
    };
  }

  async registerStealthMetaAddress(spendingPubKey, viewingPubKey) {
    if (!this.program) {
      throw new Error('Bridge program not initialized');
    }

    let spending = spendingPubKey;
    let viewing = viewingPubKey;

    if (!spending || !viewing) {
      const metaAddress = generateStealthMetaAddress();
      spending = Buffer.from(metaAddress.spendingPublicKey, 'hex');
      viewing = Buffer.from(metaAddress.viewingPublicKey, 'hex');

      return {
        ...await this._registerMetaAddress(spending, viewing),
        metaAddress,
      };
    }

    return this._registerMetaAddress(spending, viewing);
  }

  async _registerMetaAddress(spendingPubKey, viewingPubKey) {
    const { pda: metaAddressPda } = deriveStealthMetaAddressPDA(this.wallet.publicKey.toBase58());

    const spendingBytes = Buffer.alloc(33);
    const viewingBytes = Buffer.alloc(33);
    
    if (Buffer.isBuffer(spendingPubKey)) {
      spendingPubKey.copy(spendingBytes);
    } else {
      Buffer.from(spendingPubKey, 'hex').copy(spendingBytes);
    }
    
    if (Buffer.isBuffer(viewingPubKey)) {
      viewingPubKey.copy(viewingBytes);
    } else {
      Buffer.from(viewingPubKey, 'hex').copy(viewingBytes);
    }

    let tx = await this.program.methods
      .registerStealthMetaAddress(
        Array.from(spendingBytes),
        Array.from(viewingBytes)
      )
      .accounts({
        metaAddress: metaAddressPda,
        owner: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    if (this.heliusClient) {
      tx = await this.heliusClient.addPriorityFee(tx, this.wallet.publicKey.toBase58());
    }

    const signature = await this.wallet.sendTransaction(tx, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return {
      signature,
      metaAddressPda: metaAddressPda.toBase58(),
    };
  }

  async sendStealthPayment(recipientMetaAddress, amount, tokenMint = null) {
    if (!this.program) {
      throw new Error('Bridge program not initialized');
    }

    const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress(recipientMetaAddress);

    const stealthPubkey = new PublicKey(stealthAddress);
    const { pda: stealthPaymentPda } = deriveStealthPaymentPDA(stealthAddress);

    const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

    const ephemeralBytes = Buffer.alloc(33);
    Buffer.from(ephemeralPublicKey, 'hex').copy(ephemeralBytes);

    const viewTagByte = parseInt(viewTag, 16);

    const accounts = {
      stealthPayment: stealthPaymentPda,
      sender: this.wallet.publicKey,
      stealthAddress: stealthPubkey,
      systemProgram: SystemProgram.programId,
    };

    if (tokenMint) {
      const mintPubkey = new PublicKey(tokenMint);
      const senderTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        this.wallet.publicKey
      );
      const stealthTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        stealthPubkey,
        true
      );

      accounts.senderTokenAccount = senderTokenAccount;
      accounts.stealthTokenAccount = stealthTokenAccount;
      accounts.tokenMint = mintPubkey;
      accounts.tokenProgram = TOKEN_PROGRAM_ID;
    }

    let tx = await this.program.methods
      .sendToStealth(
        new BN(amountLamports),
        Array.from(ephemeralBytes),
        viewTagByte
      )
      .accounts(accounts)
      .transaction();

    if (this.heliusClient) {
      tx = await this.heliusClient.addPriorityFee(tx, this.wallet.publicKey.toBase58());
    }

    const signature = await this.wallet.sendTransaction(tx, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return {
      signature,
      stealthAddress,
      ephemeralPublicKey,
      viewTag,
      amount: amountLamports,
    };
  }

  async claimStealthPayment(stealthAddress, stealthPrivateKey) {
    if (!this.program) {
      throw new Error('Bridge program not initialized');
    }

    const stealthPubkey = new PublicKey(stealthAddress);
    const { pda: stealthPaymentPda } = deriveStealthPaymentPDA(stealthAddress);

    let tx = await this.program.methods
      .claimFromStealth()
      .accounts({
        stealthPayment: stealthPaymentPda,
        stealthAddress: stealthPubkey,
        recipient: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    if (this.heliusClient) {
      tx = await this.heliusClient.addPriorityFee(tx, this.wallet.publicKey.toBase58());
    }

    const signature = await this.wallet.sendTransaction(tx, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return {
      signature,
      stealthAddress,
    };
  }

  async getDepositStatus(ticketId) {
    if (!this.program) {
      throw new Error('Bridge program not initialized');
    }

    const { pda: depositTicketPda } = deriveDepositTicketPDA(ticketId);
    
    try {
      const ticket = await this.program.account.depositTicket.fetch(depositTicketPda);
      return {
        ticketId,
        depositor: ticket.depositor.toBase58(),
        amount: ticket.amount.toNumber(),
        zcashAddress: Buffer.from(ticket.zcashAddress).toString().replace(/\0/g, ''),
        status: Object.keys(ticket.status)[0],
        createdAt: ticket.createdAt.toNumber(),
        zcashTxId: ticket.zcashTxId ? Buffer.from(ticket.zcashTxId).toString('hex') : null,
      };
    } catch (error) {
      return null;
    }
  }

  async getWithdrawalStatus(ticketId) {
    if (!this.program) {
      throw new Error('Bridge program not initialized');
    }

    const { pda: withdrawalTicketPda } = deriveWithdrawalTicketPDA(ticketId);
    
    try {
      const ticket = await this.program.account.withdrawalTicket.fetch(withdrawalTicketPda);
      return {
        ticketId,
        recipient: ticket.recipient.toBase58(),
        amount: ticket.amount.toNumber(),
        status: Object.keys(ticket.status)[0],
        createdAt: ticket.createdAt.toNumber(),
        nullifier: Buffer.from(ticket.nullifier).toString('hex'),
      };
    } catch (error) {
      return null;
    }
  }

  async getBridgeStats() {
    if (!this.bridgeState) {
      await this.loadBridgeState();
    }

    if (!this.bridgeState) {
      return null;
    }

    return {
      totalDeposits: this.bridgeState.totalDeposits.toNumber(),
      totalWithdrawals: this.bridgeState.totalWithdrawals.toNumber(),
      depositCounter: this.bridgeState.depositCounter.toNumber(),
      withdrawalCounter: this.bridgeState.withdrawalCounter.toNumber(),
      isPaused: this.bridgeState.isPaused,
      feeBps: this.bridgeState.feeBps,
    };
  }

  async getUserMetaAddress(userAddress = null) {
    if (!this.program) {
      throw new Error('Bridge program not initialized');
    }

    const owner = userAddress || this.wallet.publicKey.toBase58();
    const { pda: metaAddressPda } = deriveStealthMetaAddressPDA(owner);

    try {
      const metaAddress = await this.program.account.stealthMetaAddress.fetch(metaAddressPda);
      return {
        owner: metaAddress.owner.toBase58(),
        spendingPubKey: Buffer.from(metaAddress.spendingPubKey).toString('hex'),
        viewingPubKey: Buffer.from(metaAddress.viewingPubKey).toString('hex'),
        createdAt: metaAddress.createdAt.toNumber(),
      };
    } catch (error) {
      return null;
    }
  }

  async getTransactionHistory(limit = 20) {
    if (!this.heliusClient) {
      throw new Error('Helius client not configured');
    }

    const address = this.wallet.publicKey.toBase58();
    return this.heliusClient.getTransactionHistory(address, limit);
  }

  async estimatePriorityFee() {
    if (!this.heliusClient) {
      return { low: 1000, medium: 5000, high: 10000 };
    }

    const { pda: bridgeStatePda } = deriveBridgeStatePDA();
    return this.heliusClient.getPriorityFeeEstimate([
      this.wallet.publicKey.toBase58(),
      bridgeStatePda.toBase58(),
    ]);
  }
}
