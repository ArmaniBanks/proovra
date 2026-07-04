import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CreatorContentService } from "@/services/creator-content.service";

type CreateContentBody = {
  title?: unknown;
  description?: unknown;
  body?: unknown;
  creatorName?: unknown;
  creatorWallet?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  price?: unknown;
};

export async function GET() {
  await db.ready();
  return NextResponse.json({
    contents: CreatorContentService.getContent(),
    accesses: CreatorContentService.getAccesses().slice(0, 25),
    summary: CreatorContentService.getSummary(),
  });
}

export async function POST(req: Request) {
  await db.ready();
  const body = (await req.json()) as CreateContentBody;

  if (
    typeof body.title !== "string" ||
    typeof body.description !== "string" ||
    typeof body.body !== "string" ||
    typeof body.creatorName !== "string" ||
    typeof body.creatorWallet !== "string" ||
    typeof body.source !== "string" ||
    typeof body.price !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          "title, description, body, creatorName, creatorWallet, source, and numeric price are required",
      },
      { status: 400 }
    );
  }

  if (body.source !== "manual") {
    return NextResponse.json(
      {
        error:
          "Direct content creation only supports manual content. Use a verified connector for RSS or platform imports.",
      },
      { status: 400 }
    );
  }

  try {
    const content = CreatorContentService.createContent({
      title: body.title,
      description: body.description,
      body: body.body,
      creatorName: body.creatorName,
      creatorWallet: body.creatorWallet,
      source: "manual",
      price: body.price,
    });
    await db.flush();
    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Content creation failed" },
      { status: 400 }
    );
  }
}
