import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import crypto from "crypto";

// POST /api/v1/ride-requests/[id]/offers - Driver or Rider submits a counter-offer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    // Rate limit: Max 20 counter offers per minute per IP
    const rateCheck = checkRateLimit(`offer:${ip}`, 20, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { detail: "Too many negotiation actions. Please slow down." },
        { status: 429 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const rideRes = await pool.query(`SELECT * FROM ride_requests WHERE id = $1`, [id]);
    if (rideRes.rows.length === 0) {
      return NextResponse.json({ detail: "Ride request not found" }, { status: 404 });
    }

    const ride = rideRes.rows[0];
    if (ride.status !== "open") {
      return NextResponse.json({ detail: "Offers can only be made on open rides." }, { status: 400 });
    }

    const offeredBy = body.offered_by === "rider" ? "rider" : "driver";
    const parentOfferId = body.parent_offer_id || null;

    if (offeredBy === "driver") {
      if (!body.driver_name?.trim() || !body.driver_contact?.trim()) {
        return NextResponse.json({ detail: "Driver name and contact are required." }, { status: 400 });
      }
      if (!body.vehicle_details?.trim()) {
        return NextResponse.json({ detail: "Vehicle details are required." }, { status: 400 });
      }
    }

    const counterFare = Number(body.counter_fare);
    if (isNaN(counterFare) || counterFare < 1) {
      return NextResponse.json({ detail: "Counter fare must be a valid amount." }, { status: 400 });
    }

    // If rider is countering back to an existing driver offer
    let driverName = body.driver_name?.trim();
    let driverContact = body.driver_contact?.trim();
    let vehicleDetails = body.vehicle_details?.trim();
    let paymentDetails = body.payment_details?.trim() || null;

    if (offeredBy === "rider" && parentOfferId) {
      const parentRes = await pool.query(`SELECT * FROM ride_offers WHERE id = $1`, [parentOfferId]);
      if (parentRes.rows.length > 0) {
        const parent = parentRes.rows[0];
        driverName = parent.driver_name;
        driverContact = parent.driver_contact;
        vehicleDetails = parent.vehicle_details;
        paymentDetails = parent.payment_details;
      }
    }

    const offerId = crypto.randomUUID();
    const cleanDriverPhone = driverContact ? driverContact.replace(/\D/g, "") : null;

    const insertRes = await pool.query(
      `INSERT INTO ride_offers (
        id, ride_id, driver_name, driver_contact, clean_driver_phone, vehicle_details,
        counter_fare, payment_details, message, offered_by, parent_offer_id,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW(), NOW())
      RETURNING *`,
      [
        offerId,
        id,
        driverName,
        driverContact,
        cleanDriverPhone,
        vehicleDetails,
        counterFare,
        paymentDetails,
        body.message?.trim() || null,
        offeredBy,
        parentOfferId,
      ]
    );

    const response = NextResponse.json(insertRes.rows[0], { status: 201 });
    if (offeredBy === "driver" && driverContact) {
      response.cookies.set("tripmate_driver_phone", driverContact, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
    return response;
  } catch (err: any) {
    console.error("[API Error] Failed to create ride offer:", err);
    return NextResponse.json({ detail: err.message || "Failed to submit counter offer" }, { status: 500 });
  }
}
