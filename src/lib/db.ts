import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ActivityEvent,
  Agent,
  CreatorContent,
  CreatorContentAccess,
  CreatorProfile,
  CreatorRssVerification,
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
  version: 4;
  agents: Agent[];
  tasks: Task[];
  settlements: Settlement[];
  receipts: Receipt[];
  wallets: AgentWalletRecord[];
  settlementTransactions: SettlementTransactionRecord[];
  x402Payments: X402PaymentRecord[];
  creatorContents: CreatorContent[];
  creatorContentAccesses: CreatorContentAccess[];
  creatorProfiles: CreatorProfile[];
  creatorRssVerifications: CreatorRssVerification[];
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

function getDatabaseKey() {
  return process.env.PROOVRA_KV_DB_KEY || "proovra:database:v3";
}

function getStorageSignature() {
  return hasVercelKv()
    ? `kv:${process.env.KV_REST_API_URL?.trim()}:${getDatabaseKey()}`
    : `file:${getDatabasePath()}`;
}

function hasVercelKv() {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token || url.includes("...") || token.includes("...")) {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    if (!isProductionRuntime()) {
      console.warn("Ignoring invalid KV_REST_API_URL; using local file database.");
      return false;
    }
    throw new Error("KV_REST_API_URL must be a valid URL.");
  }
}

function isProductionRuntime() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

async function kvCommand<T>(command: unknown[]): Promise<T | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Vercel KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN for production persistence."
    );
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Vercel KV command failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error) {
    throw new Error(`Vercel KV command failed: ${payload.error}`);
  }

  return payload.result ?? null;
}

async function loadKvDatabase(): Promise<PersistedDatabase> {
  const result = await kvCommand<string | PersistedDatabase>([
    "GET",
    getDatabaseKey(),
  ]);

  if (!result) return createEmptyDatabase();
  const parsed =
    typeof result === "string" ? (JSON.parse(result) as PersistedDatabase) : result;
  return reviveDatabase(parsed);
}

async function persistKvDatabase(data: PersistedDatabase) {
  await kvCommand<string>(["SET", getDatabaseKey(), JSON.stringify(data)]);
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
    source: task.source
      ? {
          ...task.source,
          importedAt: new Date(task.source.importedAt),
          updatedAt: task.source.updatedAt ? new Date(task.source.updatedAt) : undefined,
        }
      : undefined,
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
    githubPullRequest: settlement.githubPullRequest
      ? {
          ...settlement.githubPullRequest,
          createdAt: new Date(settlement.githubPullRequest.createdAt),
          updatedAt: new Date(settlement.githubPullRequest.updatedAt),
          mergedAt: settlement.githubPullRequest.mergedAt
            ? new Date(settlement.githubPullRequest.mergedAt)
            : undefined,
          validatedAt: new Date(settlement.githubPullRequest.validatedAt),
        }
      : undefined,
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
    githubPullRequest: receipt.githubPullRequest
      ? {
          ...receipt.githubPullRequest,
          createdAt: new Date(receipt.githubPullRequest.createdAt),
          updatedAt: new Date(receipt.githubPullRequest.updatedAt),
          mergedAt: receipt.githubPullRequest.mergedAt
            ? new Date(receipt.githubPullRequest.mergedAt)
            : undefined,
          validatedAt: new Date(receipt.githubPullRequest.validatedAt),
        }
      : undefined,
    source: receipt.source
      ? {
          ...receipt.source,
          importedAt: new Date(receipt.source.importedAt),
          updatedAt: receipt.source.updatedAt
            ? new Date(receipt.source.updatedAt)
            : undefined,
        }
      : undefined,
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

function reviveCreatorContent(content: CreatorContent): CreatorContent {
  return {
    ...content,
    createdAt: new Date(content.createdAt),
    updatedAt: new Date(content.updatedAt),
  };
}

function reviveCreatorContentAccess(
  access: CreatorContentAccess
): CreatorContentAccess {
  return {
    ...access,
    accessedAt: new Date(access.accessedAt),
  };
}

function reviveCreatorProfile(profile: CreatorProfile): CreatorProfile {
  return {
    ...profile,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
  };
}

function reviveCreatorRssVerification(
  verification: CreatorRssVerification
): CreatorRssVerification {
  return {
    ...verification,
    verifiedAt: verification.verifiedAt ? new Date(verification.verifiedAt) : undefined,
    createdAt: new Date(verification.createdAt),
    updatedAt: new Date(verification.updatedAt),
  };
}

function createEmptyDatabase(): PersistedDatabase {
  return {
    version: 4,
    agents: [],
    tasks: [],
    settlements: [],
    receipts: [],
    wallets: [],
    settlementTransactions: [],
    x402Payments: [],
    creatorContents: [],
    creatorContentAccesses: [],
    creatorProfiles: [],
    creatorRssVerifications: [],
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
    version: 4,
    agents: (data.agents ?? []).map(reviveAgent),
    tasks: (data.tasks ?? []).map(reviveTask),
    settlements: (data.settlements ?? []).map(reviveSettlement),
    receipts: (data.receipts ?? []).map(reviveReceipt),
    wallets: (data.wallets ?? []).map(reviveWallet),
    settlementTransactions: (data.settlementTransactions ?? []).map(
      reviveSettlementTransaction
    ),
    x402Payments: (data.x402Payments ?? []).map(reviveX402Payment),
    creatorContents: (data.creatorContents ?? []).map(reviveCreatorContent),
    creatorContentAccesses: (data.creatorContentAccesses ?? []).map(
      reviveCreatorContentAccess
    ),
    creatorProfiles: (data.creatorProfiles ?? []).map(reviveCreatorProfile),
    creatorRssVerifications: (data.creatorRssVerifications ?? []).map(
      reviveCreatorRssVerification
    ),
    activities: (data.activities ?? []).map(reviveActivity),
    stats: { ...createEmptyDatabase().stats, ...(data.stats ?? {}) },
  };
}

// Next.js API routes may be recreated in dev mode. We use global to keep one
// database instance per server process while the JSON file persists changes.
declare global {
  var _proovraDb: ProoVraDatabase | undefined;
}

export class ProoVraDatabase {
  agents!: Map<string, Agent>;
  tasks!: Map<string, Task>;
  settlements!: Map<string, Settlement>;
  receipts!: Map<string, Receipt>;
  wallets!: Map<string, AgentWalletRecord>;
  settlementTransactions!: Map<string, SettlementTransactionRecord>;
  x402Payments!: Map<string, X402PaymentRecord>;
  creatorContents!: Map<string, CreatorContent>;
  creatorContentAccesses!: Map<string, CreatorContentAccess>;
  creatorProfiles!: Map<string, CreatorProfile>;
  creatorRssVerifications!: Map<string, CreatorRssVerification>;
  activities!: ActivityEvent[];
  stats!: DashboardStats;
  readonly storageSignature: string;

  private readonly databasePath: string;
  private readonly useVercelKv: boolean;
  private readyPromise: Promise<void>;
  private persistPromise: Promise<void> = Promise.resolve();

  constructor(databasePath = getDatabasePath()) {
    this.databasePath = databasePath;
    this.useVercelKv = hasVercelKv();
    this.storageSignature = this.useVercelKv
      ? `kv:${process.env.KV_REST_API_URL?.trim()}:${getDatabaseKey()}`
      : `file:${this.databasePath}`;
    const data = this.useVercelKv ? createEmptyDatabase() : this.loadFileDatabase();
    this.replaceDatabase(data);

    this.readyPromise = this.useVercelKv
      ? this.loadRemoteDatabase()
      : Promise.resolve();
  }

  async ready() {
    await this.readyPromise;
  }

  async flush() {
    await this.persistPromise;
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

  private replaceDatabase(data: PersistedDatabase) {
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
    this.creatorContents = new PersistentMap(
      data.creatorContents.map((content) => [content.id, content]),
      persist
    );
    this.creatorContentAccesses = new PersistentMap(
      data.creatorContentAccesses.map((access) => [access.id, access]),
      persist
    );
    this.creatorProfiles = new PersistentMap(
      data.creatorProfiles.map((profile) => [
        profile.creatorWallet.toLowerCase(),
        profile,
      ]),
      persist
    );
    this.creatorRssVerifications = new PersistentMap(
      data.creatorRssVerifications.map((verification) => [
        verification.id,
        verification,
      ]),
      persist
    );
    this.activities = [...data.activities].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    this.stats = { ...data.stats };
  }

  private async loadRemoteDatabase() {
    try {
      this.replaceDatabase(await loadKvDatabase());
    } catch (error) {
      if (isProductionRuntime()) {
        throw error;
      }
      console.warn(
        "Failed to load Vercel KV database; using local file database.",
        error
      );
      this.replaceDatabase(this.loadFileDatabase());
    }
  }

  private loadFileDatabase(): PersistedDatabase {
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

  private snapshot(): PersistedDatabase {
    return {
      version: 4,
      agents: Array.from(this.agents.values()),
      tasks: Array.from(this.tasks.values()),
      settlements: Array.from(this.settlements.values()),
      receipts: Array.from(this.receipts.values()),
      wallets: Array.from(this.wallets.values()),
      settlementTransactions: Array.from(this.settlementTransactions.values()),
      x402Payments: Array.from(this.x402Payments.values()),
      creatorContents: Array.from(this.creatorContents.values()),
      creatorContentAccesses: Array.from(this.creatorContentAccesses.values()),
      creatorProfiles: Array.from(this.creatorProfiles.values()),
      creatorRssVerifications: Array.from(this.creatorRssVerifications.values()),
      activities: this.activities,
      stats: this.stats,
    };
  }

  private persist() {
    const data = this.snapshot();

    if (this.useVercelKv) {
      this.persistPromise = this.persistPromise.then(() => persistKvDatabase(data));
      return;
    }

    if (isProductionRuntime()) {
      throw new Error(
        "Production persistence is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN."
      );
    }

    mkdirSync(dirname(this.databasePath), { recursive: true });
    writeFileSync(this.databasePath, JSON.stringify(data, null, 2));
  }
}

const existingDb = global._proovraDb;
const currentStorageSignature = getStorageSignature();
export const db =
  existingDb &&
  "storageSignature" in existingDb &&
  existingDb.storageSignature === currentStorageSignature &&
  "ready" in existingDb &&
  "flush" in existingDb &&
  "wallets" in existingDb &&
  "settlementTransactions" in existingDb &&
  "x402Payments" in existingDb &&
  "creatorContents" in existingDb &&
  "creatorContentAccesses" in existingDb &&
  "creatorProfiles" in existingDb &&
  "creatorRssVerifications" in existingDb
    ? existingDb
    : new ProoVraDatabase();

if (process.env.NODE_ENV !== "production") {
  global._proovraDb = db;
}
