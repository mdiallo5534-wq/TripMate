import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// POST /api/v1/ride-requests/[id]/cancel
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
      return NextResponse.json({ detail: "Cannot cancel a completed ride" }, { status: 400 });
    }

    if (ride.status === "cancelled") {
      return NextResponse.json({ detail: "Ride is already cancelled" }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE ride_requests
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Also mark any pending offers as declined/cancelled
    await pool.query(
      `UPDATE ride_offers
       SET status = 'declined', updated_at = NOW()
       WHERE ride_id = $1 AND status = 'pending'`,
      [id]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error("[API Error] Failed to cancel ride:", err);
    return NextResponse.json({ detail: err.message || "Failed to cancel ride" }, { status: 500 });
  }
}
