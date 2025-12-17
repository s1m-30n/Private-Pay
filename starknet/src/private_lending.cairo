use starknet::ContractAddress;
use starknet::get_caller_address;
use starknet::get_block_timestamp;

#[starknet::interface]
pub trait IPrivateLending<TContractState> {
    fn deposit_collateral(ref self: TContractState, amount: u256, asset_type: felt252) -> u256;
    fn borrow(ref self: TContractState, amount: u256, collateral_id: u256) -> u256;
    fn repay(ref self: TContractState, loan_id: u256, amount: u256);
    fn liquidate(ref self: TContractState, loan_id: u256);
    fn withdraw_collateral(ref self: TContractState, collateral_id: u256);
    fn get_collateral(self: @TContractState, collateral_id: u256) -> Collateral;
    fn get_loan(self: @TContractState, loan_id: u256) -> Loan;
    fn get_health_factor(self: @TContractState, loan_id: u256) -> u256;
    fn get_user_collaterals(self: @TContractState, user: ContractAddress) -> u256;
    fn get_user_loans(self: @TContractState, user: ContractAddress) -> u256;
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Collateral {
    pub id: u256,
    pub owner: ContractAddress,
    pub stealth_address: felt252,
    pub amount: u256,
    pub asset_type: felt252,
    pub deposited_at: u64,
    pub is_locked: bool,
    pub is_withdrawn: bool,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Loan {
    pub id: u256,
    pub borrower: ContractAddress,
    pub stealth_recipient: felt252,
    pub collateral_id: u256,
    pub principal: u256,
    pub interest_rate: u256,
    pub borrowed_at: u64,
    pub is_repaid: bool,
    pub is_liquidated: bool,
}

#[starknet::contract]
pub mod PrivateLending {
    use super::{Collateral, Loan, IPrivateLending};
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};

    const COLLATERAL_RATIO: u256 = 150;
    const LIQUIDATION_THRESHOLD: u256 = 120;
    const INTEREST_RATE_BPS: u256 = 500;

    #[storage]
    struct Storage {
        collateral_count: u256,
        loan_count: u256,
        collaterals: Map<u256, Collateral>,
        loans: Map<u256, Loan>,
        user_collateral_count: Map<ContractAddress, u256>,
        user_loan_count: Map<ContractAddress, u256>,
        asset_prices: Map<felt252, u256>,
        total_deposits: Map<felt252, u256>,
        total_borrows: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        CollateralDeposited: CollateralDeposited,
        LoanCreated: LoanCreated,
        LoanRepaid: LoanRepaid,
        LoanLiquidated: LoanLiquidated,
        CollateralWithdrawn: CollateralWithdrawn,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralDeposited {
        #[key]
        pub collateral_id: u256,
        pub stealth_address: felt252,
        pub amount: u256,
        pub asset_type: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LoanCreated {
        #[key]
        pub loan_id: u256,
        pub collateral_id: u256,
        pub stealth_recipient: felt252,
        pub principal: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LoanRepaid {
        #[key]
        pub loan_id: u256,
        pub amount_repaid: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LoanLiquidated {
        #[key]
        pub loan_id: u256,
        pub liquidator: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralWithdrawn {
        #[key]
        pub collateral_id: u256,
        pub owner: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.collateral_count.write(0);
        self.loan_count.write(0);
        self.total_borrows.write(0);
    }

    #[abi(embed_v0)]
    impl PrivateLendingImpl of IPrivateLending<ContractState> {
        fn deposit_collateral(ref self: ContractState, amount: u256, asset_type: felt252) -> u256 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            let collateral_id = self.collateral_count.read() + 1;
            self.collateral_count.write(collateral_id);

            let stealth_address = self.generate_stealth_address(caller, collateral_id);

            let collateral = Collateral {
                id: collateral_id,
                owner: caller,
                stealth_address: stealth_address,
                amount: amount,
                asset_type: asset_type,
                deposited_at: timestamp,
                is_locked: false,
                is_withdrawn: false,
            };

            self.collaterals.write(collateral_id, collateral);

            let user_count = self.user_collateral_count.read(caller);
            self.user_collateral_count.write(caller, user_count + 1);

            let total = self.total_deposits.read(asset_type);
            self.total_deposits.write(asset_type, total + amount);

            self.emit(CollateralDeposited {
                collateral_id: collateral_id,
                stealth_address: stealth_address,
                amount: amount,
                asset_type: asset_type,
            });

            collateral_id
        }

        fn borrow(ref self: ContractState, amount: u256, collateral_id: u256) -> u256 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            let mut collateral = self.collaterals.read(collateral_id);
            assert(collateral.owner == caller, 'Not collateral owner');
            assert(!collateral.is_locked, 'Collateral already locked');
            assert(!collateral.is_withdrawn, 'Collateral withdrawn');

            let max_borrow = (collateral.amount * 100) / COLLATERAL_RATIO;
            assert(amount <= max_borrow, 'Exceeds borrow limit');

            collateral.is_locked = true;
            self.collaterals.write(collateral_id, collateral);

            let loan_id = self.loan_count.read() + 1;
            self.loan_count.write(loan_id);

            let stealth_recipient = self.generate_stealth_address(caller, loan_id);

            let loan = Loan {
                id: loan_id,
                borrower: caller,
                stealth_recipient: stealth_recipient,
                collateral_id: collateral_id,
                principal: amount,
                interest_rate: INTEREST_RATE_BPS,
                borrowed_at: timestamp,
                is_repaid: false,
                is_liquidated: false,
            };

            self.loans.write(loan_id, loan);

            let user_loans = self.user_loan_count.read(caller);
            self.user_loan_count.write(caller, user_loans + 1);

            let total = self.total_borrows.read();
            self.total_borrows.write(total + amount);

            self.emit(LoanCreated {
                loan_id: loan_id,
                collateral_id: collateral_id,
                stealth_recipient: stealth_recipient,
                principal: amount,
            });

            loan_id
        }

        fn repay(ref self: ContractState, loan_id: u256, amount: u256) {
            let caller = get_caller_address();

            let mut loan = self.loans.read(loan_id);
            assert(loan.borrower == caller, 'Not loan borrower');
            assert(!loan.is_repaid, 'Already repaid');
            assert(!loan.is_liquidated, 'Loan liquidated');

            let total_owed = self.calculate_total_owed(loan);
            assert(amount >= total_owed, 'Insufficient repayment');

            loan.is_repaid = true;
            self.loans.write(loan_id, loan);

            let mut collateral = self.collaterals.read(loan.collateral_id);
            collateral.is_locked = false;
            self.collaterals.write(loan.collateral_id, collateral);

            let total = self.total_borrows.read();
            self.total_borrows.write(total - loan.principal);

            self.emit(LoanRepaid {
                loan_id: loan_id,
                amount_repaid: amount,
            });
        }

        fn liquidate(ref self: ContractState, loan_id: u256) {
            let caller = get_caller_address();

            let mut loan = self.loans.read(loan_id);
            assert(!loan.is_repaid, 'Already repaid');
            assert(!loan.is_liquidated, 'Already liquidated');

            let health_factor = self.get_health_factor(loan_id);
            assert(health_factor < 100, 'Not liquidatable');

            loan.is_liquidated = true;
            self.loans.write(loan_id, loan);

            let mut collateral = self.collaterals.read(loan.collateral_id);
            collateral.is_withdrawn = true;
            self.collaterals.write(loan.collateral_id, collateral);

            let total = self.total_borrows.read();
            self.total_borrows.write(total - loan.principal);

            self.emit(LoanLiquidated {
                loan_id: loan_id,
                liquidator: caller,
            });
        }

        fn withdraw_collateral(ref self: ContractState, collateral_id: u256) {
            let caller = get_caller_address();

            let mut collateral = self.collaterals.read(collateral_id);
            assert(collateral.owner == caller, 'Not collateral owner');
            assert(!collateral.is_locked, 'Collateral is locked');
            assert(!collateral.is_withdrawn, 'Already withdrawn');

            collateral.is_withdrawn = true;
            self.collaterals.write(collateral_id, collateral);

            let total = self.total_deposits.read(collateral.asset_type);
            self.total_deposits.write(collateral.asset_type, total - collateral.amount);

            self.emit(CollateralWithdrawn {
                collateral_id: collateral_id,
                owner: caller,
            });
        }

        fn get_collateral(self: @ContractState, collateral_id: u256) -> Collateral {
            self.collaterals.read(collateral_id)
        }

        fn get_loan(self: @ContractState, loan_id: u256) -> Loan {
            self.loans.read(loan_id)
        }

        fn get_health_factor(self: @ContractState, loan_id: u256) -> u256 {
            let loan = self.loans.read(loan_id);
            let collateral = self.collaterals.read(loan.collateral_id);

            if loan.principal == 0 {
                return 999;
            }

            (collateral.amount * 100) / loan.principal
        }

        fn get_user_collaterals(self: @ContractState, user: ContractAddress) -> u256 {
            self.user_collateral_count.read(user)
        }

        fn get_user_loans(self: @ContractState, user: ContractAddress) -> u256 {
            self.user_loan_count.read(user)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn generate_stealth_address(self: @ContractState, user: ContractAddress, nonce: u256) -> felt252 {
            let user_felt: felt252 = user.into();
            let nonce_low: felt252 = nonce.low.into();
            core::pedersen::pedersen(user_felt, nonce_low)
        }

        fn calculate_total_owed(self: @ContractState, loan: Loan) -> u256 {
            let interest = (loan.principal * loan.interest_rate) / 10000;
            loan.principal + interest
        }
    }
}
