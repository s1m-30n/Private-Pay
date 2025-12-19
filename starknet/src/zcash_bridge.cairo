// Zcash-Starknet Bridge Contract
// Enables cross-chain privacy transfers between Zcash and Starknet (Ztarknet)

use starknet::ContractAddress;

#[starknet::interface]
pub trait IZcashBridge<TContractState> {
    // Deposit flow: Zcash -> Starknet
    fn register_deposit(
        ref self: TContractState,
        ticket_id: felt252,
        zcash_tx_id: felt252,
        amount: u256,
        recipient: ContractAddress,
        proof_hash: felt252,
    );
    fn claim_szec(ref self: TContractState, ticket_id: felt252);

    // Withdrawal flow: Starknet -> Zcash
    fn burn_szec(
        ref self: TContractState,
        amount: u256,
        zcash_address_hash: felt252,
    ) -> felt252;
    fn process_withdrawal(
        ref self: TContractState,
        withdrawal_id: felt252,
        proof_hash: felt252,
    );

    // View functions
    fn get_deposit(self: @TContractState, ticket_id: felt252) -> (felt252, u256, ContractAddress, u8);
    fn get_withdrawal(self: @TContractState, withdrawal_id: felt252) -> (u256, felt252, u8);
    fn get_total_bridged(self: @TContractState) -> u256;
    fn get_operator(self: @TContractState) -> ContractAddress;
    fn is_ticket_claimed(self: @TContractState, ticket_id: felt252) -> bool;

    // Admin functions
    fn set_operator(ref self: TContractState, new_operator: ContractAddress);
}

#[starknet::contract]
pub mod ZcashBridge {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StoragePathEntry
    };

    // Deposit status
    const STATUS_PENDING: u8 = 0;
    const STATUS_CONFIRMED: u8 = 1;
    const STATUS_CLAIMED: u8 = 2;

    // Withdrawal status
    const WITHDRAWAL_PENDING: u8 = 0;
    const WITHDRAWAL_PROCESSED: u8 = 1;
    const WITHDRAWAL_COMPLETED: u8 = 2;

    #[storage]
    struct Storage {
        // Operator address (bridge relayer)
        operator: ContractAddress,
        // Total bridged amount
        total_bridged: u256,
        // Withdrawal counter
        withdrawal_count: u256,

        // Deposits: ticket_id -> deposit data
        deposit_zcash_tx_id: Map::<felt252, felt252>,
        deposit_amount: Map::<felt252, u256>,
        deposit_recipient: Map::<felt252, ContractAddress>,
        deposit_status: Map::<felt252, u8>,
        deposit_proof_hash: Map::<felt252, felt252>,
        deposit_timestamp: Map::<felt252, u64>,

        // Claimed tickets set
        claimed_tickets: Map::<felt252, bool>,

        // Withdrawals: withdrawal_id -> withdrawal data
        withdrawal_amount: Map::<felt252, u256>,
        withdrawal_zcash_address: Map::<felt252, felt252>,
        withdrawal_status: Map::<felt252, u8>,
        withdrawal_timestamp: Map::<felt252, u64>,
        withdrawal_requester: Map::<felt252, ContractAddress>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        DepositRegistered: DepositRegistered,
        SZECClaimed: SZECClaimed,
        WithdrawalInitiated: WithdrawalInitiated,
        WithdrawalProcessed: WithdrawalProcessed,
        OperatorUpdated: OperatorUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DepositRegistered {
        #[key]
        pub ticket_id: felt252,
        pub zcash_tx_id: felt252,
        pub amount: u256,
        pub recipient: ContractAddress,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SZECClaimed {
        #[key]
        pub ticket_id: felt252,
        pub recipient: ContractAddress,
        pub amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalInitiated {
        #[key]
        pub withdrawal_id: felt252,
        pub requester: ContractAddress,
        pub amount: u256,
        pub zcash_address_hash: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalProcessed {
        #[key]
        pub withdrawal_id: felt252,
        pub proof_hash: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OperatorUpdated {
        pub old_operator: ContractAddress,
        pub new_operator: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, operator: ContractAddress) {
        self.operator.write(operator);
        self.total_bridged.write(0);
        self.withdrawal_count.write(0);
    }

    #[abi(embed_v0)]
    impl ZcashBridgeImpl of super::IZcashBridge<ContractState> {
        fn register_deposit(
            ref self: ContractState,
            ticket_id: felt252,
            zcash_tx_id: felt252,
            amount: u256,
            recipient: ContractAddress,
            proof_hash: felt252,
        ) {
            // Only operator can register deposits
            let caller = get_caller_address();
            let operator = self.operator.read();
            assert(caller == operator, 'Only operator can register');

            // Check ticket not already used
            let already_exists = self.deposit_amount.entry(ticket_id).read();
            assert(already_exists == 0, 'Ticket already exists');

            let timestamp = get_block_timestamp();

            // Store deposit
            self.deposit_zcash_tx_id.entry(ticket_id).write(zcash_tx_id);
            self.deposit_amount.entry(ticket_id).write(amount);
            self.deposit_recipient.entry(ticket_id).write(recipient);
            self.deposit_status.entry(ticket_id).write(STATUS_CONFIRMED);
            self.deposit_proof_hash.entry(ticket_id).write(proof_hash);
            self.deposit_timestamp.entry(ticket_id).write(timestamp);

            self.emit(DepositRegistered {
                ticket_id,
                zcash_tx_id,
                amount,
                recipient,
                timestamp,
            });
        }

        fn claim_szec(ref self: ContractState, ticket_id: felt252) {
            let caller = get_caller_address();

            // Check deposit exists and is confirmed
            let status = self.deposit_status.entry(ticket_id).read();
            assert(status == STATUS_CONFIRMED, 'Deposit not confirmed');

            // Check not already claimed
            let claimed = self.claimed_tickets.entry(ticket_id).read();
            assert(!claimed, 'Already claimed');

            // Check caller is recipient
            let recipient = self.deposit_recipient.entry(ticket_id).read();
            assert(caller == recipient, 'Not authorized');

            let amount = self.deposit_amount.entry(ticket_id).read();
            let timestamp = get_block_timestamp();

            // Mark as claimed
            self.claimed_tickets.entry(ticket_id).write(true);
            self.deposit_status.entry(ticket_id).write(STATUS_CLAIMED);

            // Update total bridged
            let current_total = self.total_bridged.read();
            self.total_bridged.write(current_total + amount);

            // In production: mint sZEC tokens to recipient
            // For now, emit event for off-chain processing

            self.emit(SZECClaimed {
                ticket_id,
                recipient,
                amount,
                timestamp,
            });
        }

        fn burn_szec(
            ref self: ContractState,
            amount: u256,
            zcash_address_hash: felt252,
        ) -> felt252 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            // Generate withdrawal ID
            let count = self.withdrawal_count.read();
            // Simple hash for withdrawal ID (in production use pedersen)
            let withdrawal_id = count.try_into().unwrap();

            // Store withdrawal request
            self.withdrawal_amount.entry(withdrawal_id).write(amount);
            self.withdrawal_zcash_address.entry(withdrawal_id).write(zcash_address_hash);
            self.withdrawal_status.entry(withdrawal_id).write(WITHDRAWAL_PENDING);
            self.withdrawal_timestamp.entry(withdrawal_id).write(timestamp);
            self.withdrawal_requester.entry(withdrawal_id).write(caller);

            // Increment counter
            self.withdrawal_count.write(count + 1);

            // In production: burn sZEC tokens from caller
            // For now, emit event for off-chain processing

            self.emit(WithdrawalInitiated {
                withdrawal_id,
                requester: caller,
                amount,
                zcash_address_hash,
                timestamp,
            });

            withdrawal_id
        }

        fn process_withdrawal(
            ref self: ContractState,
            withdrawal_id: felt252,
            proof_hash: felt252,
        ) {
            // Only operator can process
            let caller = get_caller_address();
            let operator = self.operator.read();
            assert(caller == operator, 'Only operator can process');

            // Check withdrawal exists and is pending
            let status = self.withdrawal_status.entry(withdrawal_id).read();
            assert(status == WITHDRAWAL_PENDING, 'Invalid withdrawal status');

            let timestamp = get_block_timestamp();

            // Mark as processed
            self.withdrawal_status.entry(withdrawal_id).write(WITHDRAWAL_PROCESSED);

            self.emit(WithdrawalProcessed {
                withdrawal_id,
                proof_hash,
                timestamp,
            });
        }

        fn get_deposit(
            self: @ContractState,
            ticket_id: felt252
        ) -> (felt252, u256, ContractAddress, u8) {
            let zcash_tx_id = self.deposit_zcash_tx_id.entry(ticket_id).read();
            let amount = self.deposit_amount.entry(ticket_id).read();
            let recipient = self.deposit_recipient.entry(ticket_id).read();
            let status = self.deposit_status.entry(ticket_id).read();
            (zcash_tx_id, amount, recipient, status)
        }

        fn get_withdrawal(
            self: @ContractState,
            withdrawal_id: felt252
        ) -> (u256, felt252, u8) {
            let amount = self.withdrawal_amount.entry(withdrawal_id).read();
            let zcash_address = self.withdrawal_zcash_address.entry(withdrawal_id).read();
            let status = self.withdrawal_status.entry(withdrawal_id).read();
            (amount, zcash_address, status)
        }

        fn get_total_bridged(self: @ContractState) -> u256 {
            self.total_bridged.read()
        }

        fn get_operator(self: @ContractState) -> ContractAddress {
            self.operator.read()
        }

        fn is_ticket_claimed(self: @ContractState, ticket_id: felt252) -> bool {
            self.claimed_tickets.entry(ticket_id).read()
        }

        fn set_operator(ref self: ContractState, new_operator: ContractAddress) {
            let caller = get_caller_address();
            let current_operator = self.operator.read();
            assert(caller == current_operator, 'Only operator can change');

            self.operator.write(new_operator);

            self.emit(OperatorUpdated {
                old_operator: current_operator,
                new_operator,
            });
        }
    }
}
