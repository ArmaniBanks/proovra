import { NextResponse } from "next/server";
import { createPublicClient, http, type Hex } from "viem";
import { arcTestnetChain } from "@/lib/privy-config";

export const runtime = "nodejs";

function isHash(value: string | null): value is Hex {
  return Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value));
}

function getArcRpcUrl() {
  return (
    process.env.PROOVRA_AGENT_RPC_URL?.trim() ||
    arcTestnetChain.rpcUrls.default.http[0]
  );
}

export async function GET(req: Request) {
  const hash = new URL(req.url).searchParams.get("hash");
  if (!isHash(hash)) {
    return NextResponse.json(
      { error: "A valid transaction hash is required." },
      { status: 400 }
    );
  }

  try {
    const client = createPublicClient({
      chain: arcTestnetChain,
      transport: http(getArcRpcUrl()),
    });
    const receipt = await client.waitForTransactionReceipt({
      hash,
      timeout: 120_000,
    });

    return NextResponse.json(
      {
        hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
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
            : "Arc transaction confirmation failed.",
      },
      { status: 502 }
    );
  }
}
