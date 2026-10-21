import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/v1/ride-requests/driver?phone=012-XXXXXXX - Get accepted rides and active offers for a driver
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let phone = searchParams.get("phone")?.trim();

    // Fallback to cookie if no query param provided
    if (!phone) {
      phone = req.cookies.get("tripmate_driver_phone")?.value || "";
    }

    if (!phone) {
      return NextResponse.json({ accepted_rides: [], my_offers: [] });
    }

    const cleanPhone = phone.replace(/\D/g, "");

    // 1. Rides assigned to this driver (Uses idx_ride_requests_clean_driver_phone_status)
    const acceptedQuery = `
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
      WHERE (r.clean_driver_phone = $1 OR r.clean_driver_phone LIKE '%' || $1 || '%')
        AND r.status IN ('taken', 'completed')
      GROUP BY r.id
      ORDER BY r.updated_at DESC
      LIMIT 20
    `;

    // 2. Open rides where this driver submitted an offer that's still pending (Uses idx_ride_offers_clean_driver_phone_status)
    const offersQuery = `
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
      INNER JOIN ride_offers o ON o.ride_id = r.id
      WHERE (o.clean_driver_phone = $1 OR o.clean_driver_phone LIKE '%' || $1 || '%')
        AND r.status = 'open'
        AND o.status = 'pending'
      GROUP BY r.id
      ORDER BY r.scheduled_at ASC
    `;

    const [acceptedRes, offersRes] = await Promise.all([
      pool.query(acceptedQuery, [cleanPhone]),
      pool.query(offersQuery, [cleanPhone]),
    ]);

    return NextResponse.json({
      driver_phone: phone,
      accepted_rides: acceptedRes.rows,
      my_offers: offersRes.rows,
    });
  } catch (err: any) {
    console.error("[API Error] Failed to get driver rides:", err);
    return NextResponse.json({ detail: err.message || "Failed to fetch driver rides" }, { status: 500 });
  }
}
