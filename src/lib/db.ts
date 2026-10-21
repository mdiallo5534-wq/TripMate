import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.nbftvqatmlmmwqtybcxy:Mamoudou3105@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

// Global pool to prevent connection exhaustion in Next.js hot reload
declare global {
  var _pgPool: Pool | undefined;
}

let pool: Pool;
if (process.env.NODE_ENV === "production") {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });
} else {
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  pool = global._pgPool;
}

export { pool };
