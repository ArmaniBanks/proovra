# Deployment Readiness

This report audits the current ProoVra repository for Arc Testnet contract deployment readiness.

No packages were installed. No deployment framework was added. No contracts were written. No application functionality or UI was changed.

## Current Deployment Tooling

The repository is currently a Next.js application with scripts for app development and validation only:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

There are no existing deployment scripts for Solidity contracts.

## Foundry Availability

Foundry is not available on the current PATH.

Checked commands:

```bash
where forge
where cast
```

Result:

- `forge`: not found
- `cast`: not found

## Hardhat Availability

Hardhat is not installed in the project.

Checked with:

```bash
node -e "try { console.log(require.resolve('hardhat')) } catch { console.log('missing') }"
```

Result:

- `hardhat`: missing

## Solidity Contracts Folder

No Solidity contracts folder currently exists.

The repository does not currently contain:

- `contracts/`
- `script/`
- `scripts/deploy*`
- `foundry.toml`
- `hardhat.config.*`
- Solidity source files

## EVM Client Dependencies

The project does not currently include contract deployment libraries.

Checked dependencies:

- `ethers`: missing
- `viem`: missing
- `solc`: missing

Current dependencies are limited to the Next.js app:

- `next`
- `react`
- `react-dom`
- `lucide-react`
- `clsx`

## Arc Testnet Configuration

Official Arc Testnet values provided for deployment planning:

```env
CHAIN_ID=5042002
RPC_URL=https://rpc.testnet.arc.network
EXPLORER=https://testnet.arcscan.app
```

The RPC endpoint was previously verified to return chain ID `0x4cef52`, which equals decimal `5042002`.

## Current Readiness Status

ProoVra is not yet ready to deploy a settlement contract directly from this repository.

Missing pieces:

- Solidity contract source
- contract compile tool
- deployment framework or deployment script
- testnet deployer private key
- funded Arc testnet deployer wallet
- contract verification workflow
- ABI artifact storage
- deployment address artifact storage

## Smallest Change Required To Support Deployment

The smallest practical path is to add a minimal Foundry setup because it can compile, deploy, sign, and verify Solidity contracts with relatively little project churn.

Recommended minimal additions in a future milestone:

```text
contracts/MinimalProoVraSettlement.sol
script/DeployMinimalProoVraSettlement.s.sol
foundry.toml
deployments/arc-testnet.json
```

Recommended environment variables:

```env
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_TESTNET_CHAIN_ID=5042002
ARC_TESTNET_EXPLORER=https://testnet.arcscan.app
ARC_TESTNET_DEPLOYER_PRIVATE_KEY=...
ARC_TESTNET_FROM_ADDRESS=...
```

Foundry is preferred for the smallest deployment-specific change because it avoids adding JavaScript deployment dependencies to the app runtime.

## Alternative Path

If the project prefers staying entirely in the Node ecosystem, use Hardhat or a small `viem` deployment script.

That path would require adding development dependencies such as:

- `hardhat` or `viem`
- `solc` or framework-managed Solidity compiler
- optional verification plugin/tooling

This is a larger dependency footprint than Foundry for this specific milestone.

## Recommended Path

1. Keep the current app unchanged.
2. Keep simulation mode as default.
3. Install Foundry outside this milestone only after approval.
4. Add a minimal settlement contract in a dedicated `contracts/` folder.
5. Add a Foundry deployment script.
6. Deploy to Arc Testnet using a funded testnet-only deployer.
7. Save deployment metadata to `deployments/arc-testnet.json`.
8. Use the deployed address to generate one signed raw settlement transaction.
9. Execute one real test settlement through the existing Arc provider.
10. Verify the transaction on `https://testnet.arcscan.app`.

## Do Not Do Yet

- Do not add mainnet support.
- Do not start x402 integration.
- Do not redesign receipts.
- Do not change the UI.
- Do not remove simulation mode.
- Do not commit private keys or signed transactions.
