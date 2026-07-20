import {
  BatchFacilitatorClient,
  GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
} from "@circle-fin/x402-batching/server";

const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_NETWORK = `eip155:${ARC_TESTNET_CHAIN_ID}` as const;
export const DEFAULT_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export type GatewaySupportedKind = {
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

export type GatewayVerifyResult = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
};

export type GatewaySettleResult = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
};

export type GatewayPaymentRequirements = {
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

export type X402PaymentPayload = {
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

export function getGatewayClient() {
  gatewayClient ??= new BatchFacilitatorClient({
    url:
      process.env.PROOVRA_X402_GATEWAY_URL ||
      "https://gateway-api-testnet.circle.com",
  });
  return gatewayClient;
}

export function amountToBaseUnits(amount: number) {
  return String(Math.max(1, Math.round(amount * 1_000_000)));
}

export function isWallet(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function getPaymentId(req: Request) {
  return (
    req.headers.get("x-payment") ||
    req.headers.get("payment-id") ||
    req.headers.get("payment-signature") ||
    ""
  ).trim();
}

export function hasX402PaymentSignature(req: Request) {
  return Boolean(
    req.headers.get("payment-signature") ||
      req.headers.get("PAYMENT-SIGNATURE") ||
      req.headers.get("x-payment") ||
      req.headers.get("X-PAYMENT")
  );
}

export function decodePaymentSignature(req: Request): X402PaymentPayload {
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

export async function getGatewayPaymentKind() {
  const supported = await getGatewayClient().getSupported();
  return (supported.kinds as GatewaySupportedKind[]).find(
    (entry) => entry.network === ARC_TESTNET_NETWORK && entry.extra?.verifyingContract
  );
}

export function getUsdcAsset(kind?: GatewaySupportedKind) {
  return (
    kind?.extra?.assets?.find((asset) => asset.symbol === "USDC")?.address ||
    process.env.PROOVRA_X402_ASSET ||
    DEFAULT_USDC_ADDRESS
  );
}

export function createGatewayPaymentRequirement(input: {
  amount: number;
  payTo: string;
  resourceUrl: string;
  description: string;
  mimeType?: string;
  kind?: GatewaySupportedKind;
  extra?: Record<string, unknown>;
}): GatewayPaymentRequirements {
  const amount = amountToBaseUnits(input.amount);
  return {
    scheme: "exact",
    network: ARC_TESTNET_NETWORK,
    maxAmountRequired: amount,
    amount,
    asset: getUsdcAsset(input.kind),
    payTo: input.payTo,
    maxTimeoutSeconds: GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
    resource: input.resourceUrl,
    description: input.description,
    mimeType: input.mimeType ?? "application/json",
    extra: {
      name: input.kind?.extra?.verifyingContract ? "GatewayWalletBatched" : "USDC",
      version: input.kind?.extra?.verifyingContract ? "1" : "2",
      ...input.extra,
      ...(input.kind?.extra?.verifyingContract
        ? { verifyingContract: input.kind.extra.verifyingContract }
        : {}),
    },
  };
}
