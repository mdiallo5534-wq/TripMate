"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchApi, RideRequest } from "@/lib/api";
import {
  MapPin, Calendar, Clock, Users, ArrowRight, ShieldCheck,
  CreditCard, CheckCircle2, AlertCircle, ArrowLeft, Info, Phone, User, Zap
} from "lucide-react";

export default function RequestRidePage() {
  const router = useRouter();

  const [riderName, setRiderName] = useState("");
  const [riderContact, setRiderContact] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupMode, setPickupMode] = useState<"now" | "custom">("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [passengerCount, setPassengerCount] = useState<number | string>(1);
  const [fareAmount, setFareAmount] = useState<number | string>(0);
  const [paymentMethod, setPaymentMethod] = useState("Any (Cash, TNG, or Bank)");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRide, setCreatedRide] = useState<RideRequest | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!riderName.trim() || !riderContact.trim()) {
        throw new Error("Please enter your name and phone number.");
      }

      if (!pickup.trim()) {
        throw new Error("Please enter your KL pickup spot.");
      }

      if (!dropoff.trim()) {
        throw new Error("Please enter your KL destination spot.");
      }

      const pCount = Number(passengerCount);
      if (isNaN(pCount) || pCount < 1) {
        throw new Error("Please enter a valid passenger count (at least 1).");
      }

      const fAmount = Number(fareAmount);
      if (isNaN(fAmount) || fAmount < 1) {
        throw new Error("Please enter a valid fare offer amount.");
      }

      let scheduledDt: Date;
      if (pickupMode === "now") {
        // Add 2-minute buffer so backend future-time validation passes
        scheduledDt = new Date(Date.now() + 2 * 60 * 1000);
      } else {
        if (!date || !time) {
          throw new Error("Please specify pickup date and time.");
        }
        scheduledDt = new Date(`${date}T${time}:00`);
        if (scheduledDt <= new Date()) {
          throw new Error("Pickup time must be set in the future.");
        }
      }

      const newRide = await fetchApi<RideRequest>("/ride-requests", {
        method: "POST",
        body: JSON.stringify({
          rider_name: riderName.trim(),
          rider_contact: riderContact.trim(),
          city: "Kuala Lumpur",
          pickup_location: pickup.trim(),
          dropoff_location: dropoff.trim(),
          scheduled_at: scheduledDt.toISOString(),
          passenger_count: pCount,
          fare_amount: fAmount,
          payment_method_preference: paymentMethod,
          notes: notes.trim() || undefined
        })
      });

      // Persist phone so Rider Board pre-loads this ride automatically
      try {
        localStorage.setItem("tripmate_rider_phone", riderContact.trim());
      } catch {}

      setCreatedRide(newRide);
    } catch (err: any) {
      setError(err.message || "Failed to create ride request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ padding: "2.5rem 1.25rem", maxWidth: "800px" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--color-secondary-text)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <div className="card" style={{ padding: "2.5rem" }}>
        {/* Header with strict KL badge */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span className="badge badge-carpool" style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem" }}>
              <MapPin size={14} /> Kuala Lumpur Exclusive
            </span>
            <span className="badge badge-warning" style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem" }}>
              Direct TNG / Bank Transfer
            </span>
          </div>

          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--color-dark-navy)", marginBottom: "0.4rem" }}>
            Order a Ride in Kuala Lumpur
          </h1>
          <p style={{ color: "var(--color-secondary-text)", fontSize: "0.95rem" }}>
            No account or signup needed. Enter your details below and drivers across KL can accept your ride request.
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "var(--color-error)",
            padding: "0.85rem",
            borderRadius: "var(--radius-md)",
            fontSize: "0.88rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {createdRide ? (
          /* Live Status Card */
          <div style={{
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "var(--radius-lg)",
            padding: "2rem",
            textAlign: "center"
          }}>
            <CheckCircle2 size={48} color="var(--color-success)" style={{ margin: "0 auto 1rem auto" }} />
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#166534", marginBottom: "0.5rem" }}>
              Ride Request Broadcast to KL Drivers!
            </h2>
            <p style={{ color: "var(--color-secondary-text)", maxWidth: "520px", margin: "0 auto 1.5rem auto", fontSize: "0.95rem" }}>
              Your ride from <strong>{createdRide.pickup_location}</strong> to <strong>{createdRide.dropoff_location}</strong> is live. The first driver to accept will lock it as <strong>Taken</strong>.
            </p>

            <div className="card" style={{ maxWidth: "420px", margin: "0 auto 1.5rem auto", textAlign: "left", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--color-secondary-text)" }}>Rider Name:</span>
                <strong>{createdRide.rider_name}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--color-secondary-text)" }}>Phone / WhatsApp:</span>
                <strong>{createdRide.rider_contact}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--color-secondary-text)" }}>Offered Fare:</span>
                <strong style={{ color: "var(--color-primary)" }}>RM {createdRide.fare_amount.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--color-secondary-text)" }}>Payment Method:</span>
                <strong>{createdRide.payment_method_preference}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/rider-board" className="btn btn-primary">
                View Live Status
              </Link>
              <button onClick={() => setCreatedRide(null)} className="btn btn-outline">
                Order Another Ride
              </button>
            </div>
          </div>
        ) : (
          /* Request Form */
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Direct Off-Platform Payment Disclaimer Notice */}
            <div style={{
              backgroundColor: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: "var(--radius-md)",
              padding: "1rem",
              display: "flex",
              gap: "0.75rem",
              fontSize: "0.85rem",
              color: "#1E40AF",
              lineHeight: 1.5
            }}>
              <Info size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Direct Off-Platform Payment (Cash / Touch &apos;n Go / Bank Transfer):</strong>
                <p style={{ marginTop: "2px" }}>
                  Pay your driver directly via <strong>Cash</strong>, <strong>Touch &apos;n Go eWallet</strong>, or <strong>DuitNow Malaysian Bank Transfer</strong>. No bank card details or transactions are processed inside the website.
                </p>
              </div>
            </div>

            {/* Rider Identity Fields (No Login Required) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  <User size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Your Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah / Farhan"
                  className="input-field"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  <Phone size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 012-3456789"
                  className="input-field"
                  value={riderContact}
                  onChange={(e) => setRiderContact(e.target.value)}
                />
              </div>
            </div>

            {/* Pickup & Dropoff Spots in KL */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  <MapPin size={14} style={{ display: "inline", verticalAlign: "middle" }} /> KL Pickup Spot
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KL Sentral Departure Gate / Bangsar South"
                  className="input-field"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  <MapPin size={14} style={{ display: "inline", verticalAlign: "middle" }} /> KL Destination Spot
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suria KLCC / Mid Valley Megamall"
                  className="input-field"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                />
              </div>
            </div>

            {/* Pickup Time: Now vs Custom Toggle */}
            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.6rem" }}>
                <Clock size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Pickup Time
              </label>

              {/* Toggle buttons */}
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.85rem" }}>
                <button
                  type="button"
                  onClick={() => setPickupMode("now")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: pickupMode === "now"
                      ? "2px solid var(--color-primary)"
                      : "2px solid var(--color-border)",
                    backgroundColor: pickupMode === "now" ? "#EFF6FF" : "var(--color-white)",
                    color: pickupMode === "now" ? "var(--color-primary)" : "var(--color-secondary-text)",
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Zap size={15} />
                  Now
                </button>

                <button
                  type="button"
                  onClick={() => setPickupMode("custom")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: pickupMode === "custom"
                      ? "2px solid var(--color-primary)"
                      : "2px solid var(--color-border)",
                    backgroundColor: pickupMode === "custom" ? "#EFF6FF" : "var(--color-white)",
                    color: pickupMode === "custom" ? "var(--color-primary)" : "var(--color-secondary-text)",
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Calendar size={15} />
                  Schedule for Later
                </button>
              </div>

              {pickupMode === "custom" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem", color: "var(--color-secondary-text)" }}>
                      Pickup Date
                    </label>
                    <input
                      type="date"
                      required={pickupMode === "custom"}
                      className="input-field"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem", color: "var(--color-secondary-text)" }}>
                      Pickup Time (MYT)
                    </label>
                    <input
                      type="time"
                      required={pickupMode === "custom"}
                      className="input-field"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Passengers & Off-Platform Payment */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  <Users size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Passengers
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  placeholder="e.g. 1"
                  className="input-field"
                  value={passengerCount}
                  onChange={(e) => setPassengerCount(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  Fare Offer (RM)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  placeholder="0"
                  className="input-field"
                  value={fareAmount}
                  onChange={(e) => setFareAmount(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  Payment By
                </label>
                <select
                  className="input-field"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Any (Cash, TNG, or Bank)">Any (Cash, TNG, or Bank)</option>
                  <option value="Cash">Cash</option>
                  <option value="TNG eWallet">Touch &apos;n Go (TNG)</option>
                  <option value="DuitNow Bank Transfer">DuitNow / Bank Transfer</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                Special Notes for Driver (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Waiting at Hilton lobby with 1 small suitcase. Ready upon arrival."
                className="input-field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ padding: "0.95rem", fontSize: "1.05rem", fontWeight: 700, marginTop: "0.5rem" }}
            >
              {submitting ? "Broadcasting Request..." : "Request Ride in Kuala Lumpur"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
