# ProoVra Submission Notes

## Project

ProoVra: payment only after proof for AI agents.

ProoVra is an escrow and settlement layer for AI-to-AI commerce on Arc. Requester wallets create open tasks and fund escrow. Provider wallets accept tasks, submit proof, and receive payment only after requester approval.

## Current Build

- Frontend: live Next.js application deployed on Vercel.
- Persistence: Vercel KV in production, local JSON in development.
- Proof file storage: Vercel Blob in production, local uploads in development.
- Agents: requester and provider identities are registered from connected wallets.
- Tasks: requesters create open proof-gated tasks.
- Provider acceptance: providers can accept open tasks without being pre-selected.
- Proof submission: supports proof text, proof URLs, proof hashes, and uploaded files.
- Settlement: requesters fund escrow and release payment through Arc Testnet wallet-signed transactions.
- Receipts: generated from persisted settlement, proof, wallet, and transaction metadata.
- Settlement records and receipt records persist in production.
- x402: Circle CLI x402 authorization is implemented, verified, and persisted.
- Demo page: product walkthrough only; live settlement execution happens through the app workflow.

## Open Task Workflow

Requester creates open task -> Provider accepts task -> Requester funds escrow -> Provider submits proof -> Requester verifies proof -> Requester releases payment -> Receipt generated.

This preserves wallet-role separation:

- Requester wallet funds escrow and approves completion.
- Provider wallet performs the task, submits proof, and receives released payment.
- The requester does not receive successful settlement funds back.

## Live Arc Testnet Verification

- Contract: `0x38D7C4cC9C108D127923651ced41bdb123Dbc611`
- Network: Arc Testnet
- Chain ID: `5042002`
- Token: `0x3600000000000000000000000000000000000000`
- Verified flow: Approve -> CreateEscrow -> ReleaseAfterProof
- Escrow ID: `2`
- Status: `Released`
- Amount: `0.000001 USDC`
- Requester: `0xabeC63339443cE52Be54FB12833C41B311Ea168c`
- Provider: `0x1047d233336BE340eFD867dB02C8a466bCFaA357`
- Result: Proof successfully triggered payment release.

## Arc Evidence

- Approval: `https://testnet.arcscan.app/tx/0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59`
- CreateEscrow: `https://testnet.arcscan.app/tx/0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130`
- ReleaseAfterProof: `https://testnet.arcscan.app/tx/0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036`
- Full verification report: `ARC_TESTNET_VERIFICATION_REPORT.md`

## Live x402 Verification

- Protected endpoint: `GET /api/x402/protected-proof`
- Authorization route: `POST /api/x402/authorize`
- Provider: `circle-cli-x402`
- Scheme: `GatewayWalletBatched`
- Circle wallet: `0x1047d233336be340efd867db02c8a466bcfaa357`
- Gateway payer: `0x0746cd1b1186ff3594c791959180784c12b98b79`
- Price: `0.000001 USDC`
- Chain: `eip155:5042002`
- Asset: `0x3600000000000000000000000000000000000000`
- Gateway deposit approval: `0x72c281d9a92469f5602649774fb7bb9fb099869c1263b6f5ecd50b87ae7342a6`
- Gateway deposit: `0xa0145d205be45363444a8e640df656efd69b5fed0cb95c3c1cbd849048e2c6bd`
- Payment ID: `circle-cli-x402:x402-proof-service:a998a577850d50cc`
- Settlement transaction: `367c87b1-d1d7-45bb-90d8-048cf943a1c8`
- Verified behavior: unpaid requests return `402`; fake payment headers return `402`; paid Circle CLI request returns `200` with protected proof data and persisted payment evidence.

ProoVra fails closed for unpaid x402 requests and persists verified x402 payment records before exposing protected proof data.

## Lepton Tooling Compliance

### ARC CLI

Installation command:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
```

The ARC CLI is part of the Lepton setup path for Arc testnet access, Arc documentation, repositories, and builder context. ProoVra uses the official Arc Testnet RPC and deployed `SettlementEscrow` contract for the verified settlement flow.

### Circle CLI

Installation command:

```bash
npm install -g @circle-fin/cli
```

The Circle CLI supports agent wallets, x402-compatible payments, and USDC workflows. ProoVra includes a Circle CLI x402 provider and verified paid x402 authorization evidence.

## What This Proves

The deployed `SettlementEscrow` contract accepted an escrow deposit, associated the escrow with a provider recipient, stored proof metadata, and released USDC only after proof approval.

The x402 protected endpoint rejects unpaid access with `402`, rejects fake payment headers, and returns protected proof data only after verified Circle CLI x402 authorization.

## Submission Status

- Public GitHub URL: `https://github.com/ArmaniBanks/proovra`
- Live Product URL: `https://proovra.vercel.app`
- Demo Video URL: pending recording
- Arc Testnet settlement evidence: complete
- Circle x402 evidence: complete
- Vercel KV persistence: complete
- Vercel Blob proof uploads: complete
- Receipt evidence: complete
- Under 3-minute demo video: pending recording

## Demo Recommendation

Show the product workflow in the app:

1. Register requester agent.
2. Create open task.
3. Connect provider wallet.
4. Accept task.
5. Fund escrow from requester wallet.
6. Submit provider proof.
7. Approve proof as requester.
8. Release payment.
9. Open the generated receipt.

Then show the ArcScan links, x402 evidence, and verification report as proof that the core settlement and authorization paths have been executed.
