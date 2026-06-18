# ProoVra Demo Notes

ProoVra demonstrates payment only after proof for AI agents.

The in-app demo remains simulation-first for reliability during judging and local development. Simulation mode keeps Dashboard, Agents, Tasks, Settlement, Receipts, and Demo stable without requiring wallet credentials or live network access.

## Live Arc Testnet Evidence

The project now includes proof that the settlement concept works on Arc Testnet, including a separate requester-wallet to provider-wallet settlement:

- Contract: `0x38D7C4cC9C108D127923651ced41bdb123Dbc611`
- Verified flow: Approve -> CreateEscrow -> ReleaseAfterProof
- Escrow ID: `2`
- Status: `Released`
- Amount: `0.000001 USDC`
- Requester: `0xabeC63339443cE52Be54FB12833C41B311Ea168c`
- Provider: `0x1047d233336BE340eFD867dB02C8a466bCFaA357`
- Result: Proof successfully triggered payment release.

Transactions:

- Approval: `https://testnet.arcscan.app/tx/0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59`
- CreateEscrow: `https://testnet.arcscan.app/tx/0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130`
- ReleaseAfterProof: `https://testnet.arcscan.app/tx/0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036`

Full report: `ARC_TESTNET_VERIFICATION_REPORT.md`

## Demo Positioning

Use the simulation UI to show the product experience:

1. A requester agent creates a task.
2. Funds are escrowed.
3. The provider agent submits work.
4. ProoVra verifies proof.
5. Payment is released only after proof.
6. A receipt is generated.

Use the Arc Testnet evidence to show that the core payment-release mechanism has been verified with a real deployed contract, real testnet transactions, and separate requester/provider wallets.

## Live x402 Verification

The project also includes an x402-compatible protected proof endpoint and verified paid access through Circle CLI and Circle Gateway:

- Endpoint: `http://127.0.0.1:3042/api/x402/protected-proof`
- ProoVra authorization route: `POST /api/x402/authorize`
- Circle CLI provider: `circle-cli-x402`
- Scheme: `GatewayWalletBatched`
- Price: `0.000001 USDC`
- Chain: `eip155:5042002`
- Wallet: `0x1047d233336be340efd867db02c8a466bcfaa357`
- Gateway payer: `0x0746cd1b1186ff3594c791959180784c12b98b79`
- Payment ID: `circle-cli-x402:x402-proof-service:a998a577850d50cc`
- Settlement transaction: `367c87b1-d1d7-45bb-90d8-048cf943a1c8`
- Verified behavior: unpaid requests return `402`; fake payment headers return `402`; paid Circle CLI request returns protected proof data.

Use this evidence to show that proof/service data is protected by a fail-closed x402-compatible route and can be unlocked by a real Circle CLI paid request.
