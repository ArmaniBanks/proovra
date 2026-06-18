import { NextResponse } from "next/server";
import { WalletService } from "@/services/wallet.service";

type CreateWalletBody = {
  agentId?: unknown;
};

export async function GET() {
  return NextResponse.json({
    wallets: WalletService.getAllWallets(),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateWalletBody;

    if (typeof body.agentId !== "string" || !body.agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const wallet = await WalletService.createAgentWallet(body.agentId);
    return NextResponse.json({ wallet });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Agent wallet creation failed",
      },
      { status: 500 }
    );
  }
}
