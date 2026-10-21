import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/v1/ride-requests/open - Open KL rides for the driver board
export async function GET(req: NextRequest) {
  try {
    // Auto-expire open rides scheduled in the past (> 30 mins ago)
    await pool.query(`
      UPDATE ride_requests
      SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
      WHERE status = 'open' AND scheduled_at < (NOW() - INTERVAL '30 minutes')
    `);

    const query = `
      SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', o.id,
              'ride_id', o.ride_id,
              'driver_name', o.driver_name,
              'driver_contact', o.driver_contact,
              'vehicle_details', o.vehicle_details,
              'counter_fare', o.counter_fare,
              'payment_details', o.payment_details,
              'message', o.message,
              'offered_by', o.offered_by,
              'parent_offer_id', o.parent_offer_id,
              'status', o.status,
              'created_at', o.created_at
            )
          ) FILTER (WHERE o.id IS NOT NULL), '[]'
        ) as offers
      FROM ride_requests r
      LEFT JOIN ride_offers o ON o.ride_id = r.id
      WHERE LOWER(r.city) = 'kuala lumpur' AND r.status = 'open'
      GROUP BY r.id
      ORDER BY r.scheduled_at ASC
    `;

    const result = await pool.query(query);
    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error("[API Error] Failed to fetch open rides:", err);
    return NextResponse.json({ detail: err.message || "Failed to fetch open rides" }, { status: 500 });
  }
}
