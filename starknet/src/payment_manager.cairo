// Payment Manager for Starknet Stealth Payments
// Handles private payments to stealth addresses

use starknet::ContractAddress;

#[starknet::interface]
pub trait IPaymentManager<TContractState> {
    fn send_private_payment(
        ref self: TContractState,
        recipient: ContractAddress,
        stealth_address: felt252,
        ephemeral_pub_key_x: felt252,
        ephemeral_pub_key_y: felt252,
        amount: u256,
        k: u32,
        view_hint: felt252,
    );
    fn get_payment_count(self: @TContractState) -> u256;
    fn get_payment(
        self: @TContractState,
        payment_id: u256
    ) -> (ContractAddress, felt252, felt252, felt252, u256, u32, felt252);
}

#[starknet::contract]
pub mod PaymentManager {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StoragePathEntry
    };

    #[storage]
    struct Storage {
        // Payment counter
        payment_count: u256,
        // Payment storage: payment_id -> payment data
        payment_sender: Map::<u256, ContractAddress>,
        payment_stealth_address: Map::<u256, felt252>,
        payment_ephemeral_x: Map::<u256, felt252>,
        payment_ephemeral_y: Map::<u256, felt252>,
        payment_amount: Map::<u256, u256>,
        payment_k: Map::<u256, u32>,
        payment_view_hint: Map::<u256, felt252>,
        payment_timestamp: Map::<u256, u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PrivatePaymentSent: PrivatePaymentSent,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PrivatePaymentSent {
        #[key]
        pub payment_id: u256,
        #[key]
        pub recipient: ContractAddress,
        pub sender: ContractAddress,
        pub stealth_address: felt252,
        pub ephemeral_pub_key_x: felt252,
        pub ephemeral_pub_key_y: felt252,
        pub amount: u256,
        pub k: u32,
        pub view_hint: felt252,
        pub timestamp: u64,
    }

    #[abi(embed_v0)]
    impl PaymentManagerImpl of super::IPaymentManager<ContractState> {
        fn send_private_payment(
            ref self: ContractState,
            recipient: ContractAddress,
            stealth_address: felt252,
            ephemeral_pub_key_x: felt252,
            ephemeral_pub_key_y: felt252,
            amount: u256,
            k: u32,
            view_hint: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let payment_id = self.payment_count.read();

            // Store payment data
            self.payment_sender.entry(payment_id).write(caller);
            self.payment_stealth_address.entry(payment_id).write(stealth_address);
            self.payment_ephemeral_x.entry(payment_id).write(ephemeral_pub_key_x);
            self.payment_ephemeral_y.entry(payment_id).write(ephemeral_pub_key_y);
            self.payment_amount.entry(payment_id).write(amount);
            self.payment_k.entry(payment_id).write(k);
            self.payment_view_hint.entry(payment_id).write(view_hint);
            self.payment_timestamp.entry(payment_id).write(timestamp);

            // Increment counter
            self.payment_count.write(payment_id + 1);

            // Emit event for off-chain indexing
            self.emit(PrivatePaymentSent {
                payment_id,
                recipient,
                sender: caller,
                stealth_address,
                ephemeral_pub_key_x,
                ephemeral_pub_key_y,
                amount,
                k,
                view_hint,
                timestamp,
            });
        }

        fn get_payment_count(self: @ContractState) -> u256 {
            self.payment_count.read()
        }

        fn get_payment(
            self: @ContractState,
            payment_id: u256
        ) -> (ContractAddress, felt252, felt252, felt252, u256, u32, felt252) {
            let sender = self.payment_sender.entry(payment_id).read();
            let stealth_address = self.payment_stealth_address.entry(payment_id).read();
            let ephemeral_x = self.payment_ephemeral_x.entry(payment_id).read();
            let ephemeral_y = self.payment_ephemeral_y.entry(payment_id).read();
            let amount = self.payment_amount.entry(payment_id).read();
            let k = self.payment_k.entry(payment_id).read();
            let view_hint = self.payment_view_hint.entry(payment_id).read();
            (sender, stealth_address, ephemeral_x, ephemeral_y, amount, k, view_hint)
        }
    }
}
