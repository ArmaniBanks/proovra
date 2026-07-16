# ProoVra

![Arc Testnet](https://img.shields.io/badge/Arc-Testnet-f5b000)
![Circle USDC](https://img.shields.io/badge/Circle-USDC-111111)
![x402](https://img.shields.io/badge/x402-paid%20content-111111)
![Next.js](https://img.shields.io/badge/Next.js-16-000000)

ProoVra turns creator-owned content into x402-protected APIs for AI agents.

Creators publish posts, docs, research notes, or feed items they own, set a USDC nanoprice, and ProoVra exposes each resource through a paid agent-readable endpoint. Agents receive `402 Payment Required`, authorize payment through Circle x402 on Arc Testnet, and then receive clean JSON content plus an access receipt.

## Lepton Fit

ProoVra is built for the creator and publisher monetization lane:

- Creators choose the content they want to monetize.
- Agents pay before reading, citing, summarizing, or reusing that content.
- x402 handles payment-required API access.
- Arc Testnet and USDC provide the settlement rail.
- ProoVra records creator earnings, paid accesses, and receipts.

## Core Flow

```text
Creator publishes owned content
-> ProoVra creates an x402-gated endpoint
-> Agent requests the endpoint
-> ProoVra returns 402 Payment Required
-> Agent pays USDC through Circle x402 on Arc
-> ProoVra returns authorized JSON content
-> Creator sees access and receipt analytics
```

## Revenue Model

ProoVra uses a transaction take-rate model. By default, the app records a 10%
platform fee on every paid agent access while creators keep 90% as net earnings.

Current implementation:

- Agent payments still settle through the existing x402 `payTo` flow.
- ProoVra records gross payment, creator net, platform fee, and receipt metadata.
- Dashboard, activity, content, discovery, and agent views show the fee split.
- Treasury wallet/email can be configured privately for reporting and future claim flows.

Important settlement note:

At the moment, ProoVra fees are tracked in the backend revenue ledger, but USDC
is not automatically moved into a ProoVra treasury account. Real treasury
settlement will come in an upcoming upgrade, likely through a settlement wallet,
post-settlement transfer, or provider-supported split flow once the live payout
path is finalized.

## Current Product Surface

- `/` - public landing page for paid creator content.
- `/dashboard` - creator monetization overview.
- `/content` - login-gated creator publishing flow for paid resources.
- `/agents` - agent buyer console for discovering and paying for gated content.
- `/api/agent/discover` - public agent discovery index for paid content metadata.
- `/api/agent/pay` - real Circle Gateway x402 buyer route for Arc Testnet agent payments.
- `/api/creator-content` - list/create creator content records.
- `/api/creator-content/[id]/access` - x402-gated paid content access endpoint.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run build
```

The production build should expose only the creator-content app and API routes.

## Agent Discovery

Agents start at `/api/agent/discover`. The endpoint returns titles, excerpts,
creator names, source URLs, prices, and x402 access URLs without exposing full
content bodies.

```bash
curl http://localhost:3000/api/agent/discover
curl "http://localhost:3000/api/agent/discover?source=rss&q=privacy&limit=10"
```

Agents then request a resource's `access.url`. Unpaid requests receive
`402 Payment Required`; paid requests return the authorized JSON body.

The `/agents` console pays through `/api/agent/pay`, which uses Circle Gateway
on Arc Testnet. Configure `PROOVRA_AGENT_PRIVATE_KEY` with a funded agent wallet
that has Gateway USDC available before calling it.

## Environment

Optional x402 configuration:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_APP_URL=http://localhost:3000
PROOVRA_X402_GATEWAY_URL=https://gateway-api-testnet.circle.com
PROOVRA_X402_ASSET=0x3600000000000000000000000000000000000000
PROOVRA_PROVIDER_MODE=live
PROOVRA_SETTLEMENT_PROVIDER=arc-testnet
PROOVRA_WALLET_PROVIDER=circle-cli
PROOVRA_PAYMENT_PROVIDER=circle-cli-x402
PROOVRA_AGENT_PRIVATE_KEY=0x-funded-agent-private-key
PROOVRA_AGENT_RPC_URL=optional-arc-testnet-rpc-url
PROOVRA_PLATFORM_FEE_BPS=1000
PROOVRA_TREASURY_WALLET=0x-your-proovra-treasury-wallet
PROOVRA_TREASURY_EMAIL=treasury@example.com
```

Privy email login automatically provisions embedded Ethereum wallets for creators and defaults the app wallet context to Arc Testnet. Creator payout wallets are stored per content record. Local development persists records in `data/proovra-db.json`; production can use Vercel KV through the existing database adapter.

The first real content connector is verified RSS import. Creators paste a public RSS feed, prove ownership with a ProoVra verification code on the feed/domain, then select feed items to monetize without allowing arbitrary third-party URLs.
