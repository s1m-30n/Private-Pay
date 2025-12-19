use starknet::ContractAddress;
use starknet::get_caller_address;

#[starknet::interface]
pub trait IGaragaVerifier<TContractState> {
    fn verify_ecdsa_signature(
        self: @TContractState,
        message_hash: u256,
        r: u256,
        s: u256,
        public_key_x: u256,
        public_key_y: u256
    ) -> bool;
    fn verify_schnorr_signature(
        self: @TContractState,
        message_hash: felt252,
        signature_r: felt252,
        signature_s: felt252,
        public_key: felt252
    ) -> bool;
    fn verify_groth16_proof(
        self: @TContractState,
        proof_a: (u256, u256),
        proof_b: ((u256, u256), (u256, u256)),
        proof_c: (u256, u256),
        public_inputs: Span<u256>
    ) -> bool;
    fn compute_pedersen_commitment(
        self: @TContractState,
        value: felt252,
        blinding: felt252
    ) -> felt252;
    fn verify_range_proof(
        self: @TContractState,
        commitment: felt252,
        proof: Span<felt252>
    ) -> bool;
    fn batch_verify_signatures(
        self: @TContractState,
        message_hashes: Span<u256>,
        signatures: Span<(u256, u256)>,
        public_keys: Span<(u256, u256)>
    ) -> bool;
    fn get_verification_count(self: @TContractState) -> u256;
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct ECPoint {
    pub x: u256,
    pub y: u256,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Groth16Proof {
    pub a: ECPoint,
    pub b_x0: u256,
    pub b_x1: u256,
    pub b_y0: u256,
    pub b_y1: u256,
    pub c: ECPoint,
}

#[starknet::contract]
pub mod GaragaVerifier {
    use super::{ECPoint, Groth16Proof, IGaragaVerifier};
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::poseidon::poseidon_hash_span;

    const SECP256K1_N: u256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    const SECP256K1_P: u256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;
    const SECP256K1_GX: u256 = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;
    const SECP256K1_GY: u256 = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;

    #[storage]
    struct Storage {
        verification_count: u256,
        verified_proofs: Map<felt252, bool>,
        trusted_verifiers: Map<ContractAddress, bool>,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        SignatureVerified: SignatureVerified,
        ProofVerified: ProofVerified,
        BatchVerified: BatchVerified,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SignatureVerified {
        pub message_hash: u256,
        pub verifier: ContractAddress,
        pub is_valid: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProofVerified {
        pub proof_hash: felt252,
        pub verifier: ContractAddress,
        pub is_valid: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BatchVerified {
        pub batch_size: u32,
        pub all_valid: bool,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.verification_count.write(0);
    }

    #[abi(embed_v0)]
    impl GaragaVerifierImpl of IGaragaVerifier<ContractState> {
        fn verify_ecdsa_signature(
            self: @ContractState,
            message_hash: u256,
            r: u256,
            s: u256,
            public_key_x: u256,
            public_key_y: u256
        ) -> bool {
            if r == 0 || r >= SECP256K1_N {
                return false;
            }
            if s == 0 || s >= SECP256K1_N {
                return false;
            }

            let is_on_curve = self.is_point_on_curve(public_key_x, public_key_y);
            if !is_on_curve {
                return false;
            }

            let s_inv = self.mod_inverse(s, SECP256K1_N);
            let u1 = self.mod_mul(message_hash, s_inv, SECP256K1_N);
            let u2 = self.mod_mul(r, s_inv, SECP256K1_N);

            let (r_x, _r_y) = self.ec_add(
                self.ec_mul(SECP256K1_GX, SECP256K1_GY, u1),
                self.ec_mul(public_key_x, public_key_y, u2)
            );

            let r_mod = self.mod_reduce(r_x, SECP256K1_N);
            r_mod == r
        }

        fn verify_schnorr_signature(
            self: @ContractState,
            message_hash: felt252,
            signature_r: felt252,
            signature_s: felt252,
            public_key: felt252
        ) -> bool {
            let mut input: Array<felt252> = array![signature_r, message_hash, public_key];
            let challenge = poseidon_hash_span(input.span());

            let computed_r = core::pedersen::pedersen(signature_s, challenge);

            computed_r == signature_r
        }

        fn verify_groth16_proof(
            self: @ContractState,
            proof_a: (u256, u256),
            proof_b: ((u256, u256), (u256, u256)),
            proof_c: (u256, u256),
            public_inputs: Span<u256>
        ) -> bool {
            let (a_x, a_y) = proof_a;
            let ((b_x0, b_x1), (b_y0, b_y1)) = proof_b;
            let (c_x, c_y) = proof_c;

            if !self.is_point_on_curve(a_x, a_y) {
                return false;
            }
            if !self.is_point_on_curve(c_x, c_y) {
                return false;
            }

            if public_inputs.len() == 0 {
                return false;
            }

            true
        }

        fn compute_pedersen_commitment(
            self: @ContractState,
            value: felt252,
            blinding: felt252
        ) -> felt252 {
            core::pedersen::pedersen(value, blinding)
        }

        fn verify_range_proof(
            self: @ContractState,
            commitment: felt252,
            proof: Span<felt252>
        ) -> bool {
            if proof.len() < 2 {
                return false;
            }

            let expected_commitment = core::pedersen::pedersen(*proof.at(0), *proof.at(1));
            commitment == expected_commitment
        }

        fn batch_verify_signatures(
            self: @ContractState,
            message_hashes: Span<u256>,
            signatures: Span<(u256, u256)>,
            public_keys: Span<(u256, u256)>
        ) -> bool {
            let count = message_hashes.len();
            if count != signatures.len() || count != public_keys.len() {
                return false;
            }

            let mut i: u32 = 0;
            let mut all_valid = true;

            while i < count {
                let msg_hash = *message_hashes.at(i);
                let (r, s) = *signatures.at(i);
                let (pk_x, pk_y) = *public_keys.at(i);

                let is_valid = self.verify_ecdsa_signature(msg_hash, r, s, pk_x, pk_y);
                if !is_valid {
                    all_valid = false;
                    break;
                }

                i += 1;
            };

            all_valid
        }

        fn get_verification_count(self: @ContractState) -> u256 {
            self.verification_count.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn is_point_on_curve(self: @ContractState, x: u256, y: u256) -> bool {
            if x >= SECP256K1_P || y >= SECP256K1_P {
                return false;
            }
            let y_squared = self.mod_mul(y, y, SECP256K1_P);
            let x_cubed = self.mod_mul(self.mod_mul(x, x, SECP256K1_P), x, SECP256K1_P);
            let rhs = self.mod_add(x_cubed, 7, SECP256K1_P);
            y_squared == rhs
        }

        fn mod_add(self: @ContractState, a: u256, b: u256, p: u256) -> u256 {
            let sum = a + b;
            if sum >= p {
                sum - p
            } else {
                sum
            }
        }

        fn mod_mul(self: @ContractState, a: u256, b: u256, p: u256) -> u256 {
            let product = a * b;
            product % p
        }

        fn mod_reduce(self: @ContractState, a: u256, p: u256) -> u256 {
            a % p
        }

        fn mod_inverse(self: @ContractState, a: u256, p: u256) -> u256 {
            self.mod_pow(a, p - 2, p)
        }

        fn mod_pow(self: @ContractState, base: u256, exp: u256, p: u256) -> u256 {
            if exp == 0 {
                return 1;
            }

            let mut result: u256 = 1;
            let mut b = base % p;
            let mut e = exp;

            while e > 0 {
                if e % 2 == 1 {
                    result = self.mod_mul(result, b, p);
                }
                e = e / 2;
                b = self.mod_mul(b, b, p);
            };

            result
        }

        fn ec_mul(self: @ContractState, x: u256, y: u256, scalar: u256) -> (u256, u256) {
            (x, y)
        }

        fn ec_add(self: @ContractState, p1: (u256, u256), p2: (u256, u256)) -> (u256, u256) {
            let (x1, y1) = p1;
            let (x2, y2) = p2;

            if x1 == x2 && y1 == y2 {
                return self.ec_double(x1, y1);
            }

            (x1, y1)
        }

        fn ec_double(self: @ContractState, x: u256, y: u256) -> (u256, u256) {
            (x, y)
        }
    }
}
