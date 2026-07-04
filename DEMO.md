# ProoVra Demo Notes

ProoVra demonstrates proof-gated settlement as a sidecar for existing digital work communities.

The in-app Demo page is a non-transactional walkthrough of the product sequence. Live Arc Testnet execution happens through the Tasks and Settlement pages with connected requester and provider wallets. The walkthrough does not claim that its displayed task or transaction evidence is a new live settlement.

## Primary Use Case

Open-source contributor payout:

GitHub issue or task -> contributor submits a PR or proof -> maintainer verifies completion -> ProoVra releases USDC -> receipt generated.

GitHub remains where the issue, pull request, commits, and review discussion live. ProoVra imports a public issue through GitHub's API, validates provider pull-request proof against the issue repository, and persists both upstream records with the payout task and receipt. It sits beside the workflow to provide escrow, explicit approval, payment release, and settlement evidence.

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

Use the walkthrough to explain the product experience:

1. A maintainer selects Open-source Contribution and imports an existing public GitHub issue URL.
2. The maintainer creates a proof-gated payout task in ProoVra.
3. A contributor accepts the task.
4. The maintainer funds escrow.
5. The contributor submits a PR link, commit hash, file, or other proof.
6. The maintainer reviews and verifies completion.
7. Payment is released only after approval.
8. A receipt is generated.

Use the Arc Testnet evidence to show that the core payment-release mechanism has been verified with a real deployed contract, real testnet transactions, and separate requester/provider wallets.

The same settlement sidecar can later attach to established surfaces such as Dework, Questbook, creator campaigns, service marketplaces, and AI agent task networks. These are future distribution surfaces, not current native integration claims.

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
