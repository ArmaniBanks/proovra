// ============================================================
// ProoVra — x402 Integration Layer (Stub)
// Phase 1: Mock implementation
// Phase 3: Replace with live x402 protocol integration
// ============================================================

/**
 * x402 integration handles:
 * - Per-call payments (HTTP 402 Payment Required)
 * - Per-byte payments
 * - Service monetization
 *
 * Reference: https://github.com/circlefin/arc-nanopayments
 * Docs: https://developers.circle.com/gateway/nanopayments
 */

export interface X402PaymentRequest {
  endpoint: string;
  amount: number;
  currency: "USDC";
  paymentType: "per-call" | "per-byte" | "per-second";
  payerWallet: string;
  payeeWallet: string;
}

export interface X402PaymentResponse {
  status: 200 | 402;
  paymentId: string;
  amount: number;
  settled: boolean;
  receipt?: string;
}

// Stub functions — will be replaced with live x402 integration in Phase 3
export async function makePayment(): Promise<X402PaymentResponse> {
  throw new Error("Configure PROOVRA_PAYMENT_PROVIDER=circle-cli-x402 before x402 payment execution.");
}

export async function createPaywall(): Promise<void> {
  throw new Error("Configure the protected x402 service route before creating a paywall.");
}

export async function verifyPayment(): Promise<boolean> {
  throw new Error("Configure PROOVRA_PAYMENT_PROVIDER=circle-cli-x402 before x402 payment verification.");
}
