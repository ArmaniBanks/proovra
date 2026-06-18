import { db, type X402PaymentRecord } from "@/lib/db";
import type { PaymentAuthorizationResult } from "@/providers";

type X402PaymentInput = {
  settlementId: string;
  amount: number;
  payerWallet: string;
  payeeWallet: string;
  payment: PaymentAuthorizationResult;
};

export class X402PaymentService {
  static recordPayment(input: X402PaymentInput): X402PaymentRecord {
    if (input.payment.status !== 200 || !input.payment.settled) {
      throw new Error("x402 payment was not settled.");
    }
    if (!input.payment.receipt?.trim()) {
      throw new Error("x402 payment receipt is required.");
    }

    const record: X402PaymentRecord = {
      paymentId: input.payment.paymentId,
      settlementId: input.settlementId,
      amount: input.amount,
      payerWallet: input.payerWallet,
      payeeWallet: input.payeeWallet,
      provider: "circle-cli-x402",
      status: "settled",
      receipt: input.payment.receipt,
      createdAt: new Date(),
    };

    db.x402Payments.set(record.paymentId, record);
    return record;
  }

  static verifyPayment(paymentId: string): X402PaymentRecord | undefined {
    const record = db.x402Payments.get(paymentId);
    if (!record || record.status !== "settled") return undefined;

    record.verifiedAt = new Date();
    db.x402Payments.set(record.paymentId, record);
    return record;
  }
}
