const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.nbftvqatmlmmwqtybcxy:Mamoudou3105@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE OR REPLACE FUNCTION notify_ride_event()
RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    payload = json_build_object('table', TG_TABLE_NAME, 'action', TG_OP, 'data', row_to_json(OLD));
  ELSE
    payload = json_build_object('table', TG_TABLE_NAME, 'action', TG_OP, 'data', row_to_json(NEW));
  END IF;
  PERFORM pg_notify('tripmate_realtime', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ride_requests_notify ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_notify
AFTER INSERT OR UPDATE OR DELETE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION notify_ride_event();

DROP TRIGGER IF EXISTS trg_ride_offers_notify ON public.ride_offers;
CREATE TRIGGER trg_ride_offers_notify
AFTER INSERT OR UPDATE OR DELETE ON public.ride_offers
FOR EACH ROW EXECUTE FUNCTION notify_ride_event();
`;

async function apply() {
  try {
    await pool.query(sql);
    console.log('Realtime database triggers set up successfully!');
  } catch (err) {
    console.error('Error applying triggers:', err);
  } finally {
    await pool.end();
  }
}

apply();
