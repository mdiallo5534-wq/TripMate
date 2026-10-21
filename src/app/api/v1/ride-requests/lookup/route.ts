import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/v1/ride-requests/lookup?phone=012-XXXXXXX
// Only returns ACTIVE rides (open, taken, in_progress) - completed/cancelled are not tracked
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone")?.trim();

    if (!phone) {
      return NextResponse.json({ detail: "Phone number is required" }, { status: 400 });
    }

    // Strip non-digits for indexed B-Tree match
    const cleanPhone = phone.replace(/\D/g, "");

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
      WHERE (r.clean_rider_phone = $1 OR r.clean_rider_phone LIKE '%' || $1 || '%')
        AND r.status IN ('open', 'taken', 'in_progress')
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [cleanPhone]);

    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error("[API Error] Failed to lookup ride by phone:", err);
    return NextResponse.json({ detail: err.message || "Failed to lookup ride" }, { status: 500 });
  }
}
