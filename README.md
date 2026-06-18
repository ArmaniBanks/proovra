# ProoVra

Payment only after proof for AI agents.

ProoVra is a Lepton Hackathon project that demonstrates an escrow and settlement layer for AI-to-AI commerce on Arc. The current application is the stabilized Phase 2 build: a Next.js UI backed by simulated API routes and deterministic demo data. A controlled Phase 3 Arc Testnet proof-to-payment settlement has also been verified without changing the default simulation flow.

## Current Status

- Phase 1 UI is implemented.
- Phase 2 simulation backend is implemented.
- Dashboard, Agents, Tasks, Settlement, Receipts, and Demo routes are expected to render from simulated data.
- Arc Testnet contract deployment, one controlled proof-to-payment settlement, and one two-wallet requester-to-provider settlement have been verified.
- Simulation mode remains the default application path.
- Arc Testnet settlement, Circle agent wallet readiness, and paid Circle CLI x402 authorization have been verified on testnet. Mainnet support has not started yet.

## Simulation Mode

The current app uses simulation mode for all data-driven flows. API routes return local simulated records for agents, tasks, settlements, receipts, and dashboard metrics.

Simulation mode is intentionally kept as the fallback for demo stability. Phase 3 integrations should preserve this fallback so the demo remains usable if a live service, wallet, network, or credential is unavailable.

## Intended Integration Roles

- Arc is the intended USDC settlement layer.
- Circle is the intended wallet and payment layer.
- x402 is used for protected proof/service authorization in the local ProoVra test flow.

Do not start live integrations in the Phase 2 stabilization build. Any Phase 3 work should connect Arc, Circle, and x402 behind the existing architecture while keeping simulation mode available.

## Live x402 Verification

ProoVra includes an x402-compatible protected proof endpoint and a Circle CLI x402 provider. The endpoint fails closed for unpaid or invalid requests, and a real Circle CLI paid request has been executed through Circle Gateway on Arc Testnet.

- Protected endpoint: `http://127.0.0.1:3042/api/x402/protected-proof`
- Authorization route: `POST /api/x402/authorize`
- Provider: `circle-cli-x402`
- Scheme: `GatewayWalletBatched`
- Circle wallet: `0x1047d233336be340efd867db02c8a466bcfaa357`
- Gateway payer: `0x0746cd1b1186ff3594c791959180784c12b98b79`
- Price: `0.000001 USDC`
- Network: Arc Testnet, `eip155:5042002`
- Asset: `0x3600000000000000000000000000000000000000`
- Gateway deposit approval: `0x72c281d9a92469f5602649774fb7bb9fb099869c1263b6f5ecd50b87ae7342a6`
- Gateway deposit: `0xa0145d205be45363444a8e640df656efd69b5fed0cb95c3c1cbd849048e2c6bd`
- x402 payment ID: `circle-cli-x402:x402-proof-service:a998a577850d50cc`
- x402 settlement transaction: `367c87b1-d1d7-45bb-90d8-048cf943a1c8`
- Verified behavior: unpaid request returns `402`; fake `x-payment: test` returns `402`; paid Circle CLI request returns `200` with protected proof data and persisted payment evidence.

## Live Arc Testnet Verification

ProoVra completed two controlled end-to-end Arc Testnet settlements using the deployed `SettlementEscrow` contract. The latest verification uses separate requester and provider wallets, proving the agent-to-agent settlement path.

- Contract: `0x38D7C4cC9C108D127923651ced41bdb123Dbc611`
- Verified flow: Approve -> CreateEscrow -> ReleaseAfterProof
- Escrow ID: `2`
- Status: `Released`
- Amount: `0.000001 USDC`
- Token: `0x3600000000000000000000000000000000000000`
- Requester: `0xabeC63339443cE52Be54FB12833C41B311Ea168c`
- Provider: `0x1047d233336BE340eFD867dB02C8a466bCFaA357`
- Proof hash: `0xc90acad44222873dcaa4bec0f988ab5f07ca93e741ef794436a7bd0cfb32dce8`
- Result: Proof successfully triggered payment release.

Verification transactions:

- Approval: [`0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59`](https://testnet.arcscan.app/tx/0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59)
- CreateEscrow: [`0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130`](https://testnet.arcscan.app/tx/0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130)
- ReleaseAfterProof: [`0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036`](https://testnet.arcscan.app/tx/0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036)

Full evidence report: [`ARC_TESTNET_VERIFICATION_REPORT.md`](ARC_TESTNET_VERIFICATION_REPORT.md)

## Phase 3 CLI Prerequisites

Install these tools only when preparing for Phase 3 integration work:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
npm install -g @circle-fin/cli
```

These commands install the Arc CLI and Circle CLI. They are documented here for developer readiness; they are not required to run the current simulation-mode app.

## Lepton Tooling Compliance

### ARC CLI

Install:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
```

The ARC CLI is required by the Lepton hackathon setup because it provides Arc testnet access, Arc documentation, repositories, and setup context for builders and coding agents.

For ProoVra, the ARC CLI requirement is documented for setup readiness and was used as the reference path for Arc docs/RPC/setup context. The verified live flow itself uses the deployed `SettlementEscrow` contract on Arc Testnet through the official Arc Testnet RPC.

### Circle CLI

Install:

```bash
npm install -g @circle-fin/cli
```

The Circle CLI is required by the Lepton hackathon setup because it supports agent wallets, x402-compatible payments, and USDC workflows from the command line.

For ProoVra, Circle agent wallet readiness and paid x402 authorization have been verified on Arc Testnet/local test infrastructure. The project does not claim mainnet Circle Wallet, Gateway, or production x402 execution.

### Honest Integration Status

- ProoVra currently uses a controlled Arc Testnet smart-contract settlement flow.
- The verified live flow is Arc Testnet USDC proof-to-payment settlement.
- Simulation mode remains the default for demo stability.
- Circle agent wallet readiness, Circle Gateway x402 authorization, and Arc Testnet settlement have live test evidence.

### Submission Checklist

- Public GitHub URL: TODO
- Live Product URL: TODO
- Demo Video URL: TODO
- ARC CLI documented: YES
- Circle CLI documented: YES
- Arc Testnet verification: YES
- Under 3-minute video required: TODO

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

Run quality checks before handing off changes:

```bash
npm run lint
npm run build
```

## Route Expectations

The stabilized Phase 2 app should render these routes successfully:

- `/dashboard`
- `/agents`
- `/tasks`
- `/settlement`
- `/receipts`
- `/demo`
