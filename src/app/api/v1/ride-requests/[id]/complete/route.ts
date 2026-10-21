import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// POST /api/v1/ride-requests/[id]/complete - Mark an accepted ride as completed and delete immediately
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;

    const check = await client.query(
      "SELECT * FROM ride_requests WHERE id = $1",
      [id]
    );

    if (check.rowCount === 0) {
      return NextResponse.json({ detail: "Ride request not found" }, { status: 404 });
    }

    const ride = check.rows[0];

    if (ride.status !== "taken" && ride.status !== "in_progress") {
      return NextResponse.json(
        { detail: `Only accepted rides can be marked as completed. Current status is ${ride.status}.` },
        { status: 400 }
      );
    }

    // Begin transaction for complete deletion
    await client.query("BEGIN");

    // 1. Explicitly purge all offers made on this ride
    await client.query("DELETE FROM ride_offers WHERE ride_id = $1", [id]);

    // 2. Delete the ride request itself
    const deleteRes = await client.query(
      `DELETE FROM ride_requests WHERE id = $1 RETURNING *`,
      [id]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Trip completed and immediately deleted from database along with all offers.",
      deleted_ride: deleteRes.rows[0],
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[API Error] Failed to complete and delete ride:", err);
    return NextResponse.json({ detail: err.message || "Failed to complete ride" }, { status: 500 });
  } finally {
    client.release();
  }
}
