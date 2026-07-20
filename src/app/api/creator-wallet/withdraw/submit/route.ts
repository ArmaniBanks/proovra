import { NextResponse } from "next/server";
import {
  addressToBytes32,
  isNonZeroWallet,
  type GatewayBurnIntent,
} from "@/lib/gateway-withdrawal";

export const runtime = "nodejs";

const GATEWAY_API_TESTNET = "https://gateway-api-testnet.circle.com/v1";

type SubmitBody = {
  creatorWallet?: unknown;
  burnIntent?: unknown;
  signature?: unknown;
};

function isGatewayBurnIntent(value: unknown): value is GatewayBurnIntent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GatewayBurnIntent>;
  return (
    typeof candidate.maxBlockHeight === "string" &&
    typeof candidate.maxFee === "string" &&
    Boolean(candidate.spec) &&
    typeof candidate.spec?.value === "string" &&
    typeof candidate.spec?.salt === "string"
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as SubmitBody;
  if (!isNonZeroWallet(body.creatorWallet)) {
    return NextResponse.json(
      { error: "A valid non-zero creator wallet is required." },
      { status: 400 }
    );
  }
  if (!isGatewayBurnIntent(body.burnIntent)) {
    return NextResponse.json(
      { error: "A valid Gateway burn intent is required." },
      { status: 400 }
    );
  }
  if (typeof body.signature !== "string" || !/^0x[a-fA-F0-9]+$/.test(body.signature)) {
    return NextResponse.json(
      { error: "A valid creator signature is required." },
      { status: 400 }
    );
  }
  const creatorBytes32 = addressToBytes32(body.creatorWallet);
  if (
    body.burnIntent.spec.sourceDepositor !== creatorBytes32 ||
    body.burnIntent.spec.sourceSigner !== creatorBytes32
  ) {
    return NextResponse.json(
      { error: "Gateway withdrawal must be signed by the creator wallet." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${GATEWAY_API_TESTNET}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          burnIntent: body.burnIntent,
          signature: body.signature,
        },
      ]),
    });
    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
      message?: string;
      attestation?: `0x${string}`;
      signature?: `0x${string}`;
      [key: string]: unknown;
    };
    if (!response.ok || result.success === false || result.error) {
      throw new Error(
        result.message || result.error || `Gateway API returned ${response.status}.`
      );
    }
    if (!result.attestation || !result.signature) {
      throw new Error("Gateway API did not return a mint attestation.");
    }

    return NextResponse.json({
      status: "attested",
      gateway: result,
      attestation: result.attestation,
      signature: result.signature,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gateway withdrawal submission failed.",
      },
      { status: 502 }
    );
  }
}
