use starknet::ContractAddress;
use starknet::get_caller_address;
use starknet::get_block_timestamp;

#[starknet::interface]
pub trait IAtomicSwap<TContractState> {
    fn initiate_swap(
        ref self: TContractState,
        zec_amount: u256,
        starknet_asset: ContractAddress,
        starknet_amount: u256,
        recipient: ContractAddress,
        hashlock: felt252,
        timelock: u64
    ) -> u256;
    fn claim_swap(ref self: TContractState, swap_id: u256, preimage: felt252);
    fn refund_swap(ref self: TContractState, swap_id: u256);
    fn get_swap(self: @TContractState, swap_id: u256) -> Swap;
    fn get_swap_status(self: @TContractState, swap_id: u256) -> SwapStatus;
    fn verify_hashlock(self: @TContractState, preimage: felt252, hashlock: felt252) -> bool;
    fn get_user_swaps(self: @TContractState, user: ContractAddress) -> u256;
}

#[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
pub enum SwapStatus {
    Pending,
    Claimed,
    Refunded,
    Expired,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Swap {
    pub id: u256,
    pub initiator: ContractAddress,
    pub recipient: ContractAddress,
    pub zec_amount: u256,
    pub starknet_asset: ContractAddress,
    pub starknet_amount: u256,
    pub hashlock: felt252,
    pub timelock: u64,
    pub preimage: felt252,
    pub status: SwapStatus,
    pub created_at: u64,
    pub completed_at: u64,
}

#[starknet::contract]
pub mod AtomicSwap {
    use super::{Swap, SwapStatus, IAtomicSwap};
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::poseidon::poseidon_hash_span;

    const MIN_TIMELOCK: u64 = 3600;
    const MAX_TIMELOCK: u64 = 604800;

    #[storage]
    struct Storage {
        swap_count: u256,
        swaps: Map<u256, Swap>,
        user_swap_count: Map<ContractAddress, u256>,
        hashlock_used: Map<felt252, bool>,
        total_volume_zec: u256,
        total_swaps_completed: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        SwapInitiated: SwapInitiated,
        SwapClaimed: SwapClaimed,
        SwapRefunded: SwapRefunded,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SwapInitiated {
        #[key]
        pub swap_id: u256,
        pub initiator: ContractAddress,
        pub recipient: ContractAddress,
        pub zec_amount: u256,
        pub hashlock: felt252,
        pub timelock: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SwapClaimed {
        #[key]
        pub swap_id: u256,
        pub claimer: ContractAddress,
        pub preimage: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SwapRefunded {
        #[key]
        pub swap_id: u256,
        pub refundee: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.swap_count.write(0);
        self.total_volume_zec.write(0);
        self.total_swaps_completed.write(0);
    }

    #[abi(embed_v0)]
    impl AtomicSwapImpl of IAtomicSwap<ContractState> {
        fn initiate_swap(
            ref self: ContractState,
            zec_amount: u256,
            starknet_asset: ContractAddress,
            starknet_amount: u256,
            recipient: ContractAddress,
            hashlock: felt252,
            timelock: u64
        ) -> u256 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            assert(zec_amount > 0, 'Invalid ZEC amount');
            assert(starknet_amount > 0, 'Invalid Starknet amount');
            assert(timelock >= MIN_TIMELOCK, 'Timelock too short');
            assert(timelock <= MAX_TIMELOCK, 'Timelock too long');
            assert(!self.hashlock_used.read(hashlock), 'Hashlock already used');

            let swap_id = self.swap_count.read() + 1;
            self.swap_count.write(swap_id);

            self.hashlock_used.write(hashlock, true);

            let swap = Swap {
                id: swap_id,
                initiator: caller,
                recipient: recipient,
                zec_amount: zec_amount,
                starknet_asset: starknet_asset,
                starknet_amount: starknet_amount,
                hashlock: hashlock,
                timelock: timelock,
                preimage: 0,
                status: SwapStatus::Pending,
                created_at: timestamp,
                completed_at: 0,
            };

            self.swaps.write(swap_id, swap);

            let user_count = self.user_swap_count.read(caller);
            self.user_swap_count.write(caller, user_count + 1);

            self.emit(SwapInitiated {
                swap_id: swap_id,
                initiator: caller,
                recipient: recipient,
                zec_amount: zec_amount,
                hashlock: hashlock,
                timelock: timelock,
            });

            swap_id
        }

        fn claim_swap(ref self: ContractState, swap_id: u256, preimage: felt252) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            let mut swap = self.swaps.read(swap_id);
            assert(swap.status == SwapStatus::Pending, 'Swap not pending');
            assert(timestamp < swap.created_at + swap.timelock, 'Swap expired');

            let computed_hash = self.compute_hash(preimage);
            assert(computed_hash == swap.hashlock, 'Invalid preimage');

            swap.preimage = preimage;
            swap.status = SwapStatus::Claimed;
            swap.completed_at = timestamp;
            self.swaps.write(swap_id, swap);

            let total_vol = self.total_volume_zec.read();
            self.total_volume_zec.write(total_vol + swap.zec_amount);

            let total_completed = self.total_swaps_completed.read();
            self.total_swaps_completed.write(total_completed + 1);

            self.emit(SwapClaimed {
                swap_id: swap_id,
                claimer: caller,
                preimage: preimage,
            });
        }

        fn refund_swap(ref self: ContractState, swap_id: u256) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            let mut swap = self.swaps.read(swap_id);
            assert(swap.initiator == caller, 'Not swap initiator');
            assert(swap.status == SwapStatus::Pending, 'Swap not pending');
            assert(timestamp >= swap.created_at + swap.timelock, 'Timelock not expired');

            swap.status = SwapStatus::Refunded;
            swap.completed_at = timestamp;
            self.swaps.write(swap_id, swap);

            self.emit(SwapRefunded {
                swap_id: swap_id,
                refundee: caller,
            });
        }

        fn get_swap(self: @ContractState, swap_id: u256) -> Swap {
            self.swaps.read(swap_id)
        }

        fn get_swap_status(self: @ContractState, swap_id: u256) -> SwapStatus {
            let swap = self.swaps.read(swap_id);
            let timestamp = get_block_timestamp();

            if swap.status == SwapStatus::Pending && timestamp >= swap.created_at + swap.timelock {
                return SwapStatus::Expired;
            }

            swap.status
        }

        fn verify_hashlock(self: @ContractState, preimage: felt252, hashlock: felt252) -> bool {
            let computed = self.compute_hash(preimage);
            computed == hashlock
        }

        fn get_user_swaps(self: @ContractState, user: ContractAddress) -> u256 {
            self.user_swap_count.read(user)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn compute_hash(self: @ContractState, preimage: felt252) -> felt252 {
            let mut input: Array<felt252> = array![preimage];
            poseidon_hash_span(input.span())
        }
    }
}
