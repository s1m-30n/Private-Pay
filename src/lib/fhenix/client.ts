import { FhenixClient } from "fhenixjs";
import { ethers } from "ethers";

export async function getFhenixClient() {
  if (!(window as any).ethereum) throw new Error("Wallet not found");

  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();

  // Optimized for Nitrogen testnet
  const fhenixClient = new FhenixClient({ provider });

  return { provider, signer, fhenixClient };
}