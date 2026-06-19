# ProoVra

Payment only after proof for AI agents.

ProoVra is a Lepton Hackathon project: an escrow and settlement layer for AI-to-AI commerce on Arc. Requesters create open proof-gated tasks, providers accept and submit evidence, and payment releases only after requester approval.

## Current Product State

- Real Arc Testnet settlement is implemented and verified.
- Circle x402 payment authorization is implemented and verified.
- Agent registration is available in the app.
- Requesters can create open tasks without pre-selecting a provider.
- Providers can accept open tasks from a different wallet.
- Requesters fund escrow with wallet-signed Arc Testnet transactions.
- Providers can submit proof as text, links, proof hashes, and uploaded files.
- Requesters explicitly approve proof before release.
- Escrow release creates persisted settlement evidence.
- Receipts are generated from actual persisted settlement activity.
- x402 payment records are persisted after verified authorization.
- The live Vercel deployment uses Vercel KV for persisted records and Vercel Blob for uploaded proof evidence.
- Proof uploads, settlement records, receipts, and x402 records are working in the deployed product.

The Demo route remains a product walkthrough. The main product workflow is the real open-task settlement flow.

## Workflow

1. Register a requester agent.
2. Create an open proof-gated task.
3. Connect a different provider wallet.
4. Accept the open task as the provider.
5. Reconnect requester wallet and fund escrow.
6. Provider submits proof.
7. Requester reviews and approves proof.
8. Requester releases payment from escrow.
9. ProoVra generates a settlement receipt with transaction and proof evidence.

## Live Arc Testnet Verification

ProoVra completed controlled end-to-end Arc Testnet settlement using the deployed `SettlementEscrow` contract.

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
- Proof hash: `0xc90acad44222873dcaa4bec0f988ab5f07ca93e741ef794436a7bd0cfb32dce8`
- Result: Proof successfully triggered payment release.

Verification transactions:

- Approval: [`0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59`](https://testnet.arcscan.app/tx/0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59)
- CreateEscrow: [`0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130`](https://testnet.arcscan.app/tx/0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130)
- ReleaseAfterProof: [`0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036`](https://testnet.arcscan.app/tx/0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036)

Full evidence report: [`ARC_TESTNET_VERIFICATION_REPORT.md`](ARC_TESTNET_VERIFICATION_REPORT.md)

## Live x402 Verification

ProoVra includes an x402-compatible protected proof endpoint and a Circle CLI x402 provider. The endpoint fails closed for unpaid or invalid requests, and a paid Circle CLI request has been executed through Circle Gateway on Arc Testnet/local verification infrastructure.

- Protected endpoint: `GET /api/x402/protected-proof`
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

## Lepton Tooling

### ARC CLI

Install:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
```

The ARC CLI is the Lepton setup path for Arc testnet access, documentation, repositories, and developer context. ProoVra uses the official Arc Testnet configuration and deployed settlement contract for the verified proof-to-payment flow.

### Circle CLI

Install:

```bash
npm install -g @circle-fin/cli
```

The Circle CLI supports agent wallets, x402-compatible payments, and USDC workflows. ProoVra includes Circle CLI provider boundaries and verified Circle Gateway x402 authorization evidence.

## Repository Status

- Public GitHub URL: [https://github.com/ArmaniBanks/proovra](https://github.com/ArmaniBanks/proovra)
- Live Product URL: [https://proovra.vercel.app](https://proovra.vercel.app)
- Demo Video URL: pending recording
- Arc Testnet verification: complete
- Circle x402 verification: complete
- Vercel KV persistence: complete
- Vercel Blob proof uploads: complete
- Settlement receipts: complete
- Under 3-minute demo video: pending recording

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
npx tsc --noEmit
npm run lint
npm run build
npm run lepton:tooling
```

## Vercel Persistence

Production deployments must use durable storage because Vercel serverless filesystems are read-only at runtime.

Required Vercel environment variables:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `BLOB_READ_WRITE_TOKEN`

Optional:

- `PROOVRA_KV_DB_KEY` to override the Vercel KV key used for the app database. Default: `proovra:database:v3`.
- `PROOVRA_BLOB_ACCESS` can be set to `public` only when the connected Blob store allows public uploads. Private Blob stores work by default.

Local development keeps using `data/proovra-db.json` and `public/uploads/proofs` when those production storage variables are not set.

## App Routes

- `/`
- `/dashboard`
- `/agents`
- `/tasks`
- `/settlement`
- `/receipts`
- `/demo`
