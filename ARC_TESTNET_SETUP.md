# Arc Testnet Setup

This guide prepares ProoVra for one controlled Arc testnet settlement. Simulation mode remains the default and should remain the fallback until real testnet settlement has been verified end to end.

Do not use mainnet credentials, production wallets, or production funds for this setup.

## Required Environment Variables

```env
PROOVRA_SETTLEMENT_PROVIDER=arc-testnet
ARC_TESTNET_RPC_URL=https://...
ARC_TESTNET_SETTLEMENT_RAW_TX=0x...
```

Use `ARC_TESTNET_SETTLEMENT_RAW_TX` for the first real test because most public RPC endpoints do not support unlocked account signing.

Alternative transaction mode:

```env
PROOVRA_SETTLEMENT_PROVIDER=arc-testnet
ARC_TESTNET_RPC_URL=https://...
ARC_TESTNET_FROM_ADDRESS=0x...
ARC_TESTNET_SETTLEMENT_CONTRACT_ADDRESS=0x...
ARC_TESTNET_SETTLEMENT_CALLDATA=0x...
ARC_TESTNET_SETTLEMENT_VALUE_WEI=0x0
```

Optional:

```env
ARC_TESTNET_CONFIRMATION_TARGET=1
ARC_TESTNET_RECEIPT_POLL_ATTEMPTS=20
ARC_TESTNET_RECEIPT_POLL_INTERVAL_MS=3000
PROOVRA_DB_PATH=data/proovra-db.json
```

## Get The Official Arc RPC

Install the Arc CLI when preparing for live testnet work:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
```

Use the Arc CLI or official Arc/Circle documentation to obtain:

- Arc testnet RPC URL
- Chain ID
- Explorer URL
- Faucet URL
- Supported transaction format
- Any required API key or account access

Do not copy RPC URLs from unofficial sources. If the official RPC is not available, keep `PROOVRA_SETTLEMENT_PROVIDER=simulation`.

## Get Testnet Funds

1. Create a dedicated Arc testnet wallet.
2. Confirm the wallet address.
3. Use the official Arc testnet faucet from Arc CLI/docs.
4. Request only the minimum test funds needed.
5. Confirm the balance through Arc CLI, wallet tooling, or RPC.

Never fund a test wallet with mainnet assets.

## Deploy A Minimal Settlement Contract

The first contract should be minimal and testnet-only:

- create/fund escrow
- release after proof verification
- refund failed or expired settlement
- emit events for funded, released, and refunded states

Deployment flow:

1. Compile the contract locally.
2. Select the Arc testnet RPC and chain ID.
3. Deploy with a dedicated testnet deployer wallet.
4. Save the deployed address:

```env
ARC_TESTNET_SETTLEMENT_CONTRACT_ADDRESS=0x...
```

5. Record:

- deployer address
- deployment transaction hash
- contract address
- ABI
- constructor args
- compiler version
- chain ID

## Generate A Signed Raw Transaction

Recommended first-test path:

1. Encode the settlement contract call data using the deployed ABI.
2. Fetch nonce, gas estimate, fee data, and chain ID from Arc testnet RPC.
3. Build the transaction for the smallest possible test settlement.
4. Sign offline or through a trusted testnet signing tool.
5. Export the signed transaction:

```env
ARC_TESTNET_SETTLEMENT_RAW_TX=0x...
```

6. Use the signed raw transaction once.
7. Remove or rotate it immediately after testing.

Do not store private keys in `.env` files committed to the project.

## Test One Real Settlement Safely

1. Start from simulation mode and verify the app:

```env
PROOVRA_SETTLEMENT_PROVIDER=simulation
```

2. Run checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

3. Use a temporary database for the first real test:

```env
PROOVRA_DB_PATH=/tmp/proovra-arc-first-settlement.json
```

4. Enable Arc testnet mode:

```env
PROOVRA_SETTLEMENT_PROVIDER=arc-testnet
ARC_TESTNET_RPC_URL=https://...
ARC_TESTNET_SETTLEMENT_RAW_TX=0x...
```

5. Execute only one settlement.
6. Confirm:

- transaction hash is returned
- transaction hash appears in the official Arc explorer
- RPC returns a transaction receipt
- receipt has a real block number
- confirmation count comes from the network
- settlement metadata persists after restart
- existing receipts page still renders

Stop after the first successful settlement and review logs/metadata before continuing.

## Switch Back To Simulation

If anything fails, immediately switch back:

```env
PROOVRA_SETTLEMENT_PROVIDER=simulation
```

Then restart the app.

Optional cleanup:

```env
PROOVRA_DB_PATH=data/proovra-db.json
```

Keep the failed test database file for debugging unless it contains sensitive data. Do not retry with the same signed raw transaction unless you have confirmed it is still valid and has not already been submitted.
