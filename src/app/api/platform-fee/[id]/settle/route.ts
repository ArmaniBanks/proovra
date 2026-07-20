import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTreasuryConfig } from "@/lib/revenue";
import {
  createGatewayPaymentRequirement,
  decodePaymentSignature,
  getBaseUrl,
  getGatewayClient,
  getGatewayPaymentKind,
  hasX402PaymentSignature,
  isWallet,
  type GatewaySettleResult,
  type GatewayVerifyResult,
} from "@/lib/x402-gateway";
import { CreatorContentService } from "@/services/creator-content.service";
import { X402PaymentService } from "@/services/x402-payment.service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function paymentRequirements(req: Request, contentId: string) {
  const content = CreatorContentService.getContentById(contentId);
  if (!content || content.status !== "published") {
    throw new Error("Content not found.");
  }

  const treasury = getTreasuryConfig();
  const payTo = treasury.wallet?.trim();
  if (!payTo || !isWallet(payTo)) {
    throw new Error("PROOVRA_TREASURY_WALLET is required for split settlement.");
  }

  const revenue = CreatorContentService.quoteRevenue(content.price);
  if (revenue.platformFee <= 0) {
    throw new Error("Platform fee is zero; no treasury settlement is required.");
  }

  const kind = await getGatewayPaymentKind();
  const resourceUrl = `${getBaseUrl(req)}${new URL(req.url).pathname}`;
  return {
    x402Version: 2,
    accepts: [
      createGatewayPaymentRequirement({
        amount: revenue.platformFee,
        payTo,
        resourceUrl,
        description: `ProoVra platform fee for ${content.title}`,
        kind,
        extra: {
          proovra: {
            contentId,
            grossAmount: revenue.grossAmount,
            platformFee: revenue.platformFee,
            creatorNetAmount: revenue.creatorNetAmount,
            platformFeeBps: revenue.platformFeeBps,
            settlementMode: "dual_x402_split",
            settlementLeg: "platform_fee",
          },
        },
      }),
    ],
    resource: {
      url: resourceUrl,
      description: `ProoVra platform-fee settlement for ${content.title}`,
      mimeType: "application/json",
    },
  };
}

function paymentRequiredResponse(
  requirements: Awaited<ReturnType<typeof paymentRequirements>>,
  error?: string
) {
  return NextResponse.json(error ? { ...requirements, error } : requirements, {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(requirements)).toString("base64"),
    },
  });
}

export async function GET(req: Request, context: RouteContext) {
  await db.ready();
  const { id } = await context.params;

  let requirements: Awaited<ReturnType<typeof paymentRequirements>>;
  try {
    requirements = await paymentRequirements(req, id);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fee settlement unavailable." },
      { status: 400 }
    );
  }

  if (!hasX402PaymentSignature(req)) {
    return paymentRequiredResponse(requirements);
  }

  try {
    const paymentPayload = decodePaymentSignature(req);
    const selectedRequirements = requirements.accepts.find(
      (entry) => entry.network === paymentPayload.accepted?.network
    );
    if (!selectedRequirements) {
      throw new Error("Payment was signed for an unsupported network.");
    }

    const verifyResult = (await getGatewayClient().verify(
      paymentPayload,
      selectedRequirements
    )) as GatewayVerifyResult;
    if (!verifyResult.isValid) {
      return paymentRequiredResponse(
        requirements,
        `Payment verification failed: ${
          verifyResult.invalidReason ?? "Circle Gateway rejected the payment authorization."
        }`
      );
    }

    const settlement = (await getGatewayClient().settle(
      paymentPayload,
      selectedRequirements
    )) as GatewaySettleResult;
    if (!settlement.success) {
      return paymentRequiredResponse(
        requirements,
        `Payment settlement failed: ${
          settlement.errorReason ?? "Circle Gateway could not settle the payment."
        }`
      );
    }

    const amount = Number(selectedRequirements.amount) / 1_000_000;
    const digest = createHash("sha256")
      .update(
        JSON.stringify({
          transaction: settlement.transaction,
          payer: settlement.payer,
          contentId: id,
          leg: "platform_fee",
        })
      )
      .digest("hex")
      .slice(0, 16);
    const record = X402PaymentService.recordPayment({
      settlementId: `platform-fee:${id}`,
      amount,
      payerWallet: settlement.payer ?? verifyResult.payer ?? "unknown",
      payeeWallet: selectedRequirements.payTo,
      payment: {
        status: 200,
        paymentId: `platform-fee:${id}:${digest}`,
        amount,
        settled: true,
        receipt: JSON.stringify(settlement),
      },
    });
    await db.flush();

    return NextResponse.json({
      service: "ProoVra platform fee settlement",
      status: "settled",
      paymentId: record.paymentId,
      contentId: id,
      amount,
      currency: "USDC",
      payTo: selectedRequirements.payTo,
      payer: settlement.payer ?? verifyResult.payer ?? null,
      transaction: settlement.transaction,
      network: settlement.network,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Invalid or unverifiable x402 platform-fee payment: ${error.message}`
            : "Invalid or unverifiable x402 platform-fee payment.",
      },
      { status: 402 }
    );
  }
}
