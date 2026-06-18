import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ActivityEvent,
  Agent,
  DashboardStats,
  Receipt,
  Settlement,
  Task,
} from "./mock-data";
import type {
  AgentWallet,
  SettlementProviderMode,
  SettlementReleaseResult,
  WalletProviderMode,
} from "@/providers";

export interface AgentWalletRecord extends AgentWallet {
  agentId: string;
  provider: WalletProviderMode;
  status: "created" | "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementTransactionRecord {
  settlementId: string;
  provider: SettlementProviderMode;
  contractAddress?: string;
  externalEscrowId?: string;
  createTxHash?: string;
  createBlockNumber?: number;
  createConfirmationStatus?: NonNullable<SettlementReleaseResult["confirmationStatus"]>;
  createConfirmations?: number;
  createSettlementTime?: number;
  releaseTxHash?: string;
  releaseBlockNumber?: number;
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  amount: number;
  currency: "USDC";
  status: SettlementReleaseResult["status"];
  confirmationStatus: NonNullable<SettlementReleaseResult["confirmationStatus"]>;
  confirmations: number;
  settlementTime: number;
  submittedAt: Date;
  confirmedAt?: Date;
  updatedAt: Date;
}

export interface X402PaymentRecord {
  paymentId: string;
  settlementId: string;
  amount: number;
  payerWallet: string;
  payeeWallet: string;
  provider: "circle-cli-x402";
  status: "settled";
  receipt: string;
  createdAt: Date;
  verifiedAt?: Date;
}

type PersistedDatabase = {
  version: 3;
  agents: Agent[];
  tasks: Task[];
  settlements: Settlement[];
  receipts: Receipt[];
  wallets: AgentWalletRecord[];
  settlementTransactions: SettlementTransactionRecord[];
  x402Payments: X402PaymentRecord[];
  activities: ActivityEvent[];
  stats: DashboardStats;
};

class PersistentMap<K, V> extends Map<K, V> {
  constructor(
    entries: Array<[K, V]>,
    private readonly onChange: () => void
  ) {
    super();
    for (const [key, value] of entries) {
      super.set(key, value);
    }
  }

  set(key: K, value: V): this {
    super.set(key, value);
    this.onChange();
    return this;
  }

  delete(key: K): boolean {
    const deleted = super.delete(key);
    if (deleted) this.onChange();
    return deleted;
  }

  clear(): void {
    if (this.size === 0) return;
    super.clear();
    this.onChange();
  }
}

function getDatabasePath() {
  return process.env.PROOVRA_DB_PATH || join(process.cwd(), "data", "proovra-db.json");
}

function reviveAgent(agent: Agent): Agent {
  return {
    ...agent,
    registeredAt: new Date(agent.registeredAt),
  };
}

function reviveTask(task: Task): Task {
  return {
    ...task,
    deadline: new Date(task.deadline),
    createdAt: new Date(task.createdAt),
    milestones: task.milestones?.map((milestone) => ({
      ...milestone,
      completedAt: milestone.completedAt ? new Date(milestone.completedAt) : undefined,
    })),
  };
}

function reviveSettlement(settlement: Settlement): Settlement {
  return {
    ...settlement,
    proofFile: settlement.proofFile
      ? {
          ...settlement.proofFile,
          uploadedAt: new Date(settlement.proofFile.uploadedAt),
        }
      : undefined,
    createdAt: new Date(settlement.createdAt),
    settledAt: settlement.settledAt ? new Date(settlement.settledAt) : undefined,
    proofSubmittedAt: settlement.proofSubmittedAt
      ? new Date(settlement.proofSubmittedAt)
      : undefined,
    verifiedAt: settlement.verifiedAt ? new Date(settlement.verifiedAt) : undefined,
  };
}

function reviveReceipt(receipt: Receipt): Receipt {
  return {
    ...receipt,
    proofFile: receipt.proofFile
      ? {
          ...receipt.proofFile,
          uploadedAt: new Date(receipt.proofFile.uploadedAt),
        }
      : undefined,
    createdAt: new Date(receipt.createdAt),
    verificationTimestamp: receipt.verificationTimestamp
      ? new Date(receipt.verificationTimestamp)
      : undefined,
    settlementTimestamp: receipt.settlementTimestamp
      ? new Date(receipt.settlementTimestamp)
      : undefined,
  };
}

function reviveActivity(event: ActivityEvent): ActivityEvent {
  return {
    ...event,
    timestamp: new Date(event.timestamp),
  };
}

function reviveWallet(wallet: AgentWalletRecord): AgentWalletRecord {
  return {
    ...wallet,
    createdAt: new Date(wallet.createdAt),
    updatedAt: new Date(wallet.updatedAt),
  };
}

function reviveSettlementTransaction(
  transaction: SettlementTransactionRecord
): SettlementTransactionRecord {
  return {
    ...transaction,
    submittedAt: new Date(transaction.submittedAt),
    confirmedAt: transaction.confirmedAt ? new Date(transaction.confirmedAt) : undefined,
    updatedAt: new Date(transaction.updatedAt),
  };
}

function reviveX402Payment(payment: X402PaymentRecord): X402PaymentRecord {
  return {
    ...payment,
    createdAt: new Date(payment.createdAt),
    verifiedAt: payment.verifiedAt ? new Date(payment.verifiedAt) : undefined,
  };
}

function createEmptyDatabase(): PersistedDatabase {
  return {
    version: 3,
    agents: [],
    tasks: [],
    settlements: [],
    receipts: [],
    wallets: [],
    settlementTransactions: [],
    x402Payments: [],
    activities: [],
    stats: {
      totalSettled: 0,
      pendingEscrow: 0,
      settlementCount: 0,
      activeAgents: 0,
      successRate: 0,
      avgSettlementTime: 0,
      totalTransactions: 0,
      volume24h: 0,
    },
  };
}

function reviveDatabase(data: PersistedDatabase): PersistedDatabase {
  return {
    version: 3,
    agents: data.agents.map(reviveAgent),
    tasks: data.tasks.map(reviveTask),
    settlements: data.settlements.map(reviveSettlement),
    receipts: data.receipts.map(reviveReceipt),
    wallets: (data.wallets ?? []).map(reviveWallet),
    settlementTransactions: (data.settlementTransactions ?? []).map(
      reviveSettlementTransaction
    ),
    x402Payments: (data.x402Payments ?? []).map(reviveX402Payment),
    activities: data.activities.map(reviveActivity),
    stats: { ...data.stats },
  };
}

// Next.js API routes may be recreated in dev mode. We use global to keep one
// database instance per server process while the JSON file persists changes.
declare global {
  var _proovraDb: ProoVraDatabase | undefined;
}

export class ProoVraDatabase {
  agents: Map<string, Agent>;
  tasks: Map<string, Task>;
  settlements: Map<string, Settlement>;
  receipts: Map<string, Receipt>;
  wallets: Map<string, AgentWalletRecord>;
  settlementTransactions: Map<string, SettlementTransactionRecord>;
  x402Payments: Map<string, X402PaymentRecord>;
  activities: ActivityEvent[];
  stats: DashboardStats;

  private readonly databasePath: string;

  constructor(databasePath = getDatabasePath()) {
    this.databasePath = databasePath;
    const data = this.loadDatabase();
    const persist = () => this.persist();

    this.agents = new PersistentMap(data.agents.map((agent) => [agent.id, agent]), persist);
    this.tasks = new PersistentMap(data.tasks.map((task) => [task.id, task]), persist);
    this.settlements = new PersistentMap(
      data.settlements.map((settlement) => [settlement.id, settlement]),
      persist
    );
    this.receipts = new PersistentMap(
      data.receipts.map((receipt) => [receipt.id, receipt]),
      persist
    );
    this.wallets = new PersistentMap(
      data.wallets.map((wallet) => [wallet.agentId, wallet]),
      persist
    );
    this.settlementTransactions = new PersistentMap(
      data.settlementTransactions.map((transaction) => [
        transaction.settlementId,
        transaction,
      ]),
      persist
    );
    this.x402Payments = new PersistentMap(
      data.x402Payments.map((payment) => [payment.paymentId, payment]),
      persist
    );
    this.activities = [...data.activities].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    this.stats = { ...data.stats };
  }

  addActivity(event: Omit<ActivityEvent, "id" | "timestamp">) {
    const newEvent: ActivityEvent = {
      ...event,
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date(),
    };
    this.activities.unshift(newEvent);
    if (this.activities.length > 50) this.activities.pop();
    this.persist();
    return newEvent;
  }

  updateStats(delta: Partial<DashboardStats>) {
    this.stats = { ...this.stats, ...delta };
    this.persist();
  }

  private loadDatabase(): PersistedDatabase {
    if (!existsSync(this.databasePath)) {
      return createEmptyDatabase();
    }

    try {
      const raw = readFileSync(this.databasePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedDatabase;
      return reviveDatabase(parsed);
    } catch (error) {
      console.error("Failed to load ProoVra database; using empty database.", error);
      return createEmptyDatabase();
    }
  }

  private persist() {
    const data: PersistedDatabase = {
      version: 3,
      agents: Array.from(this.agents.values()),
      tasks: Array.from(this.tasks.values()),
      settlements: Array.from(this.settlements.values()),
      receipts: Array.from(this.receipts.values()),
      wallets: Array.from(this.wallets.values()),
      settlementTransactions: Array.from(this.settlementTransactions.values()),
      x402Payments: Array.from(this.x402Payments.values()),
      activities: this.activities,
      stats: this.stats,
    };

    mkdirSync(dirname(this.databasePath), { recursive: true });
    writeFileSync(this.databasePath, JSON.stringify(data, null, 2));
  }
}

const existingDb = global._proovraDb;
export const db =
  existingDb &&
  "wallets" in existingDb &&
  "settlementTransactions" in existingDb &&
  "x402Payments" in existingDb
    ? existingDb
    : new ProoVraDatabase();

if (process.env.NODE_ENV !== "production") {
  global._proovraDb = db;
}
