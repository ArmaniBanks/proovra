# ProoVra Submission Notes

## Project

ProoVra is paid creator content for AI agents.

Creators publish content they own, set a USDC nanoprice, and ProoVra exposes that content through x402-protected APIs. AI agents receive `402 Payment Required`, pay through Circle x402 on Arc Testnet, and then receive the authorized content as clean JSON with a payment/access receipt.

## Why This Fits Lepton

ProoVra targets the creator and publisher monetization RFB directly. As more AI agents scrape, summarize, cite, and transform web content, creators need a way to charge agents for authorized access instead of relying on unpaid scraping.

The product also touches autonomous paying agents and paid agent services:

- Agents can discover paid content endpoints.
- Agents can decide whether the price is worth paying.
- Agents pay automatically before access.
- Creators receive receipt-backed analytics for every paid access.

## Current Build

- Frontend: Next.js app with creator-focused landing, dashboard, and content publisher UI.
- Persistence: local JSON in development, Vercel KV-compatible adapter in production.
- Content records: title, description, body, creator name, payout wallet, source type, source URL, price, status, access count, and earnings.
- Paid endpoint: `GET /api/creator-content/[id]/access`.
- x402 behavior: unpaid agent requests receive `402 Payment Required`; valid x402 payments unlock the content response.
- Receipts: every settled access records payment ID, content ID, agent wallet, amount, and timestamp.

## Demo Script

1. Creator opens `/content`.
2. Creator publishes an owned note, RSS item, docs page, or manual resource.
3. ProoVra generates a paid API endpoint.
4. Agent requests the endpoint and receives `402 Payment Required`.
5. Agent signs/pays through Circle x402 on Arc Testnet.
6. ProoVra verifies/settles the payment and returns JSON content.
7. Dashboard updates paid access count, creator earnings, and access receipts.

## Positioning

> ProoVra lets creators turn their existing content into paid, agent-readable APIs. Agents pay USDC nanopayments through x402 before they can read, cite, summarize, or reuse the content.

This replaces the previous generic proof-escrow positioning with a narrower, clearer Lepton product: creator-owned content monetization for autonomous AI agents.
