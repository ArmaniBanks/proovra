import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CreatorContentService } from "@/services/creator-content.service";
import { CreatorProfileService } from "@/services/creator-profile.service";
import type { CreatorContentSource } from "@/lib/mock-data";

export const runtime = "nodejs";

const ARC_TESTNET_CHAIN_ID = 5042002;
const NETWORK = `eip155:${ARC_TESTNET_CHAIN_ID}`;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 25;

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function toBaseUnits(amount: number) {
  return String(Math.max(1, Math.round(amount * 1_000_000)));
}

function normalizeLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function normalizeSource(value: string | null): CreatorContentSource | null {
  if (value === "manual" || value === "rss") return value;
  return null;
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
  const baseUrl = getBaseUrl(req);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const source = normalizeSource(url.searchParams.get("source"));
  const limit = normalizeLimit(url.searchParams.get("limit"));

  const resources = CreatorContentService.getPublishedContent()
    .filter((content) => !source || content.source === source)
    .filter((content) => {
      if (!query) return true;
      const publicName = CreatorProfileService.getPublicName(
        content.creatorWallet,
        content.creatorName
      );
      return [content.title, content.description, publicName, content.sourceUrl]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    })
    .slice(0, limit)
    .map((content) => {
      const accessUrl = `${baseUrl}/api/creator-content/${content.id}/access`;
      return {
        id: content.id,
        title: content.title,
        excerpt: content.description,
        creatorName: CreatorProfileService.getPublicName(
          content.creatorWallet,
          content.creatorName
        ),
        source: content.source,
        sourceUrl: content.sourceUrl ?? null,
        sourceDomain: hostnameFromUrl(content.sourceUrl),
        pricing: {
          amount: content.price,
          amountBaseUnits: toBaseUnits(content.price),
          currency: content.currency,
          network: NETWORK,
        },
        access: {
          method: "GET",
          url: accessUrl,
          protocol: "x402",
          unpaidStatus: 402,
          paymentHeaders: ["x-payment", "payment-signature"],
        },
        stats: {
          paidAccesses: content.accessCount,
          totalEarned: content.totalEarned,
        },
        updatedAt: content.updatedAt.toISOString(),
      };
    });

  return NextResponse.json(
    {
      service: "ProoVra agent discovery API",
      description:
        "Discover creator-owned resources available through x402-gated ProoVra endpoints. Full content bodies are returned only after payment.",
      network: "Arc Testnet",
      x402Version: 2,
      count: resources.length,
      filters: {
        q: query || null,
        source,
        limit,
      },
      resources,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
