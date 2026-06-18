import { NextResponse } from "next/server";
import { getProviders } from "@/providers";

export async function GET() {
  const providers = getProviders();
  const hasArcTransactionSource =
    Boolean(process.env.ARC_TESTNET_SETTLEMENT_RAW_TX) ||
    Boolean(process.env.ARC_TESTNET_CREATE_ESCROW_RAW_TX) ||
    Boolean(process.env.ARC_TESTNET_RELEASE_ESCROW_RAW_TX) ||
    (Boolean(process.env.ARC_TESTNET_FROM_ADDRESS) &&
      Boolean(
        process.env.ARC_TESTNET_SETTLEMENT_CONTRACT_ADDRESS ||
          process.env.ARC_TESTNET_TO_ADDRESS
      ));

  return NextResponse.json({
    mode: providers.mode,
    settlementMode: providers.settlementMode,
    walletMode: providers.walletMode,
    paymentAuthorizationMode: providers.paymentAuthorizationMode,
    settlementExecution: "wallet-signed",
    liveSettlementEnabled: true,
    arcTestnetRpcConfigured:
      providers.settlementMode === "arc-testnet" &&
      Boolean(process.env.ARC_TESTNET_RPC_URL) &&
      Boolean(process.env.ARC_TESTNET_SETTLEMENT_CONTRACT_ADDRESS) &&
      hasArcTransactionSource,
  });
}
