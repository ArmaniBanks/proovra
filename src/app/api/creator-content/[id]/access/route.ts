import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  BatchFacilitatorClient,
  GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
} from "@circle-fin/x402-batching/server";
import { db } from "@/lib/db";
import { CreatorContentService } from "@/services/creator-content.service";
import { X402PaymentService } from "@/services/x402-payment.service";

export const runtime = "nodejs";

const ARC_TESTNET_CHAIN_ID = 5042002;
const DEFAULT_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const DEFAULT_PROVIDER_ADDRESS = "0x1047d233336BE340eFD867dB02C8a466bCFaA357";
const NETWORK = `eip155:${ARC_TESTNET_CHAIN_ID}` as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GatewaySupportedKind = {
  x402Version: number;
  scheme: string;
  network: string;
  extra?: {
    verifyingContract?: string;
    assets?: Array<{
      symbol?: string;
      address?: string;
      decimals?: number;
    }>;
    [key: string]: unknown;
  };
};

type GatewayVerifyResult = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
};

type GatewaySettleResult = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
};

type GatewayPaymentRequirements = {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  resource: string;
  description: string;
  mimeType: string;
  extra: Record<string, unknown>;
};

type X402PaymentPayload = {
  x402Version: number;
  accepted?: GatewayPaymentRequirements;
  payload: Record<string, unknown>;
  resource?: {
    url: string;
    description: string;
    mimeType: string;
  };
  extensions?: Record<string, unknown>;
};

let gatewayClient: BatchFacilitatorClient | undefined;

function getGatewayClient() {
  gatewayClient ??= new BatchFacilitatorClient({
    url:
      process.env.PROOVRA_X402_GATEWAY_URL ||
      "https://gateway-api-testnet.circle.com",
  });
  return gatewayClient;
}

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function getUsdcAsset(kind: GatewaySupportedKind) {
  return kind.extra?.assets?.find((asset) => asset.symbol === "USDC")?.address;
}

function amountToBaseUnits(amount: number) {
  return String(Math.max(1, Math.round(amount * 1_000_000)));
}

function getPaymentId(req: Request) {
  return (
    req.headers.get("x-payment") ||
    req.headers.get("payment-id") ||
    req.headers.get("payment-signature") ||
    ""
  ).trim();
}

function hasX402PaymentSignature(req: Request) {
  return Boolean(
    req.headers.get("payment-signature") ||
      req.headers.get("PAYMENT-SIGNATURE") ||
      req.headers.get("x-payment") ||
      req.headers.get("X-PAYMENT")
  );
}

function decodePaymentSignature(req: Request): X402PaymentPayload {
  const header =
    req.headers.get("payment-signature") ||
    req.headers.get("PAYMENT-SIGNATURE") ||
    req.headers.get("x-payment") ||
    req.headers.get("X-PAYMENT");

  if (!header) {
    throw new Error("PAYMENT-SIGNATURE header is required.");
  }

  return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
}

async function paymentRequirements(req: Request, contentId: string) {
  const content = CreatorContentService.getContentById(contentId);
  if (!content) throw new Error("Content not found.");

  const supported = await getGatewayClient().getSupported();
  const kind = (supported.kinds as GatewaySupportedKind[]).find(
    (entry) => entry.network === NETWORK && entry.extra?.verifyingContract
  );
  const gatewayAsset = kind ? getUsdcAsset(kind) : undefined;
  const resourceUrl = `${getBaseUrl(req)}${new URL(req.url).pathname}`;
  const amount = amountToBaseUnits(content.price);

  const accepts: GatewayPaymentRequirements[] = [
    {
      scheme: "exact",
      network: NETWORK,
      maxAmountRequired: amount,
      amount,
      asset: gatewayAsset || process.env.PROOVRA_X402_ASSET || DEFAULT_USDC_ADDRESS,
      payTo: content.creatorWallet || process.env.PROOVRA_X402_PAY_TO || DEFAULT_PROVIDER_ADDRESS,
      maxTimeoutSeconds: GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
      resource: resourceUrl,
      description: `Paid agent access to ${content.title}`,
      mimeType: "application/json",
      extra: {
        name: kind?.extra?.verifyingContract ? "GatewayWalletBatched" : "USDC",
        version: kind?.extra?.verifyingContract ? "1" : "2",
        ...(kind?.extra?.verifyingContract
          ? { verifyingContract: kind.extra.verifyingContract }
          : {}),
      },
    },
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

  return {
    service: "ProoVra creator content API",
    status: "authorized",
    network: "Arc Testnet",
    content: {
      id: content.id,
      title: content.title,
      description: content.description,
      body: content.body,
      creatorName: content.creatorName,
      source: content.source,
      sourceUrl: content.sourceUrl ?? null,
    },
    license: {
      permittedUse: "Agent read, summarize, cite, or transform with receipt attribution.",
      paidAccessPrice: content.price,
      currency: content.currency,
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
        amount,
      });
      await db.flush();

      return NextResponse.json(
        {
          ...contentPayload(id, record.paymentId),
          access,
          x402Settlement: {
            transaction: settlement.transaction,
            network: settlement.network,
            amount: selectedRequirements.amount,
            payer: settlement.payer ?? verifyResult.payer ?? null,
          },
        },
        {
          headers: {
            "PAYMENT-RESPONSE": Buffer.from(
              JSON.stringify({
                success: true,
                transaction: settlement.transaction,
                network: settlement.network,
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
