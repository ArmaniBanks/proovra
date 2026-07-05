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
- Login: Privy email authentication for creator accounts.
- Wallets: Privy embedded Ethereum wallets generated for creators and configured around Arc Testnet.
- Connector: verified RSS import fetches public feed items only after the creator proves ownership of the feed/domain.
- Persistence: local JSON in development, Vercel KV-compatible adapter in production.
- Content records: title, description, body, creator name, payout wallet, source type, source URL, price, status, access count, and earnings.
- Agent discovery: `GET /api/agent/discover` lists paid resource metadata and x402 access URLs without exposing full content bodies.
- Agent buyer console: `/agents` shows discovery, `402 Payment Required`, real Circle Gateway x402 payment on Arc Testnet, unlocked JSON content, and updated access counts.
- Paid endpoint: `GET /api/creator-content/[id]/access`.
- x402 behavior: unpaid agent requests receive `402 Payment Required`; valid x402 payments unlock the content response.
- Receipts: every settled access records payment ID, content ID, agent wallet, amount, and timestamp.

## Demo Script

1. Creator opens `/content`.
2. Creator verifies an RSS feed/domain or publishes a manual resource.
3. ProoVra lists the paid resource through `/api/agent/discover`.
4. Agent chooses a resource and requests its x402 access endpoint.
5. Agent receives `402 Payment Required`.
6. Agent signs/pays through Circle x402 on Arc Testnet.
7. ProoVra verifies/settles the payment and returns JSON content.
8. Dashboard updates paid access count, creator earnings, and access receipts.

## Positioning

> ProoVra lets creators turn their existing content into paid, agent-readable APIs. Agents pay USDC nanopayments through x402 before they can read, cite, summarize, or reuse the content.

This replaces the previous generic proof-escrow positioning with a narrower, clearer Lepton product: creator-owned content monetization for autonomous AI agents.
