import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import crypto from "crypto";

// GET /api/v1/ride-requests - List all rides (with optional status & city filter)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city") || "Kuala Lumpur";
    const status = searchParams.get("status");

    let query = `
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
      WHERE LOWER(r.city) = LOWER($1)
    `;
    const params: any[] = [city];

    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }

    query += ` GROUP BY r.id ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error("[API Error] Failed to list ride requests:", err);
    return NextResponse.json({ detail: err.message || "Failed to fetch ride requests" }, { status: 500 });
  }
}

// POST /api/v1/ride-requests - Create a new public ride request
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Rate limit: Max 10 ride requests per minute per IP
    const rateCheck = checkRateLimit(`create-ride:${ip}`, 10, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { detail: "Too many ride requests. Please wait a moment before trying again." },
        { status: 429 }
      );
    }

    const body = await req.json();

    const city = (body.city || "Kuala Lumpur").trim();
    if (city.toLowerCase() !== "kuala lumpur") {
      return NextResponse.json(
        { detail: "TripMate currently operates exclusively within Kuala Lumpur. Other locations are not supported." },
        { status: 400 }
      );
    }

    if (!body.rider_name?.trim() || !body.rider_contact?.trim()) {
      return NextResponse.json({ detail: "Rider name and contact are required." }, { status: 400 });
    }

    if (!body.pickup_location?.trim() || !body.dropoff_location?.trim()) {
      return NextResponse.json({ detail: "Pickup and dropoff locations are required." }, { status: 400 });
    }

    const scheduledDate = new Date(body.scheduled_at);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return NextResponse.json({ detail: "Scheduled pickup time must be in the future." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const cleanRiderPhone = body.rider_contact.replace(/\D/g, "");

    const query = `
      INSERT INTO ride_requests (
        id, rider_name, rider_contact, clean_rider_phone, city, pickup_location, dropoff_location,
        scheduled_at, passenger_count, fare_amount, currency,
        payment_method_preference, notes, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, 'open', NOW(), NOW()
      )
      RETURNING *
    `;

    const values = [
      id,
      body.rider_name.trim(),
      body.rider_contact.trim(),
      cleanRiderPhone,
      "Kuala Lumpur",
      body.pickup_location.trim(),
      body.dropoff_location.trim(),
      scheduledDate.toISOString(),
      Number(body.passenger_count) || 1,
      Number(body.fare_amount) || 0.0,
      body.currency || "MYR",
      body.payment_method_preference || "TNG eWallet",
      body.notes?.trim() || null,
    ];

    const result = await pool.query(query, values);
    const row = result.rows[0];
    row.offers = [];

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    console.error("[API Error] Failed to create ride request:", err);
    return NextResponse.json({ detail: err.message || "Failed to create ride request" }, { status: 500 });
  }
}
