# Arc Testnet Verification Report

This report records ProoVra's controlled proof-to-payment settlements on Arc Testnet, including the latest two-wallet requester-to-provider validation.

No mainnet funds were used. No UI, receipt rendering, x402 flow, or contract logic was changed for this verification.

## Summary

- Network: Arc Testnet
- Chain ID: `5042002`
- Explorer: `https://testnet.arcscan.app`
- Contract: `SettlementEscrow`
- Contract address: `0x38D7C4cC9C108D127923651ced41bdb123Dbc611`
- Verified flow: Approve -> CreateEscrow -> ReleaseAfterProof
- Escrow ID: `2`
- Final status: `Released`
- Result: Proof successfully triggered payment release.

## Settlement Data

- Requester: `0xabeC63339443cE52Be54FB12833C41B311Ea168c`
- Provider: `0x1047d233336BE340eFD867dB02C8a466bCFaA357`
- Token: `0x3600000000000000000000000000000000000000`
- Token symbol: `USDC`
- Amount: `1` base unit
- Display amount: `0.000001 USDC`
- Proof hash: `0xc90acad44222873dcaa4bec0f988ab5f07ca93e741ef794436a7bd0cfb32dce8`
- Expiry timestamp: `1781697914`

For the latest controlled settlement, separate requester and provider wallets were used to validate the agent-to-agent payment path.

## Transactions

| Step | Transaction | Block | Gas Used | ArcScan |
| --- | --- | ---: | ---: | --- |
| Approval | `0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59` | See ArcScan | See ArcScan | [View](https://testnet.arcscan.app/tx/0x78e3dc44dde9922987ba67609265832732aa8d07b1552273c9c8f960fb80bc59) |
| CreateEscrow | `0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130` | `47314879` | `193855` | [View](https://testnet.arcscan.app/tx/0x3bb97f592f0bed6327c230bfad3d318c004d4eef3c463cdaad457f5477eeb130) |
| ReleaseAfterProof | `0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036` | `47315094` | `98186` | [View](https://testnet.arcscan.app/tx/0xb6babd7af10ca13e095f5b77a6652e72c4dc16129e0ba848f33b92fac482e036) |

## Events Verified

- `Approval`: requester approved `SettlementEscrow` for `1` USDC base unit.
- `Transfer`: `1` USDC base unit moved from requester to escrow during `createEscrow`.
- `EscrowCreated`: escrow `2` was created with the planned requester, provider, token, amount, proof hash, and expiry.
- `Transfer`: `1` USDC base unit moved from escrow to provider during release.
- `EscrowReleased`: escrow `2` was released with the matching proof hash and amount.

## Final Onchain State

Read-only contract state after release:

```text
requester: 0xabeC63339443cE52Be54FB12833C41B311Ea168c
provider:  0x1047d233336BE340eFD867dB02C8a466bCFaA357
token:     0x3600000000000000000000000000000000000000
amount:    1
proofHash: 0xc90acad44222873dcaa4bec0f988ab5f07ca93e741ef794436a7bd0cfb32dce8
expiresAt: 1781697914
status:    1
```

`status: 1` maps to `Released` in `SettlementEscrow.EscrowStatus`.

## Conclusion

The proof-to-payment flow succeeded end to end on Arc Testnet. The requester approved USDC transfer, created an escrow with a proof hash, submitted the same proof hash to `releaseAfterProof`, and the contract released the escrowed USDC to a separate provider wallet.

Simulation mode remains the default fallback for demo stability.

## Live x402 Protected Proof Verification

ProoVra includes an x402-compatible protected proof endpoint and a Circle CLI x402 provider. A real paid Circle CLI request was executed through Circle Gateway on Arc Testnet and persisted by ProoVra.

- Protected endpoint: `http://127.0.0.1:3042/api/x402/protected-proof`
- Authorization route: `POST /api/x402/authorize`
- Provider: `circle-cli-x402`
- Scheme: `GatewayWalletBatched`
- Circle wallet: `0x1047d233336be340efd867db02c8a466bcfaa357`
- Gateway payer: `0x0746cd1b1186ff3594c791959180784c12b98b79`
- Price: `0.000001 USDC`
- Network: Arc Testnet, `eip155:5042002`
- Asset: `0x3600000000000000000000000000000000000000`
- Verified no-payment result: `402`
- Verified fake-payment result: `402`
- Verified paid result: `200`
- Persisted payment ID: `circle-cli-x402:x402-proof-service:a998a577850d50cc`
- Circle Gateway settlement transaction: `367c87b1-d1d7-45bb-90d8-048cf943a1c8`

Gateway funding evidence:

- Gateway deposit approval: `0x72c281d9a92469f5602649774fb7bb9fb099869c1263b6f5ecd50b87ae7342a6`
- Gateway deposit: `0xa0145d205be45363444a8e640df656efd69b5fed0cb95c3c1cbd849048e2c6bd`
- Gateway balance after deposit: `0.5 USDC`

Circle CLI inspect evidence:

```json
{
  "status": "payable",
  "httpStatus": 402,
  "price": {
    "amount": "1",
    "formatted": "$0.000001 USDC"
  },
  "chains": ["eip155:5042002"],
  "scheme": "GatewayWalletBatched",
  "seller": "0x1047d233336BE340eFD867dB02C8a466bCFaA357"
}
```

Circle CLI paid response:

```json
{
  "response": {
    "service": "ProoVra protected proof service",
    "status": "authorized",
    "network": "Arc Testnet",
    "chainId": 5042002,
    "paymentId": "circle-cli-x402:x402-proof-service:a998a577850d50cc",
    "x402Settlement": {
      "transaction": "367c87b1-d1d7-45bb-90d8-048cf943a1c8",
      "network": "eip155:5042002",
      "amount": "1",
      "payer": "0x0746cd1b1186ff3594c791959180784c12b98b79"
    }
  },
  "payment": {
    "amount": "$0.000001 USDC",
    "chain": "eip155:5042002",
    "scheme": "GatewayWalletBatched",
    "seller": "0x1047d233336BE340eFD867dB02C8a466bCFaA357"
  }
}
```

Before the x402 payment test, the Circle agent wallet was deployed on Arc Testnet with a zero-value self transfer:

- Transaction: `0xdf46b2ca8ed88d9d8fdb481023209627a8e3ef494c1b0e293ded4201d9596819`
- Block: `47318801`
- State: `COMPLETE`
