import { getFhenixClient } from "./client.ts";
import { getFhenixContract, FHENIX_CONTRACT_ADDRESS } from "./contract.ts";

export async function depositPrivate(amount: number) {
  const { signer } = await getFhenixClient();
  const contract = await getFhenixContract(signer);
  const tx = await contract.deposit(amount);
  await tx.wait();
}

export async function getPrivateBalance(): Promise<number> {
  const { signer, fhenixClient } = await getFhenixClient();
  const contract = await getFhenixContract(signer);

  const permit = await fhenixClient.getPermit(FHENIX_CONTRACT_ADDRESS, signer);

  const sealedBalance = await contract.getEncryptedBalance(permit);

  const decrypted = fhenixClient.unseal(
    FHENIX_CONTRACT_ADDRESS, 
    sealedBalance, 
    signer.address
  );

  return Number(decrypted);
}

export async function hasEnoughBalance(amount: number): Promise<boolean> {
  const { signer, fhenixClient } = await getFhenixClient();
  const contract = await getFhenixContract(signer);

  const permit = await fhenixClient.getPermit(FHENIX_CONTRACT_ADDRESS, signer);
  const sealedResult = await contract.hasEnoughBalance(amount, permit);

  const decrypted = fhenixClient.unseal(
    FHENIX_CONTRACT_ADDRESS, 
    sealedResult, 
    signer.address
  );

  return Boolean(decrypted);
}

export async function privateTransfer(to: string, amount: number) {
  const allowed = await hasEnoughBalance(amount);
  if (!allowed) throw new Error("Insufficient private balance");

  const { signer } = await getFhenixClient();
  const contract = await getFhenixContract(signer);
  const tx = await contract.privateTransfer(to, amount);
  await tx.wait();
}