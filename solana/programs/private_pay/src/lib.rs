//! Private Pay - Solana Program with Arcium MPC (Simplified Version)
//! 
//! This is a simplified version focusing on private payments.
//! More features (swaps, dark pool) will be added incrementally.

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// Computation definition offsets
const COMP_DEF_OFFSET_INIT_BALANCE: u32 = comp_def_offset("init_balance");
const COMP_DEF_OFFSET_DEPOSIT: u32 = comp_def_offset("deposit");
const COMP_DEF_OFFSET_EXECUTE_SWAP: u32 = comp_def_offset("execute_swap");
const COMP_DEF_OFFSET_PLACE_ORDER: u32 = comp_def_offset("place_order");
const COMP_DEF_OFFSET_MATCH_ORDERS: u32 = comp_def_offset("match_orders");

declare_id!("27Pd4tb2NWZQuerC196RCQQHg27cuMiMgf5hNz3mPSP7");

#[arcium_program]
pub mod private_pay {
    use super::*;

    // ============================================
    // COMPUTATION DEFINITION INITIALIZERS
    // ============================================

    pub fn init_balance_comp_def(ctx: Context<InitBalanceCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_deposit_comp_def(ctx: Context<InitDepositCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_execute_swap_comp_def(ctx: Context<InitExecuteSwapCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_place_order_comp_def(ctx: Context<InitPlaceOrderCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_match_orders_comp_def(ctx: Context<InitMatchOrdersCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    // ============================================
    // PRIVATE BALANCE OPERATIONS
    // ============================================

    /// Create a new private balance account
    pub fn create_balance_account(
        ctx: Context<CreateBalanceAccount>,
        computation_offset: u64,
        nonce: u128,
    ) -> Result<()> {
        msg!("Creating new private balance account");

        ctx.accounts.balance_account.owner = ctx.accounts.payer.key();
        ctx.accounts.balance_account.bump = ctx.bumps.balance_account;
        ctx.accounts.balance_account.balance_state = [0u8; 64];
        ctx.accounts.balance_account.nonce = nonce;

        let args = ArgBuilder::new()
            .plaintext_u128(nonce)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![InitBalanceCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "init_balance")]
    pub fn init_balance_callback(
        ctx: Context<InitBalanceCallback>,
        output: SignedComputationOutputs<InitBalanceOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(InitBalanceOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        ctx.accounts.balance_account.balance_state.copy_from_slice(&o.ciphertexts[0][..64]);
        ctx.accounts.balance_account.nonce = o.nonce;

        emit!(BalanceAccountCreated {
            owner: ctx.accounts.balance_account.owner,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Deposit funds into a private balance
    pub fn deposit_funds(
        ctx: Context<DepositFunds>,
        computation_offset: u64,
        amount: u64,
    ) -> Result<()> {
        msg!("Depositing {} to private balance", amount);

        let args = ArgBuilder::new()
            .plaintext_u64(amount)
            .plaintext_u128(ctx.accounts.balance_account.nonce)
            .account(
                ctx.accounts.balance_account.key(),
                8 + 32 + 1, // discriminator + owner + bump
                64,
            )
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![DepositCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "deposit")]
    pub fn deposit_callback(
        ctx: Context<DepositCallback>,
        output: SignedComputationOutputs<DepositOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(DepositOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        ctx.accounts.balance_account.balance_state.copy_from_slice(&o.ciphertexts[0][..64]);
        ctx.accounts.balance_account.nonce = o.nonce;

        emit!(DepositCompleted {
            owner: ctx.accounts.balance_account.owner,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ============================================
    // PRIVATE SWAP OPERATIONS
    // ============================================

    /// Execute a private token swap
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        computation_offset: u64,
        ciphertext_input: [u8; 32],
        ciphertext_min_output: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        msg!("Executing private swap");

        let args = ArgBuilder::new()
            .x25519_pubkey(pub_key)
            .plaintext_u128(nonce)
            .encrypted_u64(ciphertext_input)
            .encrypted_u64(ciphertext_min_output)
            .account(
                ctx.accounts.swap_pool_account.key(),
                8 + 32 + 1, // discriminator + owner + bump
                64, // swap_state size
            )
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![ExecuteSwapCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "execute_swap")]
    pub fn execute_swap_callback(
        ctx: Context<ExecuteSwapCallback>,
        output: SignedComputationOutputs<ExecuteSwapOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ExecuteSwapOutput { field_0, field_1 }) => (field_0, field_1),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        // Update swap pool state
        ctx.accounts.swap_pool_account.swap_state.copy_from_slice(&o.0.ciphertexts[0][..64]);
        ctx.accounts.swap_pool_account.nonce = o.0.nonce;

        emit!(SwapExecuted {
            pool: ctx.accounts.swap_pool_account.key(),
            output_amount: o.1.ciphertexts[0],
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ============================================
    // DARK POOL OPERATIONS
    // ============================================

    /// Place an encrypted order in the dark pool
    pub fn place_order(
        ctx: Context<PlaceOrder>,
        computation_offset: u64,
        ciphertext_side: [u8; 32],
        ciphertext_size: [u8; 32],
        ciphertext_price: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        msg!("Placing order in dark pool");

        let args = ArgBuilder::new()
            .x25519_pubkey(pub_key)
            .plaintext_u128(nonce)
            .encrypted_u8(ciphertext_side)
            .encrypted_u64(ciphertext_size)
            .encrypted_u64(ciphertext_price)
            .account(
                ctx.accounts.order_book_account.key(),
                8 + 32 + 1,
                64,
            )
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![PlaceOrderCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "place_order")]
    pub fn place_order_callback(
        ctx: Context<PlaceOrderCallback>,
        output: SignedComputationOutputs<PlaceOrderOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(PlaceOrderOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        ctx.accounts.order_book_account.order_book_state.copy_from_slice(&o.ciphertexts[0][..64]);
        ctx.accounts.order_book_account.nonce = o.nonce;

        emit!(OrderPlaced {
            order_book: ctx.accounts.order_book_account.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Match orders in the dark pool
    pub fn match_orders(
        ctx: Context<MatchOrders>,
        computation_offset: u64,
        ciphertext_buy_side: [u8; 32],
        ciphertext_buy_size: [u8; 32],
        ciphertext_buy_price: [u8; 32],
        ciphertext_sell_side: [u8; 32],
        ciphertext_sell_size: [u8; 32],
        ciphertext_sell_price: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        msg!("Matching orders in dark pool");

        let args = ArgBuilder::new()
            .x25519_pubkey(pub_key)
            .plaintext_u128(nonce)
            .encrypted_u8(ciphertext_buy_side)
            .encrypted_u64(ciphertext_buy_size)
            .encrypted_u64(ciphertext_buy_price)
            .encrypted_u8(ciphertext_sell_side)
            .encrypted_u64(ciphertext_sell_size)
            .encrypted_u64(ciphertext_sell_price)
            .account(
                ctx.accounts.order_book_account.key(),
                8 + 32 + 1,
                64,
            )
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![MatchOrdersCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "match_orders")]
    pub fn match_orders_callback(
        ctx: Context<MatchOrdersCallback>,
        output: SignedComputationOutputs<MatchOrdersOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(MatchOrdersOutput { field_0, field_1, field_2 }) => (field_0, field_1, field_2),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        ctx.accounts.order_book_account.order_book_state.copy_from_slice(&o.0.ciphertexts[0][..64]);
        ctx.accounts.order_book_account.nonce = o.0.nonce;

        emit!(OrdersMatched {
            order_book: ctx.accounts.order_book_account.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// ============================================
// ACCOUNT STRUCTURES
// ============================================

#[account]
#[derive(InitSpace)]
pub struct PrivateBalanceAccount {
    /// Owner of this balance
    pub owner: Pubkey,
    /// PDA bump seed
    pub bump: u8,
    /// Encrypted balance state (balance: u64, nonce: u64)
    #[max_len(64)]
    pub balance_state: [u8; 64],
    /// Encryption nonce
    pub nonce: u128,
}

#[account]
#[derive(InitSpace)]
pub struct SwapPoolAccount {
    /// Owner/creator of the pool
    pub owner: Pubkey,
    /// PDA bump seed
    pub bump: u8,
    /// Token A mint
    pub token_a_mint: Pubkey,
    /// Token B mint
    pub token_b_mint: Pubkey,
    /// Encrypted swap state (reserve_a: u64, reserve_b: u64, total_liquidity: u64, nonce: u64)
    #[max_len(64)]
    pub swap_state: [u8; 64],
    /// Encryption nonce
    pub nonce: u128,
}

#[account]
#[derive(InitSpace)]
pub struct OrderBookAccount {
    /// Owner/creator of the order book
    pub owner: Pubkey,
    /// PDA bump seed
    pub bump: u8,
    /// Trading pair identifier
    #[max_len(32)]
    pub pair: [u8; 32],
    /// Encrypted order book state (total_buy_orders: u64, total_sell_orders: u64, nonce: u64)
    #[max_len(64)]
    pub order_book_state: [u8; 64],
    /// Encryption nonce
    pub nonce: u128,
}

// ============================================
// ACCOUNT CONTEXTS
// ============================================

#[init_computation_definition_accounts("init_balance", payer)]
#[derive(Accounts)]
pub struct InitBalanceCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("deposit", payer)]
#[derive(Accounts)]
pub struct InitDepositCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("init_balance", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct CreateBalanceAccount<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_BALANCE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        init,
        payer = payer,
        space = 8 + PrivateBalanceAccount::INIT_SPACE,
        seeds = [b"balance", payer.key().as_ref()],
        bump,
    )]
    pub balance_account: Account<'info, PrivateBalanceAccount>,
}

#[callback_accounts("init_balance")]
#[derive(Accounts)]
pub struct InitBalanceCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_BALANCE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub balance_account: Account<'info, PrivateBalanceAccount>,
}

#[queue_computation_accounts("deposit", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct DepositFunds<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DEPOSIT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(mut, has_one = owner @ ErrorCode::InvalidAuthority)]
    pub balance_account: Account<'info, PrivateBalanceAccount>,
    pub owner: Signer<'info>,
}

#[callback_accounts("deposit")]
#[derive(Accounts)]
pub struct DepositCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DEPOSIT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub balance_account: Account<'info, PrivateBalanceAccount>,
}

// ============================================
// SWAP ACCOUNT CONTEXTS
// ============================================

#[init_computation_definition_accounts("execute_swap", payer)]
#[derive(Accounts)]
pub struct InitExecuteSwapCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("execute_swap", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ExecuteSwap<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_EXECUTE_SWAP))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(mut)]
    pub swap_pool_account: Account<'info, SwapPoolAccount>,
}

#[callback_accounts("execute_swap")]
#[derive(Accounts)]
pub struct ExecuteSwapCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_EXECUTE_SWAP))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub swap_pool_account: Account<'info, SwapPoolAccount>,
}

// ============================================
// DARK POOL ACCOUNT CONTEXTS
// ============================================

#[init_computation_definition_accounts("place_order", payer)]
#[derive(Accounts)]
pub struct InitPlaceOrderCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("match_orders", payer)]
#[derive(Accounts)]
pub struct InitMatchOrdersCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("place_order", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLACE_ORDER))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(mut)]
    pub order_book_account: Account<'info, OrderBookAccount>,
}

#[callback_accounts("place_order")]
#[derive(Accounts)]
pub struct PlaceOrderCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLACE_ORDER))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub order_book_account: Account<'info, OrderBookAccount>,
}

#[queue_computation_accounts("match_orders", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct MatchOrders<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_MATCH_ORDERS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(mut)]
    pub order_book_account: Account<'info, OrderBookAccount>,
}

#[callback_accounts("match_orders")]
#[derive(Accounts)]
pub struct MatchOrdersCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_MATCH_ORDERS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub order_book_account: Account<'info, OrderBookAccount>,
}

// ============================================
// ERROR CODES
// ============================================

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
    #[msg("Insufficient balance")]
    InsufficientBalance,
}

// ============================================
// EVENTS
// ============================================

#[event]
pub struct BalanceAccountCreated {
    pub owner: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DepositCompleted {
    pub owner: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SwapExecuted {
    pub pool: Pubkey,
    pub output_amount: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct OrderPlaced {
    pub order_book: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct OrdersMatched {
    pub order_book: Pubkey,
    pub timestamp: i64,
}
