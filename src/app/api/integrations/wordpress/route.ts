import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WordPressConnectorService } from "@/services/wordpress-connector.service";

type MonetizeBody = {
  creatorWallet?: unknown;
  creatorName?: unknown;
  itemId?: unknown;
  price?: unknown;
};

export async function GET(req: Request) {
  await db.ready();
  const url = new URL(req.url);
  const creatorWallet = url.searchParams.get("creatorWallet");

  if (!creatorWallet || !/^0x[a-fA-F0-9]{40}$/.test(creatorWallet)) {
    return NextResponse.json(
      { error: "A valid creatorWallet query parameter is required." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    connection:
      WordPressConnectorService.getSafeConnectionForWallet(creatorWallet),
  });
}

export async function POST(req: Request) {
  await db.ready();
  const body = (await req.json()) as MonetizeBody;

  if (
    typeof body.creatorWallet !== "string" ||
    typeof body.creatorName !== "string" ||
    typeof body.itemId !== "string" ||
    typeof body.price !== "number"
  ) {
    return NextResponse.json(
      { error: "creatorWallet, creatorName, itemId, and numeric price are required." },
      { status: 400 }
    );
  }

  try {
    const content = WordPressConnectorService.monetizeImportedPost({
      creatorWallet: body.creatorWallet,
      creatorName: body.creatorName,
      itemId: body.itemId,
      price: body.price,
    });
    await db.flush();
    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "WordPress monetization failed." },
      { status: 400 }
    );
  }
}
