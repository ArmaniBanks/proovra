import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const databasePath =
  process.env.PROOVRA_DB_PATH || join(process.cwd(), "data", "proovra-db.json");

const emptyDatabase = {
  version: 5,
  x402Payments: [],
  creatorContents: [],
  creatorContentAccesses: [],
  creatorProfiles: [],
  creatorRssVerifications: [],
  activities: [],
};

mkdirSync(dirname(databasePath), { recursive: true });
writeFileSync(databasePath, `${JSON.stringify(emptyDatabase, null, 2)}\n`);

console.log(`Reset ProoVra database: ${databasePath}`);
