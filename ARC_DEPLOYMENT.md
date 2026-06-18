# Arc Testnet Deployment

This document covers the first ProoVra Arc Testnet settlement contract deployment.

Current Arc Testnet configuration:

```env
ARC_TESTNET_CHAIN_ID=5042002
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_TESTNET_EXPLORER=https://testnet.arcscan.app
```

Simulation mode remains the application default. Do not use mainnet funds or mainnet keys.

## Contract

Contract source:

```text
contracts/SettlementEscrow.sol
```

Capabilities:

- create ERC-20 escrow deposits
- release funds after requester-approved proof hash
- refund requester after expiry
- emit settlement lifecycle events

## Required Environment

```env
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_TESTNET_DEPLOYER_PRIVATE_KEY=...
```

The deployer wallet must hold Arc testnet funds before deployment.

## Build

Use the locally installed Foundry binary:

```powershell
.\tools\foundry\forge.exe build
```

## Deploy

```powershell
.\tools\foundry\forge.exe script script/DeploySettlementEscrow.s.sol:DeploySettlementEscrow `
  --rpc-url https://rpc.testnet.arc.network `
  --broadcast
```

After deployment, update:

```text
deployments/arc-testnet.json
```

Record:

- contract address
- deployment transaction hash
- deployer address
- deployment timestamp
- verification status

## Verify On Explorer

Use the official explorer:

```text
https://testnet.arcscan.app
```

If explorer source verification is supported, verify using the exact compiler version:

```text
0.8.24
```

## First Settlement Test

1. Use a test ERC-20/USDC token address on Arc Testnet.
2. Approve the escrow contract to transfer the smallest possible test amount.
3. Call `createEscrow(provider, token, amount, proofHash, expiresAt)`.
4. Confirm `EscrowCreated`.
5. Call `releaseAfterProof(escrowId, proofHash)` from the requester wallet.
6. Confirm `EscrowReleased`.
7. Confirm the release transaction hash on the Arc explorer.
8. Confirm receipt and block confirmations through RPC.

## Verified First Settlement

The controlled first settlement has completed successfully on Arc Testnet.

- Contract: `0x38D7C4cC9C108D127923651ced41bdb123Dbc611`
- Flow: Approve -> CreateEscrow -> ReleaseAfterProof
- Escrow ID: `1`
- Status: `Released`
- Amount: `0.000001 USDC`
- Token: `0x3600000000000000000000000000000000000000`
- Requester: `0xabeC63339443cE52Be54FB12833C41B311Ea168c`
- Provider: `0xabeC63339443cE52Be54FB12833C41B311Ea168c`
- Proof hash: `0x66b46890dd125a83b960e4a19245b124b1295c3c66831a088a90cd4fde308bde`
- Result: Proof successfully triggered payment release.

Transactions:

- Approval: `0xb5cd7dcd9b1c168e7c1ffe83acc9e219b7572e5fb57a5feddfad8925ba747c15`
- CreateEscrow: `0xcd623a2d00d197cc812b48ca3ad786cabcd579ef7450fea934e934fcf8ef5743`
- ReleaseAfterProof: `0xa8a273a235947282508ea62e9d088533b146b173d4b4e656684d6b5079c004d4`

ArcScan links:

- Approval: `https://testnet.arcscan.app/tx/0xb5cd7dcd9b1c168e7c1ffe83acc9e219b7572e5fb57a5feddfad8925ba747c15`
- CreateEscrow: `https://testnet.arcscan.app/tx/0xcd623a2d00d197cc812b48ca3ad786cabcd579ef7450fea934e934fcf8ef5743`
- ReleaseAfterProof: `https://testnet.arcscan.app/tx/0xa8a273a235947282508ea62e9d088533b146b173d4b4e656684d6b5079c004d4`

## Fallback

If deployment or settlement fails, switch the app back to simulation:

```env
PROOVRA_SETTLEMENT_PROVIDER=simulation
```

Do not continue retrying transactions until the failed transaction hash and wallet nonce are understood.
