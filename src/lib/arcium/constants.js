import { PublicKey } from "@solana/web3.js";

export const ARCIUM_PROGRAM_ID = new PublicKey(import.meta.env.VITE_ARCIUM_PROGRAM_ID);
export const PRIVATE_PAY_PROGRAM_ID = new PublicKey(import.meta.env.VITE_PRIVATE_PAY_PROGRAM_ID);
export const PRIVATE_SWAP_PROGRAM_ID = new PublicKey(import.meta.env.VITE_PRIVATE_SWAP_PROGRAM_ID);
export const DARK_POOL_PROGRAM_ID = new PublicKey(import.meta.env.VITE_DARK_POOL_PROGRAM_ID);
export const ARCIUM_CLUSTER_OFFSET = parseInt(import.meta.env.VITE_ARCIUM_CLUSTER_OFFSET || "0");
