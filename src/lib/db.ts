import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ActivityEvent,
  CreatorContent,
  CreatorContentAccess,
  CreatorProfile,
  CreatorRssVerification,
} from "./mock-data";

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
  version: 5;
  x402Payments: X402PaymentRecord[];
  creatorContents: CreatorContent[];
  creatorContentAccesses: CreatorContentAccess[];
  creatorProfiles: CreatorProfile[];
  creatorRssVerifications: CreatorRssVerification[];
  activities: ActivityEvent[];
};

type LegacyDatabase = Partial<PersistedDatabase> & Record<string, unknown>;

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

function getFallbackDatabaseKeys() {
  const primary = getDatabaseKey();
  return ["proovra:database:v5", "proovra:database:v4", "proovra:database:v3"].filter(
    (key, index, keys) => key !== primary && keys.indexOf(key) === index
  );
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
  const result = await kvCommand<string | LegacyDatabase>([
    "GET",
    getDatabaseKey(),
  ]);

  if (!result) {
    for (const fallbackKey of getFallbackDatabaseKeys()) {
      const fallback = await kvCommand<string | LegacyDatabase>([
        "GET",
        fallbackKey,
      ]);
      if (!fallback) continue;
      const parsed =
        typeof fallback === "string"
          ? (JSON.parse(fallback) as LegacyDatabase)
          : fallback;
      const migrated = reviveDatabase(parsed);
      await persistKvDatabase(migrated);
      return migrated;
    }
    return createEmptyDatabase();
  }

  const parsed =
    typeof result === "string" ? (JSON.parse(result) as LegacyDatabase) : result;
  return reviveDatabase(parsed);
}

async function persistKvDatabase(data: PersistedDatabase) {
  await kvCommand<string>(["SET", getDatabaseKey(), JSON.stringify(data)]);
}

function reviveActivity(event: ActivityEvent): ActivityEvent {
  return {
    ...event,
    timestamp: new Date(event.timestamp),
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
    version: 5,
    x402Payments: [],
    creatorContents: [],
    creatorContentAccesses: [],
    creatorProfiles: [],
    creatorRssVerifications: [],
    activities: [],
  };
}

function reviveDatabase(data: LegacyDatabase): PersistedDatabase {
  return {
    version: 5,
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
  };
}

// Next.js API routes may be recreated in dev mode. We use global to keep one
// database instance per server process while the JSON file persists changes.
declare global {
  var _proovraDb: ProoVraDatabase | undefined;
}

export class ProoVraDatabase {
  x402Payments!: Map<string, X402PaymentRecord>;
  creatorContents!: Map<string, CreatorContent>;
  creatorContentAccesses!: Map<string, CreatorContentAccess>;
  creatorProfiles!: Map<string, CreatorProfile>;
  creatorRssVerifications!: Map<string, CreatorRssVerification>;
  activities!: ActivityEvent[];
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

  private replaceDatabase(data: PersistedDatabase) {
    const persist = () => this.persist();

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
      const parsed = JSON.parse(raw) as LegacyDatabase;
      return reviveDatabase(parsed);
    } catch (error) {
      console.error("Failed to load ProoVra database; using empty database.", error);
      return createEmptyDatabase();
    }
  }

  private snapshot(): PersistedDatabase {
    return {
      version: 5,
      x402Payments: Array.from(this.x402Payments.values()),
      creatorContents: Array.from(this.creatorContents.values()),
      creatorContentAccesses: Array.from(this.creatorContentAccesses.values()),
      creatorProfiles: Array.from(this.creatorProfiles.values()),
      creatorRssVerifications: Array.from(this.creatorRssVerifications.values()),
      activities: this.activities,
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
