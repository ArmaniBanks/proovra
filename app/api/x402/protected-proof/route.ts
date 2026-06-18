import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  BatchFacilitatorClient,
  GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
} from "@circle-fin/x402-batching/server";
import { db } from "@/lib/db";
import { X402PaymentService } from "@/services/x402-payment.service";

export const runtime = "nodejs";

const ARC_TESTNET_CHAIN_ID = 5042002;
const DEFAULT_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const DEFAULT_PROVIDER_ADDRESS = "0x1047d233336BE340eFD867dB02C8a466bCFaA357";
const DEFAULT_AMOUNT = "1";
const NETWORK = `eip155:${ARC_TESTNET_CHAIN_ID}` as const;

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

function getUsdcAsset(kind: GatewaySupportedKind) {
  return kind.extra?.assets?.find((asset) => asset.symbol === "USDC")?.address;
}

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function paymentRequirements(req: Request) {
  const url = new URL(req.url);
  const resourceUrl = `${getBaseUrl(req)}${url.pathname}`;
  const payTo = process.env.PROOVRA_X402_PAY_TO || DEFAULT_PROVIDER_ADDRESS;
  const asset = process.env.PROOVRA_X402_ASSET || DEFAULT_USDC_ADDRESS;
  const amount = process.env.PROOVRA_X402_AMOUNT_UNITS || DEFAULT_AMOUNT;

  return {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: `eip155:${ARC_TESTNET_CHAIN_ID}`,
        maxAmountRequired: amount,
        amount,
        asset,
        payTo,
        maxTimeoutSeconds: 300,
        resource: resourceUrl,
        description: "ProoVra proof verification payload for agent settlement",
        mimeType: "application/json",
        extra: {
          name: "USDC",
          version: "2",
        },
      },
    ],
    resource: {
      url: resourceUrl,
      description: "ProoVra proof verification payload for agent settlement",
      mimeType: "application/json",
    },
  };
}

async function gatewayPaymentRequirements(req: Request) {
  const supported = await getGatewayClient().getSupported();
  const kind = (supported.kinds as GatewaySupportedKind[]).find(
    (entry) => entry.network === NETWORK && entry.extra?.verifyingContract
  );
  const asset = kind ? getUsdcAsset(kind) : undefined;

  if (!kind || !asset) {
    throw new Error("Circle Gateway does not advertise Arc Testnet USDC.");
  }

  const url = new URL(req.url);
  const resourceUrl = `${getBaseUrl(req)}${url.pathname}`;
  const amount = process.env.PROOVRA_X402_AMOUNT_UNITS || DEFAULT_AMOUNT;

  const accepts: GatewayPaymentRequirements[] = [
    {
      scheme: "exact",
      network: NETWORK,
      maxAmountRequired: amount,
      amount,
      asset,
      payTo: process.env.PROOVRA_X402_PAY_TO || DEFAULT_PROVIDER_ADDRESS,
      maxTimeoutSeconds: GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
      resource: resourceUrl,
      description: "ProoVra proof verification payload for agent settlement",
      mimeType: "application/json",
      extra: {
        name: "GatewayWalletBatched",
        version: "1",
        verifyingContract: kind.extra?.verifyingContract,
      },
    },
  ];

  return {
    x402Version: 2,
    accepts,
    resource: {
      url: resourceUrl,
      description: "ProoVra proof verification payload for agent settlement",
      mimeType: "application/json",
    },
  };
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

function paymentRequiredResponse(
  requirements: Awaited<ReturnType<typeof gatewayPaymentRequirements>>
) {
  const encoded = Buffer.from(JSON.stringify(requirements)).toString("base64");

  return NextResponse.json(requirements, {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": encoded,
    },
  });
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

function buildProtectedPayload(
  req: Request,
  requirements: ReturnType<typeof paymentRequirements>,
  payment?: {
    paymentId: string;
    verifiedAt?: Date;
  }
) {
  return {
    service: "ProoVra protected proof service",
    status: "authorized",
    network: "Arc Testnet",
    chainId: ARC_TESTNET_CHAIN_ID,
    protectedResource: `${getBaseUrl(req)}${new URL(req.url).pathname}`,
    proofReference: process.env.PROOVRA_X402_PROOF_REFERENCE ?? null,
    proofHash: process.env.PROOVRA_X402_PROOF_HASH ?? null,
    requester: process.env.PROOVRA_X402_REQUESTER ?? null,
    provider: requirements.accepts[0].payTo,
    token: requirements.accepts[0].asset,
    amountBaseUnits: requirements.accepts[0].amount,
    paymentId: payment?.paymentId ?? null,
    verifiedAt: payment?.verifiedAt?.toISOString() ?? null,
    result:
      "Protected proof service metadata returned after x402 payment authorization.",
  };
}

export async function GET(req: Request) {
  await db.ready();
  const requirements = paymentRequirements(req);
  const paymentId = getPaymentId(req);

  if (!paymentId && !hasX402PaymentSignature(req)) {
    try {
      return paymentRequiredResponse(await gatewayPaymentRequirements(req));
    } catch (error) {
      return NextResponse.json(
        {
          ...requirements,
          error:
            error instanceof Error
              ? `x402 Gateway discovery unavailable: ${error.message}`
              : "x402 Gateway discovery unavailable.",
        },
        {
          status: 402,
          headers: {
            "payment-required": Buffer.from(
              JSON.stringify(requirements)
            ).toString("base64"),
          },
        }
      );
    }
  }

  if (hasX402PaymentSignature(req)) {
    try {
      const gatewayRequirements = await gatewayPaymentRequirements(req);
      const paymentPayload = decodePaymentSignature(req);
      const selectedRequirements = gatewayRequirements.accepts.find(
        (entry) => entry.network === paymentPayload.accepted?.network
      );

      if (!selectedRequirements) {
        throw new Error("Payment was signed for an unsupported network.");
      }

      const verifyResult = await getGatewayClient().verify(
        paymentPayload,
        selectedRequirements
      );

      if (!verifyResult.isValid) {
        return NextResponse.json(
          {
            ...gatewayRequirements,
            error: "Payment verification failed.",
            reason: verifyResult.invalidReason,
          },
          {
            status: 402,
            headers: {
              "PAYMENT-REQUIRED": Buffer.from(
                JSON.stringify(gatewayRequirements)
              ).toString("base64"),
            },
          }
        );
      }

      const settlement = await getGatewayClient().settle(
        paymentPayload,
        selectedRequirements
      );

      if (!settlement.success) {
        return NextResponse.json(
          {
            ...gatewayRequirements,
            error: "Payment settlement failed.",
            reason: settlement.errorReason,
          },
          {
            status: 402,
            headers: {
              "PAYMENT-REQUIRED": Buffer.from(
                JSON.stringify(gatewayRequirements)
              ).toString("base64"),
            },
          }
        );
      }

      const settlementId =
        new URL(req.url).searchParams.get("settlementId") ??
        "x402-proof-service";
      const digest = createHash("sha256")
        .update(
          JSON.stringify({
            transaction: settlement.transaction,
            payer: settlement.payer,
            network: settlement.network,
            amount: selectedRequirements.amount,
          })
        )
        .digest("hex")
        .slice(0, 16);
      const record = X402PaymentService.recordPayment({
        settlementId,
        amount: Number(selectedRequirements.amount) / 1_000_000,
        payerWallet: settlement.payer ?? verifyResult.payer ?? "unknown",
        payeeWallet: selectedRequirements.payTo,
        payment: {
          status: 200,
          paymentId: `circle-cli-x402:${settlementId}:${digest}`,
          amount: Number(selectedRequirements.amount) / 1_000_000,
          settled: true,
          receipt: JSON.stringify(settlement),
        },
      });
      await db.flush();
      const payload = buildProtectedPayload(req, requirements, record);
      const paymentResponse = Buffer.from(
        JSON.stringify({
          success: true,
          transaction: settlement.transaction,
          network: settlement.network,
          payer: settlement.payer ?? verifyResult.payer ?? "",
        })
      ).toString("base64");

      return NextResponse.json(
        {
          ...payload,
          x402Settlement: {
            transaction: settlement.transaction,
            network: settlement.network,
            amount: selectedRequirements.amount,
            payer: settlement.payer ?? verifyResult.payer ?? null,
          },
        },
        {
          headers: {
            "PAYMENT-RESPONSE": paymentResponse,
          },
        }
      );
    } catch (error) {
      return NextResponse.json(
        {
          ...requirements,
          error:
            error instanceof Error
              ? `Invalid or unverifiable x402 payment: ${error.message}`
              : "Invalid or unverifiable x402 payment.",
        },
        {
          status: 402,
          headers: {
            "payment-required": Buffer.from(
              JSON.stringify(requirements)
            ).toString("base64"),
          },
        }
      );
    }
  }

  if (!paymentId) {
    return NextResponse.json(requirements, {
      status: 402,
      headers: {
        "payment-required": Buffer.from(JSON.stringify(requirements)).toString(
          "base64"
        ),
      },
    });
  }

  const payment = X402PaymentService.verifyPayment(paymentId);

  if (!payment) {
    return NextResponse.json(
      {
        ...requirements,
        error: "A settled Circle CLI x402 payment record is required.",
      },
      {
        status: 402,
        headers: {
          "payment-required": Buffer.from(JSON.stringify(requirements)).toString(
            "base64"
          ),
        },
      }
    );
  }

  return NextResponse.json(
    buildProtectedPayload(req, requirements, payment),
    {
      headers: {
        "x-payment-response": Buffer.from(
          JSON.stringify({
            success: true,
            paymentId: payment.paymentId,
            network: `eip155:${ARC_TESTNET_CHAIN_ID}`,
            amount: String(payment.amount),
            payTo: requirements.accepts[0].payTo,
          })
        ).toString("base64"),
      },
    }
  );
}
