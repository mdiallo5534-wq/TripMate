const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.nbftvqatmlmmwqtybcxy:Mamoudou3105@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function acceptRide(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const checkRes = await client.query('SELECT * FROM ride_requests WHERE id = $1 FOR UPDATE', [id]);
    if (checkRes.rows.length === 0) {
      console.log('Not found');
      return;
    }
    const current = checkRes.rows[0];
    if (current.status !== 'open') {
      console.log('Not open:', current.status);
      return;
    }
    const updateRes = await client.query(
      `UPDATE ride_requests
       SET status = 'taken',
           driver_name = $1,
           driver_contact = $2,
           vehicle_details = $3,
           taken_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      ['Driver Bob', '011-2223334', 'Proton Saga White - W1234', id]
    );
    await client.query('COMMIT');
    console.log('Ride successfully accepted:', updateRes.rows[0].status, updateRes.rows[0].driver_name);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Accept failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

acceptRide('test-ride-1791988302556');
