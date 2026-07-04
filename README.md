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

## Current Product Surface

- `/` - public landing page for paid creator content.
- `/dashboard` - creator monetization overview.
- `/content` - create paid resources and copy agent API endpoints.
- `/api/creator-content` - list/create creator content records.
- `/api/creator-content/[id]/access` - x402-gated paid content access endpoint.

The old proof escrow task, agents, receipts, and settlement pages/routes have been removed from the deployed product surface so ProoVra now leads with creator content monetization.

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

## Environment

Optional x402 configuration:

```bash
PROOVRA_X402_GATEWAY_URL=https://gateway-api-testnet.circle.com
PROOVRA_X402_ASSET=0x3600000000000000000000000000000000000000
```

Creator payout wallets are stored per content record. Local development persists records in `data/proovra-db.json`; production can use Vercel KV through the existing database adapter.
