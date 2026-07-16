<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes; APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ProoVra Developer Notes

ProoVra is focused on creator-owned content monetization for AI agents.

Current product workflow:

- Creators sign in, receive/manage an embedded Arc wallet, and save a public creator profile.
- Creators publish manual content or import public RSS content they control.
- RSS content requires ownership verification before monetization.
- ProoVra exposes selected resources through x402-gated JSON endpoints.
- Agents discover resources, receive `402 Payment Required`, pay through Circle Gateway x402 on Arc Testnet, and receive authorized JSON content.
- ProoVra records paid access receipts, creator net earnings, and the platform fee ledger.
