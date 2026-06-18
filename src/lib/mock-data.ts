export type AgentRole =
  | "research"
  | "writer"
  | "editor"
  | "publisher"
  | "data"
  | "voice"
  | "security"
  | "orchestrator";

export type AgentType = "provider" | "requester" | "both";
export type PricingModel =
  | "per-task"
  | "per-call"
  | "per-second"
  | "per-byte"
  | "milestone";

export type EscrowStatus =
  | "created"
  | "funded"
  | "submitted"
  | "verified"
  | "released"
  | "refunded"
  | "failed";

export type TaskStatus =
  | "created"
  | "assigned"
  | "in-progress"
  | "delivered"
  | "verified"
  | "settled"
  | "failed";

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  type: AgentType;
  description: string;
  walletAddress: string;
  avatar: string;
  completedSettlements: number;
  totalEarnings: number;
  totalSpending: number;
  successRate: number;
  reputationScore: number;
  activeEscrows: number;
  registeredAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  requesterId: string;
  providerId?: string;
  amount: number;
  pricingModel: PricingModel;
  status: TaskStatus;
  deliverables: string;
  verificationCriteria: string;
  deadline: Date;
  createdAt: Date;
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  title: string;
  amount: number;
  status: EscrowStatus;
  completedAt?: Date;
}

export interface Settlement {
  id: string;
  taskId: string;
  requesterId: string;
  providerId: string;
  amount: number;
  escrowStatus: EscrowStatus;
  proofHash: string;
  proofUrl?: string;
  proofText?: string;
  proofFile?: ProofFile;
  proofSubmittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  verificationResult: "passed" | "failed" | "pending";
  receiptId?: string;
  arcTxHash: string;
  escrowTxHash?: string;
  escrowBlockNumber?: number;
  escrowExplorerLink?: string;
  releaseTxHash?: string;
  releaseBlockNumber?: number;
  releaseExplorerLink?: string;
  externalEscrowId?: string;
  contractAddress?: string;
  createdAt: Date;
  settledAt?: Date;
  settlementTime?: number;
  pricingModel: PricingModel;
}

export interface ProofFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  fileUrl: string;
  filePath: string;
  fileHash?: string;
}

export interface Receipt {
  id: string;
  settlementId: string;
  taskId: string;
  requesterId: string;
  providerId: string;
  amount: number;
  proofHash: string;
  proofUrl?: string;
  proofText?: string;
  proofFile?: ProofFile;
  verificationTimestamp?: Date;
  arcTxHash: string;
  escrowTxHash?: string;
  releaseTxHash?: string;
  explorerLink?: string;
  escrowExplorerLink?: string;
  releaseExplorerLink?: string;
  blockNumber: number;
  settlementTime: number;
  settlementTimestamp?: Date;
  createdAt: Date;
}

export interface ActivityEvent {
  id: string;
  type:
    | "escrow_created"
    | "escrow_funded"
    | "work_submitted"
    | "verification_passed"
    | "verification_failed"
    | "funds_released"
    | "receipt_generated"
    | "agent_registered"
    | "reputation_updated";
  agentId: string;
  description: string;
  amount?: number;
  timestamp: Date;
}

export interface DashboardStats {
  totalSettled: number;
  pendingEscrow: number;
  settlementCount: number;
  activeAgents: number;
  successRate: number;
  avgSettlementTime: number;
  totalTransactions: number;
  volume24h: number;
}
