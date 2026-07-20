import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  calculateAccessRevenue,
  getPlatformFeeBps,
  getTreasuryConfig,
  platformFeePercent,
} from "@/lib/revenue";
import type {
  CreatorContent,
  CreatorContentAccess,
  CreatorContentSource,
} from "@/lib/mock-data";

type CreateContentInput = {
  title: string;
  description: string;
  body: string;
  creatorName: string;
  creatorWallet: string;
  source: CreatorContentSource;
  sourceUrl?: string;
  price: number;
};

type RecordAccessInput = {
  contentId: string;
  paymentId: string;
  agentWallet: string;
  amount: number;
};

const sourceTypes: CreatorContentSource[] = ["manual", "rss"];

function makeId(prefix: string, seed: string) {
  const digest = createHash("sha256")
    .update(`${seed}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 10);
  return `${prefix}-${digest}`;
}

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`);
}

function accessGrossAmount(access: CreatorContentAccess) {
  return access.grossAmount ?? access.amount;
}

function accessPlatformFee(access: CreatorContentAccess) {
  return access.platformFee ?? 0;
}

function accessCreatorNetAmount(access: CreatorContentAccess) {
  return access.creatorNetAmount ?? access.amount;
}

export class CreatorContentService {
  static getRevenueConfig() {
    const feeBps = getPlatformFeeBps();
    const treasury = getTreasuryConfig();
    return {
      platformFeeBps: feeBps,
      platformFeePercent: platformFeePercent(feeBps),
      treasuryConfigured: treasury.configured,
      settlementMode: "creator_direct_with_fee_ledger" as const,
    };
  }

  static getAccessGrossAmount(access: CreatorContentAccess) {
    return accessGrossAmount(access);
  }

  static getAccessPlatformFee(access: CreatorContentAccess) {
    return accessPlatformFee(access);
  }

  static getAccessCreatorNetAmount(access: CreatorContentAccess) {
    return accessCreatorNetAmount(access);
  }

  static quoteRevenue(amount: number) {
    return calculateAccessRevenue(amount);
  }

  static getContent(creatorWallet?: string): CreatorContent[] {
    return Array.from(db.creatorContents.values())
      .filter(
        (content) =>
          !creatorWallet ||
          content.creatorWallet.toLowerCase() === creatorWallet.toLowerCase()
      )
      .sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  static getPublishedContent(): CreatorContent[] {
    return this.getContent().filter((content) => content.status === "published");
  }

  static getContentById(contentId: string): CreatorContent | undefined {
    return db.creatorContents.get(contentId);
  }

  static getAccesses(contentId?: string, creatorWallet?: string): CreatorContentAccess[] {
    const creatorContentIds = creatorWallet
      ? new Set(this.getContent(creatorWallet).map((content) => content.id))
      : null;

    return Array.from(db.creatorContentAccesses.values())
      .filter((access) => !contentId || access.contentId === contentId)
      .filter((access) => !creatorContentIds || creatorContentIds.has(access.contentId))
      .sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime());
  }

  static createContent(input: CreateContentInput): CreatorContent {
    assertNonEmpty(input.title, "title");
    assertNonEmpty(input.description, "description");
    assertNonEmpty(input.body, "body");
    assertNonEmpty(input.creatorName, "creatorName");
    assertNonEmpty(input.creatorWallet, "creatorWallet");

    if (!sourceTypes.includes(input.source)) {
      throw new Error("Unsupported content source.");
    }
    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw new Error("price must be greater than zero.");
    }

    const now = new Date();
    const content: CreatorContent = {
      id: makeId("content", input.title),
      title: input.title.trim(),
      description: input.description.trim(),
      body: input.body.trim(),
      creatorName: input.creatorName.trim(),
      creatorWallet: input.creatorWallet.trim(),
      source: input.source,
      sourceUrl: input.sourceUrl?.trim() || undefined,
      price: input.price,
      currency: "USDC",
      status: "published",
      accessCount: 0,
      totalEarned: 0,
      totalGrossVolume: 0,
      totalPlatformFees: 0,
      createdAt: now,
      updatedAt: now,
    };

    db.creatorContents.set(content.id, content);
    db.addActivity({
      type: "receipt_generated",
      agentId: "creator-content",
      description: `${content.creatorName} published "${content.title}" as x402-paid agent content.`,
      amount: content.price,
    });
    return content;
  }

  static recordAccess(input: RecordAccessInput): CreatorContentAccess {
    const content = db.creatorContents.get(input.contentId);
    if (!content) throw new Error("Content not found.");
    if (content.status !== "published") {
      throw new Error("Content is not accepting paid agent access.");
    }

    const revenue = calculateAccessRevenue(input.amount);
    const access: CreatorContentAccess = {
      id: makeId("access", `${input.contentId}:${input.paymentId}`),
      contentId: input.contentId,
      paymentId: input.paymentId,
      agentWallet: input.agentWallet,
      amount: revenue.grossAmount,
      grossAmount: revenue.grossAmount,
      platformFee: revenue.platformFee,
      creatorNetAmount: revenue.creatorNetAmount,
      platformFeeBps: revenue.platformFeeBps,
      currency: "USDC",
      status: "settled",
      accessedAt: new Date(),
    };

    content.accessCount += 1;
    content.totalEarned += revenue.creatorNetAmount;
    content.totalGrossVolume =
      (content.totalGrossVolume ?? 0) + revenue.grossAmount;
    content.totalPlatformFees =
      (content.totalPlatformFees ?? 0) + revenue.platformFee;
    content.updatedAt = new Date();
    db.creatorContents.set(content.id, content);
    db.creatorContentAccesses.set(access.id, access);
    db.addActivity({
      type: "funds_released",
      agentId: "agent-access",
      description: `Agent paid ${revenue.grossAmount} USDC to access "${content.title}". Creator net: ${revenue.creatorNetAmount} USDC. ProoVra fee: ${revenue.platformFee} USDC.`,
      amount: revenue.grossAmount,
    });
    return access;
  }

  static getSummary(creatorWallet?: string) {
    const contents = this.getContent(creatorWallet);
    const accesses = this.getAccesses(undefined, creatorWallet);
    const totalGrossVolume = accesses.reduce(
      (sum, access) => sum + accessGrossAmount(access),
      0
    );
    const totalPlatformFees = accesses.reduce(
      (sum, access) => sum + accessPlatformFee(access),
      0
    );
    const totalCreatorEarned = accesses.reduce(
      (sum, access) => sum + accessCreatorNetAmount(access),
      0
    );
    return {
      publishedCount: contents.filter((content) => content.status === "published").length,
      totalAccesses: accesses.length,
      totalEarned: totalCreatorEarned,
      totalCreatorEarned,
      totalGrossVolume,
      totalPlatformFees,
      activeCreators: new Set(contents.map((content) => content.creatorWallet)).size,
      revenue: this.getRevenueConfig(),
    };
  }
}
