import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// POST /api/v1/ride-requests/[id]/accept - Direct accept ride by driver
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.driver_name?.trim() || !body.driver_contact?.trim()) {
      return NextResponse.json(
        { detail: "Driver name and contact are required." },
        { status: 400 }
      );
    }
    if (!body.vehicle_details?.trim()) {
      return NextResponse.json(
        { detail: "Vehicle details are required." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // Atomic row lock
    const checkRes = await client.query(
      `SELECT * FROM ride_requests WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ detail: "Ride request not found" }, { status: 404 });
    }

    const current = checkRes.rows[0];
    if (current.status !== "open") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { detail: `Ride is no longer open. Current status is ${current.status}.` },
        { status: 409 }
      );
    }

    const cleanDriverPhone = body.driver_contact.replace(/\D/g, "");

    const updateRes = await client.query(
      `UPDATE ride_requests 
       SET status = 'taken',
           driver_name = $1,
           driver_contact = $2,
           clean_driver_phone = $3,
           vehicle_details = $4,
           payment_details = $5,
           taken_at = NOW(),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        body.driver_name.trim(),
        body.driver_contact.trim(),
        cleanDriverPhone,
        body.vehicle_details.trim(),
        body.payment_details?.trim() || null,
        id,
      ]
    );

    // Auto-decline any pending offers on this ride
    await client.query(
      `UPDATE ride_offers SET status = 'declined', updated_at = NOW() WHERE ride_id = $1 AND status = 'pending'`,
      [id]
    );

    await client.query("COMMIT");

    const offersRes = await pool.query(
      `SELECT * FROM ride_offers WHERE ride_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    const updatedRide = updateRes.rows[0];
    updatedRide.offers = offersRes.rows;

    const response = NextResponse.json(updatedRide);
    if (body.driver_contact) {
      response.cookies.set("tripmate_driver_phone", body.driver_contact.trim(), {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
    }
    return response;
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[API Error] Failed to accept ride:", err);
    return NextResponse.json(
      { detail: err.message || "Failed to accept ride" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
