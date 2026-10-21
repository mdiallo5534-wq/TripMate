import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// POST /api/v1/ride-requests/[id]/reopen - Repost a taken ride back to open so another driver can accept
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const check = await pool.query("SELECT * FROM ride_requests WHERE id = $1", [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ detail: "Ride request not found" }, { status: 404 });
    }

    const ride = check.rows[0];

    if (ride.status === "completed") {
      return NextResponse.json({ detail: "Cannot reopen a completed ride" }, { status: 400 });
    }

    if (ride.status === "cancelled") {
      return NextResponse.json({ detail: "Cannot reopen a cancelled ride" }, { status: 400 });
    }

    // Reset status to open and clear previous driver details
    const result = await pool.query(
      `UPDATE ride_requests
       SET status = 'open',
           driver_name = NULL,
           driver_contact = NULL,
           clean_driver_phone = NULL,
           vehicle_details = NULL,
           payment_details = NULL,
           taken_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Also mark any existing accepted offer back to pending or decline
    await pool.query(
      `UPDATE ride_offers
       SET status = 'declined', updated_at = NOW()
       WHERE ride_id = $1 AND status = 'accepted'`,
      [id]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error("[API Error] Failed to reopen ride:", err);
    return NextResponse.json({ detail: err.message || "Failed to reopen ride" }, { status: 500 });
  }
}
