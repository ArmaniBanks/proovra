import { createHash, randomBytes } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { db } from "@/lib/db";
import type {
  CreatorRssVerification,
  CreatorContentSource,
} from "@/lib/mock-data";
import { CreatorContentService } from "@/services/creator-content.service";

export type RssFeedItem = {
  id: string;
  title: string;
  link: string;
  publishedAt?: string;
  excerpt: string;
  body: string;
};

type ParsedFeed = {
  feedUrl: string;
  domain: string;
  title: string;
  items: RssFeedItem[];
};

const MAX_FEED_BYTES = 1_000_000;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
});

function normalizeUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("RSS feed URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("RSS feed URL cannot include credentials.");
  }
  return url;
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeText(record["#cdata"] ?? record["#text"] ?? "");
  }
  return "";
}

function stripHtml(value = "") {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function arrayOf<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function itemId(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

function makeVerificationId(creatorWallet: string, feedUrl: string) {
  return `rss-${createHash("sha256")
    .update(`${creatorWallet.toLowerCase()}:${feedUrl}`)
    .digest("hex")
    .slice(0, 16)}`;
}

function sameDomainOrSubdomain(candidateUrl: string, domain: string) {
  try {
    const hostname = new URL(candidateUrl).hostname.toLowerCase();
    const normalizedDomain = domain.toLowerCase();
    return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
  } catch {
    return false;
  }
}

async function fetchPublicText(url: URL) {
  const response = await fetch(url, {
    headers: {
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8",
      "User-Agent": "ProoVraRSSVerifier/1.0",
    },
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Public fetch failed with HTTP ${response.status}.`);
  }

  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_FEED_BYTES) {
    throw new Error("Feed is too large to import.");
  }

  const text = await response.text();
  if (text.length > MAX_FEED_BYTES) {
    throw new Error("Feed is too large to import.");
  }
  return text;
}

function parseFeedXml(feedUrl: string, xml: string): ParsedFeed {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const url = normalizeUrl(feedUrl);
  const domain = url.hostname.toLowerCase();

  const rss = parsed.rss as
    | { channel?: { title?: unknown; item?: unknown } }
    | undefined;
  const atom = parsed.feed as
    | { title?: unknown; entry?: unknown }
    | undefined;

  if (rss?.channel) {
    const channel = rss.channel;
    const items = arrayOf(
      channel.item as Record<string, unknown> | Record<string, unknown>[] | undefined
    )
      .map((item) => {
        const link = normalizeText(item.link);
        const title = stripHtml(normalizeText(item.title));
        const excerpt = stripHtml(
          normalizeText(item.description ?? item.summary ?? "")
        );
        const body = stripHtml(
          normalizeText(
            item["content:encoded"] ?? item.encoded ?? item.description ?? ""
          )
        );
        const publishedAt = normalizeText(item.pubDate ?? item.published ?? "");
        const guid = normalizeText(item.guid ?? "");
        return {
          id: itemId(guid || link || title),
          title,
          link,
          publishedAt: publishedAt || undefined,
          excerpt,
          body,
        };
      })
      .filter((item) => item.title && item.link && sameDomainOrSubdomain(item.link, domain))
      .slice(0, 20);

    return {
      feedUrl,
      domain,
      title: stripHtml(normalizeText(channel.title)) || domain,
      items,
    };
  }

  if (atom) {
    const items = arrayOf(
      atom.entry as Record<string, unknown> | Record<string, unknown>[] | undefined
    )
      .map((entry) => {
        const linkNode = entry.link;
        const link =
          typeof linkNode === "object" && linkNode !== null
            ? normalizeText((linkNode as Record<string, unknown>)["@_href"])
            : normalizeText(linkNode);
        const title = stripHtml(normalizeText(entry.title));
        const excerpt = stripHtml(normalizeText(entry.summary ?? ""));
        const body = stripHtml(normalizeText(entry.content ?? entry.summary ?? ""));
        const publishedAt = normalizeText(entry.published ?? entry.updated ?? "");
        const id = normalizeText(entry.id ?? "");
        return {
          id: itemId(id || link || title),
          title,
          link,
          publishedAt: publishedAt || undefined,
          excerpt,
          body,
        };
      })
      .filter((item) => item.title && item.link && sameDomainOrSubdomain(item.link, domain))
      .slice(0, 20);

    return {
      feedUrl,
      domain,
      title: stripHtml(normalizeText(atom.title)) || domain,
      items,
    };
  }

  throw new Error("URL did not return a valid RSS or Atom feed.");
}

export class RssImportService {
  static async fetchFeed(feedUrl: string): Promise<ParsedFeed> {
    const url = normalizeUrl(feedUrl);
    const xml = await fetchPublicText(url);
    return parseFeedXml(url.toString(), xml);
  }

  static getVerification(creatorWallet: string, feedUrl: string) {
    const id = makeVerificationId(creatorWallet, normalizeUrl(feedUrl).toString());
    return db.creatorRssVerifications.get(id);
  }

  static async prepareImport(input: { creatorWallet: string; feedUrl: string }) {
    const feed = await this.fetchFeed(input.feedUrl);
    const id = makeVerificationId(input.creatorWallet, feed.feedUrl);
    const existing = db.creatorRssVerifications.get(id);
    const now = new Date();
    const verification: CreatorRssVerification = existing ?? {
      id,
      creatorWallet: input.creatorWallet,
      feedUrl: feed.feedUrl,
      domain: feed.domain,
      verificationCode: `proovra-verify-${randomBytes(8).toString("hex")}`,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    verification.updatedAt = now;
    db.creatorRssVerifications.set(verification.id, verification);
    return { feed, verification };
  }

  static async verifyOwnership(input: {
    creatorWallet: string;
    feedUrl: string;
    verificationUrl?: string;
  }) {
    const verification = this.getVerification(input.creatorWallet, input.feedUrl);
    if (!verification) {
      throw new Error("Prepare the RSS import before verifying ownership.");
    }

    const targets = [
      normalizeUrl(verification.feedUrl),
      new URL(`${normalizeUrl(verification.feedUrl).origin}/`),
    ];

    if (input.verificationUrl) {
      const candidate = normalizeUrl(input.verificationUrl);
      if (!sameDomainOrSubdomain(candidate.toString(), verification.domain)) {
        throw new Error("Verification page must be on the RSS feed domain.");
      }
      targets.unshift(candidate);
    }

    for (const target of targets) {
      const text = await fetchPublicText(target);
      if (text.includes(verification.verificationCode)) {
        verification.status = "verified";
        verification.verifiedAt = new Date();
        verification.updatedAt = new Date();
        db.creatorRssVerifications.set(verification.id, verification);
        return verification;
      }
    }

    throw new Error("Verification code was not found on the feed, homepage, or verification page.");
  }

  static async monetizeItem(input: {
    creatorWallet: string;
    creatorName: string;
    feedUrl: string;
    itemId: string;
    price: number;
    payoutWallet: string;
  }) {
    const verification = this.getVerification(input.creatorWallet, input.feedUrl);
    if (!verification || verification.status !== "verified") {
      throw new Error("RSS feed ownership must be verified before monetization.");
    }

    const feed = await this.fetchFeed(verification.feedUrl);
    const item = feed.items.find((candidate) => candidate.id === input.itemId);
    if (!item) throw new Error("RSS item was not found in the verified feed.");

    const source: CreatorContentSource = "rss";
    return CreatorContentService.createContent({
      title: item.title,
      description: item.excerpt || `RSS item from ${feed.title}`,
      body: item.body || item.excerpt,
      creatorName: input.creatorName,
      creatorWallet: input.payoutWallet,
      source,
      sourceUrl: item.link,
      price: input.price,
    });
  }
}
