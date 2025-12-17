# ITS Stealth Payment Fix - December 2024

## Summary

This document details the fixes applied to resolve the "execution reverted" error during `sendCrossChainStealthPaymentITS` transactions for ITS tokens (specifically TUSDC).

**Date:** December 17, 2024  
**Status:** ✅ Fixed and Verified

---

## Problem Statement

Cross-chain stealth payments using Axelar's Interchain Token Service (ITS) were failing with "execution reverted" errors. The transaction would be submitted successfully but fail during the ITS contract execution.

### Original Error
```
Transaction failed. Please check transaction details.
Error: execution reverted
```

---

## Root Cause Analysis

### Issue 1: Incorrect Destination Address Encoding

The ITS contract's `interchainTransfer` function expects destination addresses as **raw 20-byte EVM addresses**, but the code was passing ASCII-encoded address strings.

**Before (Incorrect):**
```solidity
// This converts "0xABC..." to ASCII bytes [0x30, 0x78, 0x41, 0x42, 0x43...]
bytes(destinationContract)  // ~40+ bytes
```

**After (Correct):**
```solidity
// This passes the raw 20-byte address
abi.encodePacked(destinationContractAddress)  // exactly 20 bytes
```

### Issue 2: Wrong ITS Function Call

The original code used `callContractWithInterchainToken` which has an `EmptyData()` validation check that rejects empty or improperly formatted payloads.

**Before:**
```solidity
IInterchainTokenService(interchainTokenService).callContractWithInterchainToken(
    tokenId,
    destinationChain,
    bytes(destinationContract),  // Wrong encoding
    amount,
    payload,
    msg.value
);
```

**After:**
```solidity
IInterchainTokenService(interchainTokenService).interchainTransfer(
    tokenId,
    destinationChain,
    abi.encodePacked(destinationContractAddress),  // Correct 20-byte address
    amount,
    metadata,  // bytes4(0) + payload for contract execution
    msg.value
);
```

---

## Changes Made

### 1. Smart Contract (`AxelarStealthBridge.sol`)

#### New State Variable
```solidity
// Mapping to store trusted remote addresses for ITS (raw address type)
mapping(string => address) public trustedRemotesAddress;
```

#### New Helper Function
```solidity
function _parseAddress(string memory addressString) internal pure returns (address) {
    bytes memory addrBytes = bytes(addressString);
    require(addrBytes.length >= 42, "Invalid address length");
    
    uint160 result = 0;
    for (uint i = 2; i < 42; i++) {
        result *= 16;
        uint8 b = uint8(addrBytes[i]);
        if (b >= 48 && b <= 57) {
            result += (b - 48);
        } else if (b >= 65 && b <= 70) {
            result += (b - 55);
        } else if (b >= 97 && b <= 102) {
            result += (b - 87);
        }
    }
    return address(result);
}
```

#### Updated `setTrustedRemote` and `setTrustedRemotes`
Both functions now populate both `trustedRemotes` (string) and `trustedRemotesAddress` (address) mappings.

#### Updated `sendCrossChainStealthPaymentITS`
- Changed from `callContractWithInterchainToken` to `interchainTransfer`
- Uses `abi.encodePacked(destinationContractAddress)` for correct address encoding
- Constructs metadata as `abi.encodePacked(bytes4(0), payload)` per Axelar docs

### 2. Transaction Tracking (`src/lib/axelar/index.js`)

#### Improved `trackTransaction` Function
- Now uses the correct GMP API endpoint (`/gmp/searchGMP`) with POST method
- Added fallback to GET endpoint if POST fails
- Handles multiple response formats from API

#### New `normalizeGMPResponse` Function
Normalizes raw API responses to a consistent format with:
- `status` - Raw status string
- `statusLabel` - Human-readable label
- `isComplete` - Boolean for completion
- `isPending` - Boolean for pending state
- `isFailed` - Boolean for failure
- `isInsufficientFee` - Boolean for gas issues
- `message` - Descriptive message

### 3. Polling Logic (`src/hooks/useAxelarPayment.js`)

#### Adaptive Polling
- Initial interval: 5 seconds
- Extended interval: 15 seconds (after 2 minutes)
- Max polls: 60 (~10-15 minutes total)

#### Immediate First Poll
Polls immediately after transaction confirmation, then at regular intervals.

#### Better Status Detection
Uses normalized response properties:
```javascript
if (status.isComplete) { ... }
if (status.isFailed) { ... }
if (status.isInsufficientFee) { ... }
```

---

## Deployed Contract Addresses

After redeployment with the fixes:

| Network | Address |
|---------|---------|
| Ethereum Sepolia | `0x04ab5fA40Df5bF1B5e9E640b5D24C740ec5DfDeE` |
| Base Sepolia | `0xE09f184968cdAD4D0B94e2968Cfbf1395FB66D79` |

---

## Verification

### Successful Transaction
- **TX Hash:** `0xb18421763fd46a0781f28b0048223c032b66cbfb1c517add4e2fb292662983f4`
- **Status:** `executed`
- **Axelarscan:** [View Transaction](https://testnet.axelarscan.io/gmp/0xb18421763fd46a0781f28b0048223c032b66cbfb1c517add4e2fb292662983f4)

### API Response
```json
{
  "status": "executed",
  "simplified_status": "received",
  "executed": true
}
```

---

## GMP Status Values Reference

| Status | Label | Description |
|--------|-------|-------------|
| `source_gateway_called` | Initiated | Transaction sent to gateway |
| `confirmed` / `approving` | Confirming | Being confirmed/approved |
| `destination_gateway_approved` | Approved | Approved, awaiting execution |
| `executing` | Executing | Being executed on destination |
| `destination_executed` | Completed | Successfully executed |
| `express_executed` | Express Executed | Fast-path execution |
| `error` | Failed | Execution failed |
| `insufficient_fee` | Insufficient Gas | Need to add more gas |

---

## Files Modified

| File | Changes |
|------|---------|
| `hardhat/contracts/AxelarStealthBridge.sol` | ITS function fix, address encoding, `_parseAddress` helper |
| `src/lib/axelar/index.js` | Transaction tracking API fix, `normalizeGMPResponse` function |
| `src/hooks/useAxelarPayment.js` | Adaptive polling, improved status detection |
| `src/lib/axelar/crossChainPayment.js` | Removed `executeData` from gas estimation |

---

## Security Audit Notes

### No Mocked/Fake Components
- ✅ All API calls are real (Axelar GMP, Axelarscan)
- ✅ All contract interactions are on-chain
- ✅ All tokens are real (TUSDC is a deployed test token)

### Placeholder Values (Intentional)
Direct transfers (non-stealth) use zero-filled `ephemeralPubKey` and `viewHint` as these parameters are not used by the contract for direct transfers.

### Fallbacks (Graceful Degradation)
- Asset list fallback if Axelar API is unavailable
- GET fallback if POST to tracking API fails

---

## References

- [Axelar ITS Documentation](https://docs.axelar.dev/dev/send-tokens/interchain-tokens/developer-guides/link-custom-tokens-deployed-across-multiple-chains-into-interchain-tokens)
- [Axelar GMP API](https://docs.axelarscan.io/gmp)
- [Axelar Gas Service](https://docs.axelar.dev/dev/gas-service/pay-gas/)
- [AxelarJS SDK Recovery API](https://docs.axelar.dev/dev/axelarjs-sdk/tx-status-query-recovery)
