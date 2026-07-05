import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CreatorContentService } from "@/services/creator-content.service";
import { CreatorProfileService } from "@/services/creator-profile.service";

export const runtime = "nodejs";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 60;

function normalizeLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function maskWallet(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function hostnameFromUrl(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  await db.ready();

  const url = new URL(req.url);
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const contents = CreatorContentService.getPublishedContent();
  const contentById = new Map(contents.map((content) => [content.id, content]));
  const accesses = CreatorContentService.getAccesses();

  const publishedEvents = contents.map((content) => ({
    id: `published-${content.id}`,
    type: "content_published" as const,
    title: content.title,
    description: content.description,
    creatorName: CreatorProfileService.getPublicName(
      content.creatorWallet,
      content.creatorName
    ),
    source: content.source,
    sourceUrl: content.sourceUrl ?? null,
    sourceDomain: hostnameFromUrl(content.sourceUrl),
    price: content.price,
    amount: null,
    currency: content.currency,
    paidAccesses: content.accessCount,
    totalEarned: content.totalEarned,
    agentWallet: null,
    contentId: content.id,
    occurredAt: content.createdAt.toISOString(),
  }));

  const paidEvents = accesses
    .map((access) => {
      const content = contentById.get(access.contentId);
      if (!content) return null;
      return {
        id: `paid-${access.id}`,
        type: "agent_paid_access" as const,
        title: content.title,
        description: `Agent paid to access ${content.source.toUpperCase()} content.`,
        creatorName: CreatorProfileService.getPublicName(
          content.creatorWallet,
          content.creatorName
        ),
        source: content.source,
        sourceUrl: content.sourceUrl ?? null,
        sourceDomain: hostnameFromUrl(content.sourceUrl),
        price: content.price,
        amount: access.amount,
        currency: access.currency,
        paidAccesses: content.accessCount,
        totalEarned: content.totalEarned,
        agentWallet: maskWallet(access.agentWallet),
        contentId: content.id,
        occurredAt: access.accessedAt.toISOString(),
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event));

  const events = [...publishedEvents, ...paidEvents]
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    )
    .slice(0, limit);

  return NextResponse.json(
    {
      events,
      summary: {
        publishedCount: contents.length,
        paidAccessCount: accesses.length,
        totalEarned: accesses.reduce((sum, access) => sum + access.amount, 0),
        activeCreators: new Set(contents.map((content) => content.creatorWallet))
          .size,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
