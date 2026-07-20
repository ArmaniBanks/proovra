import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  createArcGatewayBurnIntent,
  createGatewayWithdrawalTypedData,
  isNonZeroWallet,
  MIN_GATEWAY_WITHDRAWAL_AMOUNT,
  parseUsdcUnits,
} from "@/lib/gateway-withdrawal";

export const runtime = "nodejs";

type PrepareBody = {
  creatorWallet?: unknown;
  recipient?: unknown;
  amount?: unknown;
};

function getAgentPrivateKey() {
  const privateKey = process.env.PROOVRA_AGENT_PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error(
      "PROOVRA_AGENT_PRIVATE_KEY is required to check Gateway balances."
    );
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("PROOVRA_AGENT_PRIVATE_KEY must be a valid EVM private key.");
  }
  return privateKey as `0x${string}`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as PrepareBody;
  if (!isNonZeroWallet(body.creatorWallet) || !isNonZeroWallet(body.recipient)) {
    return NextResponse.json(
      { error: "Valid non-zero creatorWallet and recipient addresses are required." },
      { status: 400 }
    );
  }
  if (typeof body.amount !== "string") {
    return NextResponse.json(
      { error: "A valid USDC amount is required." },
      { status: 400 }
    );
  }

  try {
    const amountBaseUnits = parseUsdcUnits(body.amount);
    const minimumBaseUnits = parseUsdcUnits(MIN_GATEWAY_WITHDRAWAL_AMOUNT);
    if (amountBaseUnits < minimumBaseUnits) {
      return NextResponse.json(
        {
          error: `Minimum Gateway withdrawal is ${MIN_GATEWAY_WITHDRAWAL_AMOUNT} USDC to avoid outsized fees on tiny withdrawals.`,
        },
        { status: 400 }
      );
    }
    const client = new GatewayClient({
      chain: "arcTestnet",
      privateKey: getAgentPrivateKey(),
      ...(process.env.PROOVRA_AGENT_RPC_URL
        ? { rpcUrl: process.env.PROOVRA_AGENT_RPC_URL }
        : {}),
    });
    const balances = await client.getBalances(body.creatorWallet);
    if (balances.gateway.available < amountBaseUnits) {
      return NextResponse.json(
        {
          error: `Insufficient Gateway available balance. Have ${balances.gateway.formattedAvailable} USDC, need ${body.amount} USDC.`,
        },
        { status: 400 }
      );
    }

    const burnIntent = createArcGatewayBurnIntent({
      amount: body.amount,
      sourceDepositor: body.creatorWallet,
      recipient: body.recipient,
      salt: `0x${randomBytes(32).toString("hex")}`,
    });

    return NextResponse.json({
      chain: "arcTestnet",
      creatorWallet: body.creatorWallet,
      recipient: body.recipient,
      amount: body.amount,
      amountBaseUnits: amountBaseUnits.toString(),
      burnIntent,
      typedData: createGatewayWithdrawalTypedData(burnIntent),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gateway withdrawal preparation failed.",
      },
      { status: 502 }
    );
  }
}
