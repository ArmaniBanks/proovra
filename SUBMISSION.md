# ProoVra Submission Notes

## Project

ProoVra: payment only after proof for AI agents.

ProoVra is an escrow and settlement layer for AI-to-AI commerce on Arc. The product lets requester agents fund an escrow, provider agents complete work, and payment release happen only after proof is verified.

## Current Build

- Frontend: Next.js app.
- Demo mode: simulation-first for reliable judging.
- Persistence: local project persistence layer for demo data.
- Provider architecture: simulation remains default, Arc Testnet can be selected through environment configuration.
- Live integrations not started: mainnet support and receipt redesign.

## Live Arc Testnet Verification

- Contract: `0x38D7C4cC9C108D127923651ced41bdb123Dbc611`
- Network: Arc Testnet
- Chain ID: `5042002`
- Verified flow: Approve -> CreateEscrow -> ReleaseAfterProof
- Escrow ID: `2`
- Status: `Released`
- Amount: `0.000001 USDC`
- Requester: `0xabeC63339443cE52Be54FB12833C41B311Ea168c`
- Provider: `0x1047d233336BE340eFD867dB02C8a466bCFaA357`
- Result: Proof successfully triggered payment release.

## Evidence

- Approval: `https://testnet.arcscan.app/tx/0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59`
- CreateEscrow: `https://testnet.arcscan.app/tx/0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130`
- ReleaseAfterProof: `https://testnet.arcscan.app/tx/0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036`
- Full verification report: `ARC_TESTNET_VERIFICATION_REPORT.md`

## Live x402 Verification

- Protected endpoint: `http://127.0.0.1:3042/api/x402/protected-proof`
- Authorization route: `POST /api/x402/authorize`
- Provider: `circle-cli-x402`
- Scheme: `GatewayWalletBatched`
- Circle wallet: `0x1047d233336be340efd867db02c8a466bcfaa357`
- Gateway payer: `0x0746cd1b1186ff3594c791959180784c12b98b79`
- Price: `0.000001 USDC`
- Chain: `eip155:5042002`
- Gateway deposit approval: `0x72c281d9a92469f5602649774fb7bb9fb099869c1263b6f5ecd50b87ae7342a6`
- Gateway deposit: `0xa0145d205be45363444a8e640df656efd69b5fed0cb95c3c1cbd849048e2c6bd`
- Payment ID: `circle-cli-x402:x402-proof-service:a998a577850d50cc`
- Settlement transaction: `367c87b1-d1d7-45bb-90d8-048cf943a1c8`
- Verified behavior: unpaid requests return `402`; fake payment headers return `402`; paid Circle CLI request returns protected proof data and persisted payment evidence.

ProoVra includes the Circle CLI x402 provider and persists settled x402 payment records before allowing protected proof access.

## Lepton Tooling Compliance

### ARC CLI

Installation command:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
```

Why it is required:

The ARC CLI is part of the Lepton setup path and provides Arc testnet access, Arc documentation, repositories, and setup context for builders and coding agents.

How ProoVra uses it:

ProoVra documents ARC CLI setup as the official Arc readiness path and uses it as the reference for Arc docs/RPC/setup context. The verified live settlement uses the deployed `SettlementEscrow` contract on Arc Testnet through the official Arc Testnet RPC.

### Circle CLI

Installation command:

```bash
npm install -g @circle-fin/cli
```

Why it is required:

The Circle CLI supports agent wallets, x402-compatible payments, and USDC workflows from the command line.

How ProoVra uses it:

ProoVra documents Circle CLI setup and includes provider boundaries for Circle wallet and x402 authorization. Circle agent wallet readiness and paid Circle Gateway x402 authorization have been verified in testnet/local execution. ProoVra does not claim mainnet Circle Wallet, Gateway, or production x402 execution.

### Honest Integration Status

- ProoVra currently uses a controlled Arc Testnet smart-contract settlement flow.
- The verified live flow is Arc Testnet USDC proof-to-payment settlement.
- Simulation mode remains the default for demo stability.
- Circle wallets, paid Circle Gateway x402 authorization, and Arc Testnet settlement have live test evidence.

### Submission Checklist

- Public GitHub URL: TODO
- Live Product URL: TODO
- Demo Video URL: TODO
- ARC CLI documented: YES
- Circle CLI documented: YES
- Arc Testnet verification: YES
- Under 3-minute video required: TODO

## What This Proves

The deployed `SettlementEscrow` contract accepted an escrow deposit, stored a proof hash, verified the submitted proof hash during release, and released the escrowed USDC after proof.

## Demo Recommendation

Show the app in simulation mode for a stable product walkthrough, then present the ArcScan transaction links and verification report as evidence that the core proof-to-payment settlement path has been executed on Arc Testnet.
