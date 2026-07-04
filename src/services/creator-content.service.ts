import { createHash } from "node:crypto";
import { db } from "@/lib/db";
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

const sourceTypes: CreatorContentSource[] = ["manual", "rss", "ghost", "docs"];

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

export class CreatorContentService {
  static getContent(): CreatorContent[] {
    return Array.from(db.creatorContents.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  static getPublishedContent(): CreatorContent[] {
    return this.getContent().filter((content) => content.status === "published");
  }

  static getContentById(contentId: string): CreatorContent | undefined {
    return db.creatorContents.get(contentId);
  }

  static getAccesses(contentId?: string): CreatorContentAccess[] {
    return Array.from(db.creatorContentAccesses.values())
      .filter((access) => !contentId || access.contentId === contentId)
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

    const access: CreatorContentAccess = {
      id: makeId("access", `${input.contentId}:${input.paymentId}`),
      contentId: input.contentId,
      paymentId: input.paymentId,
      agentWallet: input.agentWallet,
      amount: input.amount,
      currency: "USDC",
      status: "settled",
      accessedAt: new Date(),
    };

    content.accessCount += 1;
    content.totalEarned += input.amount;
    content.updatedAt = new Date();
    db.creatorContents.set(content.id, content);
    db.creatorContentAccesses.set(access.id, access);
    db.addActivity({
      type: "funds_released",
      agentId: "agent-access",
      description: `Agent paid ${input.amount} USDC to access "${content.title}".`,
      amount: input.amount,
    });
    return access;
  }

  static getSummary() {
    const contents = this.getContent();
    const accesses = this.getAccesses();
    return {
      publishedCount: contents.filter((content) => content.status === "published").length,
      totalAccesses: accesses.length,
      totalEarned: accesses.reduce((sum, access) => sum + access.amount, 0),
      activeCreators: new Set(contents.map((content) => content.creatorWallet)).size,
    };
  }
}
