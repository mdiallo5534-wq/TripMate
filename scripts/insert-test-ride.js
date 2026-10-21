const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.nbftvqatmlmmwqtybcxy:Mamoudou3105@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const id = 'test-ride-' + Date.now();
    const scheduled = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    await pool.query(
      `INSERT INTO ride_requests (
        id, rider_name, rider_contact, city, pickup_location, dropoff_location,
        scheduled_at, passenger_count, fare_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, 'Farhan', '012-9876543', 'Kuala Lumpur', 'Pavilion Bukit Bintang', 'KL Sentral', scheduled, 1, 25.0, 'open']
    );
    console.log('Inserted open ride:', id);
  } catch (err) {
    console.error('Insert error:', err);
  } finally {
    await pool.end();
  }
}

main();
