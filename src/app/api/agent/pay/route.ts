import { NextResponse } from "next/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { db } from "@/lib/db";
import { CreatorContentService } from "@/services/creator-content.service";

export const runtime = "nodejs";

type AgentPayBody = {
  contentId?: unknown;
};

type PaidContentResponse = {
  content?: unknown;
  paymentId?: string;
  access?: unknown;
  x402Settlement?: {
    transaction?: string;
    network?: string;
    amount?: string;
    payTo?: string;
    payer?: string | null;
  };
  [key: string]: unknown;
};

const GATEWAY_AUTO_DEPOSIT_AMOUNT = "0.5";
const GATEWAY_AUTO_DEPOSIT_UNITS = BigInt(500_000);

function amountToBaseUnits(amount: number) {
  return BigInt(Math.max(1, Math.round(amount * 1_000_000)));
}

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
}

function getAgentPrivateKey() {
  const privateKey = process.env.PROOVRA_AGENT_PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error(
      "PROOVRA_AGENT_PRIVATE_KEY is required for real agent x402 payments."
    );
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("PROOVRA_AGENT_PRIVATE_KEY must be a valid EVM private key.");
  }
  return privateKey as `0x${string}`;
}

export async function POST(req: Request) {
  await db.ready();

  const body = (await req.json()) as AgentPayBody;
  if (typeof body.contentId !== "string") {
    return NextResponse.json(
      { error: "contentId is required." },
      { status: 400 }
    );
  }

  const content = CreatorContentService.getContentById(body.contentId);
  if (!content || content.status !== "published") {
    return NextResponse.json({ error: "Content not found." }, { status: 404 });
  }

  try {
    const client = new GatewayClient({
      chain: "arcTestnet",
      privateKey: getAgentPrivateKey(),
      ...(process.env.PROOVRA_AGENT_RPC_URL
        ? { rpcUrl: process.env.PROOVRA_AGENT_RPC_URL }
        : {}),
    });
    const balances = await client.getBalances();
    const amountRequired = amountToBaseUnits(content.price);
    let gatewayDeposit:
      | {
          amount: string;
          amountBaseUnits: string;
          approvalTxHash?: string;
          depositTxHash: string;
        }
      | undefined;

    if (balances.gateway.available < amountRequired) {
      if (balances.wallet.balance < GATEWAY_AUTO_DEPOSIT_UNITS) {
        return NextResponse.json(
          {
            error:
              "Agent wallet does not have enough Arc Testnet USDC to auto-deposit 0.5 USDC into Circle Gateway.",
          },
          { status: 402 }
        );
      }

      const deposit = await client.deposit(GATEWAY_AUTO_DEPOSIT_AMOUNT);
      gatewayDeposit = {
        amount: deposit.formattedAmount,
        amountBaseUnits: deposit.amount.toString(),
        approvalTxHash: deposit.approvalTxHash,
        depositTxHash: deposit.depositTxHash,
      };
    }

    const accessUrl = `${getBaseUrl(req)}/api/creator-content/${content.id}/access`;
    const result = await client.pay<PaidContentResponse>(accessUrl);

    return NextResponse.json({
      ...result.data,
      agentPayment: {
        payerWallet: client.address,
        chain: client.chainName,
        amountBaseUnits: result.amount.toString(),
        amount: result.formattedAmount,
        transaction: result.transaction,
        payTo: result.data.x402Settlement?.payTo ?? content.creatorWallet,
        status: result.status,
        gatewayDeposit: gatewayDeposit ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Real agent x402 payment failed.",
      },
      { status: 502 }
    );
  }
}
