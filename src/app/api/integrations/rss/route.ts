import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RssImportService } from "@/services/rss-import.service";

type RssRequestBody = {
  action?: unknown;
  creatorWallet?: unknown;
  creatorName?: unknown;
  feedUrl?: unknown;
  verificationUrl?: unknown;
  itemId?: unknown;
  price?: unknown;
  payoutWallet?: unknown;
};

function isWallet(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export async function GET(req: Request) {
  await db.ready();
  const url = new URL(req.url);
  const creatorWallet = url.searchParams.get("creatorWallet");

  if (!isWallet(creatorWallet)) {
    return NextResponse.json(
      { error: "A valid creatorWallet query parameter is required." },
      { status: 400 }
    );
  }

  const verifications = Array.from(db.creatorRssVerifications.values())
    .filter(
      (verification) =>
        verification.creatorWallet.toLowerCase() === creatorWallet.toLowerCase()
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return NextResponse.json({ verifications });
}

export async function POST(req: Request) {
  await db.ready();
  const body = (await req.json()) as RssRequestBody;

  if (!isWallet(body.creatorWallet) || typeof body.feedUrl !== "string") {
    return NextResponse.json(
      { error: "creatorWallet and feedUrl are required." },
      { status: 400 }
    );
  }

  try {
    if (body.action === "prepare") {
      const result = await RssImportService.prepareImport({
        creatorWallet: body.creatorWallet,
        feedUrl: body.feedUrl,
      });
      await db.flush();
      return NextResponse.json(result);
    }

    if (body.action === "verify") {
      const verification = await RssImportService.verifyOwnership({
        creatorWallet: body.creatorWallet,
        feedUrl: body.feedUrl,
        verificationUrl:
          typeof body.verificationUrl === "string"
            ? body.verificationUrl
            : undefined,
      });
      await db.flush();
      return NextResponse.json({ verification });
    }

    if (body.action === "monetize") {
      if (
        typeof body.creatorName !== "string" ||
        typeof body.itemId !== "string" ||
        typeof body.price !== "number" ||
        !isWallet(body.payoutWallet)
      ) {
        return NextResponse.json(
          {
            error:
              "creatorName, itemId, numeric price, and valid payoutWallet are required.",
          },
          { status: 400 }
        );
      }

      const content = await RssImportService.monetizeItem({
        creatorWallet: body.creatorWallet,
        creatorName: body.creatorName,
        feedUrl: body.feedUrl,
        itemId: body.itemId,
        price: body.price,
        payoutWallet: body.payoutWallet,
      });
      await db.flush();
      return NextResponse.json({ content }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid RSS action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RSS import failed." },
      { status: 400 }
    );
  }
}
