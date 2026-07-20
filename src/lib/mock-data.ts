export interface ActivityEvent {
  id: string;
  type: "content_published" | "agent_paid_access" | "receipt_generated" | "funds_released";
  agentId: string;
  description: string;
  amount?: number;
  timestamp: Date;
}

export type CreatorContentStatus = "draft" | "published" | "paused";
export type CreatorContentSource = "manual" | "rss";

export interface CreatorContent {
  id: string;
  title: string;
  description: string;
  body: string;
  creatorName: string;
  creatorWallet: string;
  source: CreatorContentSource;
  sourceUrl?: string;
  price: number;
  currency: "USDC";
  status: CreatorContentStatus;
  accessCount: number;
  totalEarned: number;
  totalGrossVolume?: number;
  totalPlatformFees?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorContentAccess {
  id: string;
  contentId: string;
  paymentId: string;
  agentWallet: string;
  amount: number;
  grossAmount?: number;
  platformFee?: number;
  creatorNetAmount?: number;
  platformFeeBps?: number;
  settlementMode?: "creator_gross" | "dual_x402_split";
  creatorSettlementTx?: string;
  platformFeePaymentId?: string;
  platformFeeSettlementTx?: string;
  platformFeePayeeWallet?: string;
  creatorFundsStatus?: "gateway_balance" | "withdrawn_to_wallet";
  currency: "USDC";
  status: "settled";
  accessedAt: Date;
}

export interface CreatorProfile {
  id: string;
  creatorWallet: string;
  email?: string;
  displayName: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorRssVerification {
  id: string;
  creatorWallet: string;
  feedUrl: string;
  domain: string;
  verificationCode: string;
  status: "pending" | "verified";
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
