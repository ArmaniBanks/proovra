# ProoVra Deployment

ProoVra is a Next.js app with API routes for creator content, RSS import,
agent discovery, and real Circle Gateway x402 payments on Arc Testnet.

## Required Production Services

- Vercel or Railway for the app runtime.
- Upstash/Vercel KV-compatible REST storage for persistence.
- Privy app for creator email login and embedded wallets.
- Circle Gateway funded agent wallet for `/api/agent/pay`.

Do not deploy with local JSON persistence. Production requires:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

## Shared Environment Variables

Set these on Vercel and Railway:

```bash
NEXT_PUBLIC_APP_URL=https://your-production-domain
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id

KV_REST_API_URL=...
KV_REST_API_TOKEN=...
PROOVRA_KV_DB_KEY=proovra:database:v3

PROOVRA_X402_GATEWAY_URL=https://gateway-api-testnet.circle.com
PROOVRA_X402_ASSET=0x3600000000000000000000000000000000000000

PROOVRA_PROVIDER_MODE=live
PROOVRA_SETTLEMENT_PROVIDER=arc-testnet
PROOVRA_WALLET_PROVIDER=circle-cli
PROOVRA_PAYMENT_PROVIDER=circle-cli-x402

PROOVRA_AGENT_PRIVATE_KEY=0x...
PROOVRA_AGENT_RPC_URL=optional-arc-testnet-rpc-url
```

`PROOVRA_AGENT_PRIVATE_KEY` is server-only. Never prefix it with
`NEXT_PUBLIC_`, never commit it, and rotate it if it is exposed.

## Vercel

1. Import `ArmaniBanks/proovra`.
2. Framework preset: Next.js.
3. Build command: `npm run build`.
4. Add the environment variables above.
5. Attach Vercel KV, or manually set Upstash REST variables.
6. Deploy.

After deployment, set:

```bash
NEXT_PUBLIC_APP_URL=https://your-vercel-domain
```

Redeploy after changing it.

## Railway

Railway uses `railway.json`:

- Build: `npm run build`
- Start: `npm run start -- -p $PORT`
- Health check: `/`

Steps:

1. Create a Railway project from `ArmaniBanks/proovra`.
2. Add the same environment variables.
3. Use an external Upstash/Vercel KV-compatible Redis REST database, or point
   Railway at the same KV used by Vercel.
4. Deploy.

After deployment, set:

```bash
NEXT_PUBLIC_APP_URL=https://your-railway-domain
```

Redeploy after changing it.

## Real Agent Payments

The `/agents` page calls `/api/agent/pay`. That route uses Circle Gateway:

```ts
new GatewayClient({
  chain: "arcTestnet",
  privateKey: process.env.PROOVRA_AGENT_PRIVATE_KEY
})
```

The private key must belong to an agent wallet with Arc Testnet USDC deposited
or available in Circle Gateway. If Gateway balance is too low, `/api/agent/pay`
automatically deposits `0.5` USDC from that agent wallet into Circle Gateway,
then retries the x402 payment. If the wallet itself is unfunded, payment fails
instead of falling back to a simulated payment.
