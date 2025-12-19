import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);
  
  const contract = await ethers.deployContract("PrivatePayFhenix"); 

  console.log("Waiting for deployment...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PrivatePayFhenix deployed at:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});