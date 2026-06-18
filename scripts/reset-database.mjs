import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const databasePath =
  process.env.PROOVRA_DB_PATH || join(process.cwd(), "data", "proovra-db.json");

const emptyDatabase = {
  version: 3,
  agents: [],
  tasks: [],
  settlements: [],
  receipts: [],
  wallets: [],
  settlementTransactions: [],
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

mkdirSync(dirname(databasePath), { recursive: true });
writeFileSync(databasePath, `${JSON.stringify(emptyDatabase, null, 2)}\n`);

console.log(`Reset ProoVra database: ${databasePath}`);
