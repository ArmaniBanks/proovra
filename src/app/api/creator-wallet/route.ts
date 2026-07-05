import { NextResponse } from "next/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

export const runtime = "nodejs";

function isWallet(value: string | null): value is `0x${string}` {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function getAgentPrivateKey() {
  const privateKey = process.env.PROOVRA_AGENT_PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error(
      "PROOVRA_AGENT_PRIVATE_KEY is required to read Circle Gateway balances."
    );
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("PROOVRA_AGENT_PRIVATE_KEY must be a valid EVM private key.");
  }
  return privateKey as `0x${string}`;
}

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!isWallet(address)) {
    return NextResponse.json(
      { error: "A valid creator wallet address is required." },
      { status: 400 }
    );
  }

  try {
    const client = new GatewayClient({
      chain: "arcTestnet",
      privateKey: getAgentPrivateKey(),
      ...(process.env.PROOVRA_AGENT_RPC_URL
        ? { rpcUrl: process.env.PROOVRA_AGENT_RPC_URL }
        : {}),
    });
    const balances = await client.getBalances(address);
    return NextResponse.json(
      {
        address,
        chain: "arcTestnet",
        wallet: {
          balanceBaseUnits: balances.wallet.balance.toString(),
          formatted: balances.wallet.formatted,
        },
        gateway: {
          totalBaseUnits: balances.gateway.total.toString(),
          availableBaseUnits: balances.gateway.available.toString(),
          withdrawableBaseUnits: balances.gateway.withdrawable.toString(),
          withdrawingBaseUnits: balances.gateway.withdrawing.toString(),
          formattedTotal: balances.gateway.formattedTotal,
          formattedAvailable: balances.gateway.formattedAvailable,
          formattedWithdrawable: balances.gateway.formattedWithdrawable,
          formattedWithdrawing: balances.gateway.formattedWithdrawing,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Creator wallet balances unavailable.",
      },
      { status: 502 }
    );
  }
}
