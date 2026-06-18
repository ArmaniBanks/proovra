<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes; APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ProoVra Developer Notes

ProoVra is currently in Phase 2 simulation mode. Keep the current architecture and design language stable; do not start Arc, Circle, x402, wallet, or blockchain integrations during stabilization work.

Integration intent for Phase 3:

- Arc is the intended USDC settlement layer.
- Circle is the intended wallet and payment layer.
- x402 is planned for agent payment and request flows.
- Simulation mode must remain available as the fallback for demo stability.

Phase 3 CLI prerequisites:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
npm install -g @circle-fin/cli
```

The current app should continue to run from simulated backend routes until Phase 3 integration work begins.
