import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// POST /api/v1/ride-requests/[id]/offers/[offerId]/accept - Rider accepts driver's offer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  const client = await pool.connect();
  try {
    const { id, offerId } = await params;

    await client.query("BEGIN");

    // Atomic row lock
    const rideRes = await client.query(
      `SELECT * FROM ride_requests WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (rideRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ detail: "Ride request not found" }, { status: 404 });
    }

    const ride = rideRes.rows[0];
    if (ride.status !== "open") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { detail: `Ride is no longer open (current status: ${ride.status}).` },
        { status: 400 }
      );
    }

    const offerRes = await client.query(
      `SELECT * FROM ride_offers WHERE id = $1 AND ride_id = $2 FOR UPDATE`,
      [offerId, id]
    );

    if (offerRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ detail: "Offer not found." }, { status: 404 });
    }

    const offer = offerRes.rows[0];

    // Accept this offer
    await client.query(
      `UPDATE ride_offers SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
      [offerId]
    );

    // Decline any other pending offers
    await client.query(
      `UPDATE ride_offers SET status = 'declined', updated_at = NOW() WHERE ride_id = $1 AND id != $2 AND status = 'pending'`,
      [id, offerId]
    );

    // Update ride to taken with agreed counter fare and driver info
    const cleanDriverPhone = offer.driver_contact ? offer.driver_contact.replace(/\D/g, "") : null;

    const updateRideRes = await client.query(
      `UPDATE ride_requests
       SET status = 'taken',
           driver_name = $1,
           driver_contact = $2,
           clean_driver_phone = $3,
           vehicle_details = $4,
           fare_amount = $5,
           payment_details = $6,
           taken_at = NOW(),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        offer.driver_name,
        offer.driver_contact,
        cleanDriverPhone,
        offer.vehicle_details,
        offer.counter_fare,
        offer.payment_details,
        id,
      ]
    );

    await client.query("COMMIT");

    const allOffersRes = await pool.query(
      `SELECT * FROM ride_offers WHERE ride_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    const updatedRide = updateRideRes.rows[0];
    updatedRide.offers = allOffersRes.rows;

    return NextResponse.json(updatedRide);
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[API Error] Failed to accept counter offer:", err);
    return NextResponse.json({ detail: err.message || "Failed to accept offer" }, { status: 500 });
  } finally {
    client.release();
  }
}
