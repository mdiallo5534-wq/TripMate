import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// POST /api/v1/ride-requests/[id]/offers/[offerId]/decline
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  try {
    const { id, offerId } = await params;

    const offerRes = await pool.query(
      `SELECT * FROM ride_offers WHERE id = $1 AND ride_id = $2`,
      [offerId, id]
    );

    if (offerRes.rows.length === 0) {
      return NextResponse.json({ detail: "Offer not found." }, { status: 404 });
    }

    const updatedRes = await pool.query(
      `UPDATE ride_offers SET status = 'declined', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [offerId]
    );

    return NextResponse.json(updatedRes.rows[0]);
  } catch (err: any) {
    console.error("[API Error] Failed to decline offer:", err);
    return NextResponse.json({ detail: err.message || "Failed to decline offer" }, { status: 500 });
  }
}
