import { createHash } from "node:crypto";
import type {
  PaymentAuthorizationInput,
  PaymentAuthorizationProvider,
  PaymentAuthorizationResult,
} from "./types";
import { getCircleCliCommand, runCli } from "./cli";

function getCircleChain() {
  return process.env.CIRCLE_CLI_CHAIN || "ARC-TESTNET";
}

function getServiceUrl() {
  const url = process.env.PROOVRA_X402_SERVICE_URL;
  if (!url) {
    throw new Error("PROOVRA_X402_SERVICE_URL is required for circle-cli-x402 payments.");
  }
  return url;
}

class CircleCliX402PaymentAuthorizationProvider
  implements PaymentAuthorizationProvider
{
  async authorizePayment(
    input: PaymentAuthorizationInput
  ): Promise<PaymentAuthorizationResult> {
    const serviceUrl = getServiceUrl();
    await runCli(getCircleCliCommand(), ["services", "inspect", serviceUrl], 60_000);

    if (process.env.PROOVRA_X402_EXECUTE !== "true") {
      throw new Error("Real x402 payment execution requires PROOVRA_X402_EXECUTE=true.");
    }

    const args = [
      "services",
      "pay",
      serviceUrl,
      "--address",
      input.payerWallet,
      "--chain",
      getCircleChain(),
    ];

    const payment = await runCli(getCircleCliCommand(), args, 60_000);
    const receipt = payment.stdout.trim() || payment.stderr.trim();
    if (!receipt) {
      throw new Error("Circle CLI x402 payment did not return payment evidence.");
    }
    const digest = createHash("sha256").update(receipt).digest("hex").slice(0, 16);
    const paymentId = `circle-cli-x402:${input.settlementId}:${digest}`;

    return {
      status: 200,
      paymentId,
      amount: input.amount,
      settled: true,
      receipt,
    };
  }

  async verifyPayment(paymentId: string): Promise<boolean> {
    return process.env.PROOVRA_X402_EXECUTE === "true" && paymentId.startsWith("circle-cli-x402:");
  }
}

export function createCircleCliX402PaymentAuthorizationProvider(): PaymentAuthorizationProvider {
  return new CircleCliX402PaymentAuthorizationProvider();
}
