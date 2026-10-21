const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.nbftvqatmlmmwqtybcxy:Mamoudou3105@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await pool.query(`ALTER TABLE public.ride_offers ADD COLUMN IF NOT EXISTS offered_by VARCHAR(20) NOT NULL DEFAULT 'driver'`);
  await pool.query(`ALTER TABLE public.ride_offers ADD COLUMN IF NOT EXISTS parent_offer_id VARCHAR(36) REFERENCES public.ride_offers(id) ON DELETE CASCADE`);
  console.log("Successfully migrated database columns!");
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  pool.end();
});
