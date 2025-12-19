// contracts/ZcashBridge.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ZcashBridge is Ownable {
    // Maps nullifiers to prevent double-spending
    mapping(bytes32 => bool) public nullifiers;
    
    // Maps commitments to track locked funds
    mapping(bytes32 => bool) public commitments;
    
    // Bridge parameters
    uint256 public minConfirmations = 6;
    address public relayer;
    
    event Locked(
        bytes32 indexed commitment,
        bytes32 nullifier,
        bytes32 proof,
        uint256 amount,
        address indexed recipient
    );
    
    event Unlocked(
        bytes32 nullifier,
        uint256 amount,
        address indexed recipient
    );
    
    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not relayer");
        _;
    }
    
    constructor(address _relayer) {
        relayer = _relayer;
    }
    
    function lock(
        bytes32 commitment,
        bytes32 nullifier,
        bytes32 proof,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        require(!nullifiers[nullifier], "Nullifier already used");
        require(!commitments[commitment], "Commitment already used");
        
        // In production, verify the ZK proof here
        // For now, we'll just emit the event
        emit Locked(commitment, nullifier, proof, amount, recipient);
        
        // Record the nullifier and commitment
        nullifiers[nullifier] = true;
        commitments[commitment] = true;
    }
    
    function unlock(
        bytes32 nullifier,
        uint256 amount,
        address recipient
    ) external onlyRelayer {
        require(!nullifiers[nullifier], "Nullifier already used");
        
        // Record the nullifier
        nullifiers[nullifier] = true;
        
        // Transfer funds to recipient
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Unlocked(nullifier, amount, recipient);
    }
    
    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }
}