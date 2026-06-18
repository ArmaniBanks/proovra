import type { PricingModel } from "@/lib/mock-data";

export type ProviderMode = "simulation" | "live" | "hybrid";
export type SettlementProviderMode = "simulation" | "arc-testnet";
export type WalletProviderMode = "simulation" | "circle-sandbox" | "circle-cli";
export type PaymentAuthorizationProviderMode = "simulation" | "circle-cli-x402";

export interface EscrowCreateInput {
  settlementId?: string;
  taskId: string;
  requesterId: string;
  providerId: string;
  amount: number;
  pricingModel: PricingModel;
  proofHash?: string;
}

export interface EscrowCreateResult {
  externalEscrowId: string;
  requesterId: string;
  providerId: string;
  amount: number;
  status: "locked" | "released" | "refunded";
  provider?: SettlementProviderMode;
  txHash?: string;
  blockNumber?: number;
  confirmationStatus?: "submitted" | "confirming" | "confirmed" | "failed";
  confirmations?: number;
  contractAddress?: string;
  settlementTime?: number;
}

export interface SettlementReleaseInput {
  settlementId: string;
  requesterId: string;
  providerId: string;
  amount: number;
  proofHash?: string;
  externalEscrowId?: string;
}

export interface SettlementReleaseResult {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  amount: number;
  currency: "USDC";
  status: "pending" | "confirmed" | "failed";
  timestamp: Date;
  settlementTime: number;
  provider?: SettlementProviderMode;
  confirmationStatus?: "submitted" | "confirming" | "confirmed" | "failed";
  confirmations?: number;
  externalSettlementId?: string;
  contractAddress?: string;
}

export interface AgentWalletCreateInput {
  agentId: string;
}

export interface AgentWallet {
  id: string;
  address: string;
  balance: number;
  currency: "USDC" | "EURC";
  chain: "arc" | "ethereum" | "polygon";
  provider?: WalletProviderMode;
  agentId?: string;
  externalId?: string;
  status?: "created" | "active" | "disabled";
}

export interface WalletTransferInput {
  from: string;
  to: string;
  amount: number;
}

export interface WalletTransferResult {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: "USDC";
  status: "pending" | "completed" | "failed";
  timestamp: Date;
}

export interface PaymentAuthorizationInput {
  settlementId: string;
  amount: number;
  payerWallet: string;
  payeeWallet: string;
}

export interface PaymentAuthorizationResult {
  status: 200 | 402;
  paymentId: string;
  amount: number;
  settled: boolean;
  receipt?: string;
}

export interface SettlementProvider {
  createEscrow(input: EscrowCreateInput): Promise<EscrowCreateResult>;
  releaseFunds(input: SettlementReleaseInput): Promise<SettlementReleaseResult>;
}

export interface WalletProvider {
  createAgentWallet(input: AgentWalletCreateInput): Promise<AgentWallet>;
  transferUSDC(input: WalletTransferInput): Promise<WalletTransferResult>;
}

export interface PaymentAuthorizationProvider {
  authorizePayment(input: PaymentAuthorizationInput): Promise<PaymentAuthorizationResult>;
  verifyPayment(paymentId: string): Promise<boolean>;
}

export interface ProoVraProviders {
  mode: ProviderMode;
  settlementMode: SettlementProviderMode;
  walletMode: WalletProviderMode;
  paymentAuthorizationMode: PaymentAuthorizationProviderMode;
  settlement: SettlementProvider;
  wallet: WalletProvider;
  paymentAuthorization: PaymentAuthorizationProvider;
}
