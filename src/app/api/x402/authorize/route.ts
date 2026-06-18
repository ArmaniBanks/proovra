import { NextResponse } from "next/server";
import { getProviders } from "@/providers";
import { X402PaymentService } from "@/services/x402-payment.service";

type AuthorizeBody = {
  settlementId?: unknown;
  amount?: unknown;
  payerWallet?: unknown;
  payeeWallet?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AuthorizeBody;
    if (
      typeof body.settlementId !== "string" ||
      typeof body.amount !== "number" ||
      typeof body.payerWallet !== "string" ||
      typeof body.payeeWallet !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "settlementId, amount, payerWallet, and payeeWallet are required",
        },
        { status: 400 }
      );
    }

    const providers = getProviders();
    const payment = await providers.paymentAuthorization.authorizePayment({
      settlementId: body.settlementId,
      amount: body.amount,
      payerWallet: body.payerWallet,
      payeeWallet: body.payeeWallet,
    });
    const record = X402PaymentService.recordPayment({
      settlementId: body.settlementId,
      amount: body.amount,
      payerWallet: body.payerWallet,
      payeeWallet: body.payeeWallet,
      payment,
    });

    return NextResponse.json({ payment, x402Payment: record });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "x402 payment authorization failed",
      },
      { status: 500 }
    );
  }
}
