// Stealth Address Registry for Starknet
// Implements EIP-5564 / BIP-0352 compatible stealth addresses
// PrivatePay v1.0.0 - Deployed December 2024

use starknet::ContractAddress;

#[starknet::interface]
pub trait IStealthAddressRegistry<TContractState> {
    fn register_meta_address(
        ref self: TContractState,
        spend_pub_key_x: felt252,
        spend_pub_key_y: felt252,
        viewing_pub_key_x: felt252,
        viewing_pub_key_y: felt252,
    );
    fn get_meta_address(
        self: @TContractState,
        owner: ContractAddress,
        index: u32
    ) -> (felt252, felt252, felt252, felt252);
    fn get_meta_address_count(self: @TContractState, owner: ContractAddress) -> u32;
}

#[starknet::contract]
pub mod StealthAddressRegistry {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StoragePathEntry
    };

    #[storage]
    struct Storage {
        // Mapping: (owner, index) -> MetaAddress components
        meta_address_spend_x: Map::<(ContractAddress, u32), felt252>,
        meta_address_spend_y: Map::<(ContractAddress, u32), felt252>,
        meta_address_viewing_x: Map::<(ContractAddress, u32), felt252>,
        meta_address_viewing_y: Map::<(ContractAddress, u32), felt252>,
        // Count of meta addresses per owner
        meta_address_count: Map::<ContractAddress, u32>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MetaAddressRegistered: MetaAddressRegistered,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MetaAddressRegistered {
        #[key]
        pub owner: ContractAddress,
        pub index: u32,
        pub spend_pub_key_x: felt252,
        pub spend_pub_key_y: felt252,
        pub viewing_pub_key_x: felt252,
        pub viewing_pub_key_y: felt252,
    }

    #[abi(embed_v0)]
    impl StealthAddressRegistryImpl of super::IStealthAddressRegistry<ContractState> {
        fn register_meta_address(
            ref self: ContractState,
            spend_pub_key_x: felt252,
            spend_pub_key_y: felt252,
            viewing_pub_key_x: felt252,
            viewing_pub_key_y: felt252,
        ) {
            let caller = get_caller_address();
            let index = self.meta_address_count.entry(caller).read();

            // Store meta address components
            self.meta_address_spend_x.entry((caller, index)).write(spend_pub_key_x);
            self.meta_address_spend_y.entry((caller, index)).write(spend_pub_key_y);
            self.meta_address_viewing_x.entry((caller, index)).write(viewing_pub_key_x);
            self.meta_address_viewing_y.entry((caller, index)).write(viewing_pub_key_y);

            // Increment count
            self.meta_address_count.entry(caller).write(index + 1);

            // Emit event
            self.emit(MetaAddressRegistered {
                owner: caller,
                index,
                spend_pub_key_x,
                spend_pub_key_y,
                viewing_pub_key_x,
                viewing_pub_key_y,
            });
        }

        fn get_meta_address(
            self: @ContractState,
            owner: ContractAddress,
            index: u32
        ) -> (felt252, felt252, felt252, felt252) {
            let spend_x = self.meta_address_spend_x.entry((owner, index)).read();
            let spend_y = self.meta_address_spend_y.entry((owner, index)).read();
            let viewing_x = self.meta_address_viewing_x.entry((owner, index)).read();
            let viewing_y = self.meta_address_viewing_y.entry((owner, index)).read();
            (spend_x, spend_y, viewing_x, viewing_y)
        }

        fn get_meta_address_count(self: @ContractState, owner: ContractAddress) -> u32 {
            self.meta_address_count.entry(owner).read()
        }
    }
}
