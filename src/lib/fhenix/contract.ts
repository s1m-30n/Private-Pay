import { ethers } from "ethers";
import PrivatePayFhenixABI from "./PrivatePayFhenix.json";

export const FHENIX_CONTRACT_ADDRESS = "0xYourDeployedAddressHere";

/**
 * Returns an ethers.Contract instance connected to the Fhenix contract
 * @param signer The ethers signer (from MetaMask/getFhenixClient)
 */
export async function getFhenixContract(signer: any) {
  if (!FHENIX_CONTRACT_ADDRESS || FHENIX_CONTRACT_ADDRESS === "0xYourDeployedAddressHere") {
    console.warn("Warning: FHENIX_CONTRACT_ADDRESS is not set!");
  }

  return new ethers.Contract(
    FHENIX_CONTRACT_ADDRESS,
    PrivatePayFhenixABI,
    signer
  );
}