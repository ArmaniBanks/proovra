import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createGatewayPaymentRequirement,
  decodePaymentSignature,
  getBaseUrl,
  getGatewayClient,
  getGatewayPaymentKind,
  getPaymentId,
  hasX402PaymentSignature,
  isWallet,
  type GatewayPaymentRequirements,
  type GatewaySettleResult,
  type GatewayVerifyResult,
} from "@/lib/x402-gateway";
import { CreatorContentService } from "@/services/creator-content.service";
import { CreatorProfileService } from "@/services/creator-profile.service";
import { X402PaymentService } from "@/services/x402-payment.service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getSplitSettlementMode(req: Request) {
  return new URL(req.url).searchParams.get("settlement") === "creator-net";
}

function getPlatformFeeProof(req: Request, contentId: string) {
  const paymentId = req.headers.get("x-proovra-platform-payment-id")?.trim();
  if (!paymentId) return null;
  const payment = X402PaymentService.verifyPayment(paymentId);
  if (!payment || payment.settlementId !== `platform-fee:${contentId}`) {
    throw new Error("Valid ProoVra platform-fee payment is required.");
  }
  return payment;
}

function getReceiptTransaction(receipt?: string) {
  if (!receipt) return undefined;
  try {
    const parsed = JSON.parse(receipt) as { transaction?: unknown };
    return typeof parsed.transaction === "string" ? parsed.transaction : undefined;
  } catch {
    return undefined;
  }
}

async function paymentRequirements(req: Request, contentId: string) {
  const content = CreatorContentService.getContentById(contentId);
  if (!content) throw new Error("Content not found.");

  const kind = await getGatewayPaymentKind();
  const resourceUrl = `${getBaseUrl(req)}${new URL(req.url).pathname}`;
  const revenue = CreatorContentService.quoteRevenue(content.price);
  const revenueConfig = CreatorContentService.getRevenueConfig();
  const payTo = content.creatorWallet.trim();
  if (!isWallet(payTo)) {
    throw new Error("Creator payout wallet is missing or invalid.");
  }
  const splitSettlement = getSplitSettlementMode(req);
  const amount = splitSettlement ? revenue.creatorNetAmount : content.price;

  const accepts: GatewayPaymentRequirements[] = [
    createGatewayPaymentRequirement({
      amount,
      payTo,
      resourceUrl,
      description: `Paid agent access to ${content.title}`,
      kind,
      extra: {
        proovra: {
          grossAmount: revenue.grossAmount,
          platformFee: revenue.platformFee,
          creatorNetAmount: revenue.creatorNetAmount,
          platformFeeBps: revenue.platformFeeBps,
          treasuryConfigured: revenueConfig.treasuryConfigured,
          settlementMode: splitSettlement
            ? "dual_x402_split"
            : revenueConfig.settlementMode,
          settlementLeg: splitSettlement ? "creator_net" : "creator_gross",
        },
      },
    }),
  ];

  return {
    x402Version: 2,
    accepts,
    resource: {
      url: resourceUrl,
      description: `ProoVra paid creator content: ${content.title}`,
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

function contentPayload(contentId: string, paymentId: string | null) {
  const content = CreatorContentService.getContentById(contentId);
  if (!content) throw new Error("Content not found.");
  const revenue = CreatorContentService.quoteRevenue(content.price);
  const revenueConfig = CreatorContentService.getRevenueConfig();

  return {
    service: "ProoVra creator content API",
    status: "authorized",
    network: "Arc Testnet",
    content: {
      id: content.id,
      title: content.title,
      description: content.description,
      body: content.body,
      creatorName: CreatorProfileService.getPublicName(
        content.creatorWallet,
        content.creatorName
      ),
      source: content.source,
      sourceUrl: content.sourceUrl ?? null,
    },
    license: {
      permittedUse: "Agent read, summarize, cite, or transform with receipt attribution.",
      paidAccessPrice: content.price,
      currency: content.currency,
    },
    economics: {
      grossAmount: revenue.grossAmount,
      creatorNetAmount: revenue.creatorNetAmount,
      platformFee: revenue.platformFee,
      platformFeeBps: revenue.platformFeeBps,
      platformFeePercent: revenueConfig.platformFeePercent,
      treasuryConfigured: revenueConfig.treasuryConfigured,
      settlementMode: revenueConfig.settlementMode,
    },
    paymentId,
  };
}

export async function GET(req: Request, context: RouteContext) {
  await db.ready();
  const { id } = await context.params;
  const content = CreatorContentService.getContentById(id);

  if (!content || content.status !== "published") {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const paymentId = getPaymentId(req);

  if (!paymentId && !hasX402PaymentSignature(req)) {
    try {
      return paymentRequiredResponse(await paymentRequirements(req, id));
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? `x402 Gateway discovery unavailable: ${error.message}`
              : "x402 Gateway discovery unavailable.",
        },
        { status: 500 }
      );
    }
  }

  if (hasX402PaymentSignature(req)) {
    try {
      const requirements = await paymentRequirements(req, id);
      const splitSettlement = getSplitSettlementMode(req);
      const platformFeeProof = splitSettlement ? getPlatformFeeProof(req, id) : null;
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

      const revenue = CreatorContentService.quoteRevenue(content.price);
      const amount = Number(selectedRequirements.amount) / 1_000_000;
      const digest = createHash("sha256")
        .update(
          JSON.stringify({
            transaction: settlement.transaction,
            payer: settlement.payer,
            contentId: id,
            leg: splitSettlement ? "creator_net" : "creator_gross",
          })
        )
        .digest("hex")
        .slice(0, 16);
      const record = X402PaymentService.recordPayment({
        settlementId: `content:${id}`,
        amount,
        payerWallet: settlement.payer ?? verifyResult.payer ?? "unknown",
        payeeWallet: selectedRequirements.payTo,
        payment: {
          status: 200,
          paymentId: `creator-content:${id}:${digest}`,
          amount,
          settled: true,
          receipt: JSON.stringify(settlement),
        },
      });
      const access = CreatorContentService.recordAccess({
        contentId: id,
        paymentId: record.paymentId,
        agentWallet: record.payerWallet,
        amount: splitSettlement ? content.price : amount,
        grossAmount: splitSettlement ? revenue.grossAmount : undefined,
        platformFee: splitSettlement ? revenue.platformFee : undefined,
        creatorNetAmount: splitSettlement ? revenue.creatorNetAmount : undefined,
        platformFeeBps: splitSettlement ? revenue.platformFeeBps : undefined,
        settlementMode: splitSettlement ? "dual_x402_split" : "creator_gross",
        creatorSettlementTx: settlement.transaction,
        platformFeePaymentId: platformFeeProof?.paymentId,
        platformFeeSettlementTx: getReceiptTransaction(platformFeeProof?.receipt),
        platformFeePayeeWallet: platformFeeProof?.payeeWallet,
        creatorFundsStatus: "gateway_balance",
      });
      const revenueConfig = CreatorContentService.getRevenueConfig();
      await db.flush();

      return NextResponse.json(
        {
          ...contentPayload(id, record.paymentId),
          access,
          x402Settlement: {
            transaction: settlement.transaction,
            network: settlement.network,
            amount: selectedRequirements.amount,
            payTo: selectedRequirements.payTo,
            payer: settlement.payer ?? verifyResult.payer ?? null,
            economics: {
              grossAmount: access.grossAmount ?? access.amount,
              creatorNetAmount: access.creatorNetAmount ?? access.amount,
              platformFee: access.platformFee ?? 0,
              platformFeeBps: access.platformFeeBps ?? revenueConfig.platformFeeBps,
              treasuryConfigured: revenueConfig.treasuryConfigured,
              settlementMode: access.settlementMode ?? revenueConfig.settlementMode,
              platformFeePaymentId: access.platformFeePaymentId ?? null,
              platformFeeSettlementTx: access.platformFeeSettlementTx ?? null,
              creatorFundsStatus: access.creatorFundsStatus,
            },
          },
        },
        {
          headers: {
            "PAYMENT-RESPONSE": Buffer.from(
              JSON.stringify({
                success: true,
                transaction: settlement.transaction,
                network: settlement.network,
                payTo: selectedRequirements.payTo,
                payer: settlement.payer ?? verifyResult.payer ?? "",
              })
            ).toString("base64"),
          },
        }
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? `Invalid or unverifiable x402 payment: ${error.message}`
              : "Invalid or unverifiable x402 payment.",
        },
        { status: 402 }
      );
    }
  }

  const payment = X402PaymentService.verifyPayment(paymentId);
  if (!payment || payment.settlementId !== `content:${id}`) {
    return paymentRequiredResponse(await paymentRequirements(req, id));
  }

  const access = CreatorContentService.recordAccess({
    contentId: id,
    paymentId: payment.paymentId,
    agentWallet: payment.payerWallet,
    amount: payment.amount,
  });
  await db.flush();

  return NextResponse.json({ ...contentPayload(id, payment.paymentId), access });
}
