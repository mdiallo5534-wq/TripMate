"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { fetchApi, RideRequest, RideOffer } from "@/lib/api";
import {
  MapPin, Phone, Search, RefreshCw, CheckCircle2, Clock,
  AlertCircle, ArrowRight, Calendar, Users, Hourglass,
  ClipboardList, ArrowLeft, DollarSign, Bell, X, MessageCircle, Send, Ban, UserCheck, RotateCcw
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  open:        { label: "OPEN – Waiting for Driver",    color: "var(--color-primary)", badgeClass: "badge-carpool" },
  taken:       { label: "TAKEN – Driver Confirmed",     color: "var(--color-success)", badgeClass: "badge-verified" },
  in_progress: { label: "IN PROGRESS",                  color: "var(--color-success)", badgeClass: "badge-verified" },
};

function statusIcon(status: string) {
  switch (status) {
    case "open":        return <Hourglass size={14} />;
    case "taken":
    case "in_progress": return <CheckCircle2 size={14} />;
    default:            return null;
  }
}

function toE164(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    clean = "60" + clean.substring(1);
  } else if (!clean.startsWith("60") && clean.length >= 9) {
    clean = "60" + clean;
  }
  return clean;
}

function formatTelegramUrl(phone: string): string {
  return `https://t.me/+${toE164(phone)}`;
}

const ACTIVE_STATUSES = ["open", "taken", "in_progress"];
const LS_KEY = "tripmate_rider_phone";

export default function RiderBoardPage() {
  const [phone, setPhone]             = useState("");
  const [submitted, setSubmitted]     = useState(false);
  const [results, setResults]         = useState<RideRequest[] | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reopeningId, setReopeningId]   = useState<string | null>(null);

  const handleCancelOrder = async (rideId: string) => {
    if (!confirm("Are you sure you want to cancel this ride request?")) return;
    setCancellingId(rideId);
    setError(null);
    try {
      await fetchApi(`/ride-requests/${rideId}/cancel`, {
        method: "POST"
      });
      // Immediately remove from active rides list
      setResults((prev) => (prev ? prev.filter((r) => r.id !== rideId) : []));
      setSuccessMsg("Your ride request has been cancelled.");
    } catch (err: any) {
      setError(err.message || "Failed to cancel ride request.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleFindAnotherDriver = async (rideId: string) => {
    if (!confirm("Release the current driver and repost your ride request to the Kuala Lumpur Driver Board so another driver can accept?")) return;
    setReopeningId(rideId);
    setError(null);
    try {
      await fetchApi(`/ride-requests/${rideId}/reopen`, {
        method: "POST"
      });
      setSuccessMsg("Your ride has been reposted to the Driver Board for other drivers to accept!");
      const currentPhone = activePhoneRef.current || (typeof window !== "undefined" ? localStorage.getItem(LS_KEY) || "" : "");
      if (currentPhone) {
        refreshActiveRides(currentPhone);
      }
    } catch (err: any) {
      setError(err.message || "Failed to repost ride.");
    } finally {
      setReopeningId(null);
    }
  };

  // Active negotiation popup modal state
  const [negotiatingData, setNegotiatingData] = useState<{
    ride: RideRequest;
    offer: RideOffer;
  } | null>(null);

  // Keep a stable ref to active phone for background real-time updates
  const activePhoneRef = useRef(phone);
  activePhoneRef.current = phone;

  // Background fetch without showing full page loader / spinner
  const refreshActiveRides = useCallback(async (targetPhone?: string) => {
    const q = (targetPhone || activePhoneRef.current).trim();
    if (!q) return;

    try {
      const data = await fetchApi<RideRequest[]>(
        `/ride-requests/lookup?phone=${encodeURIComponent(q)}`
      );
      const filtered = (data || []).filter(r => ACTIVE_STATUSES.includes(r.status));
      setResults(filtered);
      setError(null);
    } catch {
      // Background sync errors are suppressed to prevent interrupting user
    }
  }, []);

  // Explicit user-triggered fetch with spinner
  const fetchRides = useCallback(async (phoneOverride?: string) => {
    const q = (phoneOverride ?? phone).trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setSubmitted(true);

    try {
      localStorage.setItem(LS_KEY, q);
      const data = await fetchApi<RideRequest[]>(
        `/ride-requests/lookup?phone=${encodeURIComponent(q)}`
      );
      const filtered = (data || []).filter(r => ACTIVE_STATUSES.includes(r.status));
      setResults(filtered);
    } catch (err: any) {
      setError(err.message || "Failed to search. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  // Pre-fill from localStorage on mount and auto-load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        setPhone(saved);
        activePhoneRef.current = saved;
        fetchRides(saved);
      }
    } catch {}
  }, [fetchRides]);

  // Automatic, resilient real-time synchronization via SSE
  useEffect(() => {
    let sse: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        sse = new EventSource("/api/v1/realtime");

        sse.addEventListener("db_change", (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.table === "ride_requests" || payload.table === "ride_offers") {
              // Immediately update state in the background without refreshing the page
              const currentPhone = activePhoneRef.current || (typeof window !== "undefined" ? localStorage.getItem(LS_KEY) || "" : "");
              if (currentPhone) {
                refreshActiveRides(currentPhone);
              }
            }
          } catch {}
        });

        sse.onerror = () => {
          if (sse) sse.close();
          // Auto-reconnect with backoff to guarantee persistent real-time updates
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch {
        reconnectTimer = setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      if (sse) sse.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [refreshActiveRides]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRides();
  };

  const activeRides = results ?? [];

  // Count pending driver counter-offers across all active rides
  const totalDriverOffers = activeRides.reduce((acc, r) => {
    const driverOffers = r.offers?.filter(o => o.status === "pending" && o.offered_by === "driver") || [];
    return acc + driverOffers.length;
  }, 0);

  return (
    <div className="container" style={{ padding: "2.5rem 1.25rem", maxWidth: "860px" }}>
      <Link
        href="/"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--color-secondary-text)", marginBottom: "1.5rem", fontSize: "0.9rem" }}
      >
        <ArrowLeft size={16} /> Back to Home
      </Link>

      {/* Page Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <span className="badge badge-carpool" style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem" }}>
            <MapPin size={14} /> Kuala Lumpur Active Board
          </span>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.8rem",
            color: "var(--alert-success-text)",
            backgroundColor: "var(--alert-success-bg)",
            border: "1px solid var(--alert-success-border)",
            padding: "0.25rem 0.65rem",
            borderRadius: "9999px"
          }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "var(--color-success)" }}></span>
            Automatic Real-time Sync (Live)
          </span>
        </div>
        <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--color-dark-navy)", marginBottom: "0.4rem" }}>
          Rider Board
        </h1>
        <p style={{ color: "var(--color-secondary-text)", fontSize: "0.95rem", maxWidth: "560px" }}>
          Track your active ride requests in Kuala Lumpur. Live updates show driver offers and negotiations automatically. Completed trips are automatically cleared.
        </p>
      </div>

      {/* Phone Search Card */}
      <div className="card" style={{ padding: "1.75rem", marginBottom: "1.5rem" }}>
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            <Phone size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
            Your Phone / WhatsApp Number
          </label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input
              type="tel"
              required
              placeholder="e.g. 012-3456789"
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ flex: 1, minWidth: "200px" }}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, padding: "0.65rem 1.4rem" }}
            >
              {loading ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={15} />}
              {loading ? "Searching..." : "Track My Active Rides"}
            </button>
          </div>
        </form>
      </div>

      {/* Top Negotiation Notification Banner */}
      {totalDriverOffers > 0 && (
        <div style={{
          backgroundColor: "var(--alert-warning-bg)",
          border: "2px solid var(--alert-warning-border)",
          borderRadius: "var(--radius-lg)",
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              backgroundColor: "var(--color-warning)",
              color: "#FFFFFF",
              padding: "0.5rem",
              borderRadius: "var(--radius-full)",
              display: "flex"
            }}>
              <Bell size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "var(--alert-warning-text)", fontSize: "1rem" }}>
                ⚡ You have {totalDriverOffers} Driver Negotiation {totalDriverOffers === 1 ? "Offer" : "Offers"}!
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--color-secondary-text)" }}>
                Drivers are offering alternative fares. Click &ldquo;Review &amp; Accept Offer&rdquo; below to respond immediately.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: "var(--alert-error-bg)",
          border: "1px solid var(--alert-error-border)",
          color: "var(--alert-error-text)",
          padding: "0.85rem 1rem",
          borderRadius: "var(--radius-md)",
          fontSize: "0.88rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Success Message */}
      {successMsg && (
        <div style={{
          backgroundColor: "var(--alert-success-bg)",
          border: "1px solid var(--alert-success-border)",
          color: "var(--alert-success-text)",
          padding: "0.85rem 1rem",
          borderRadius: "var(--radius-md)",
          fontSize: "0.88rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle2 size={18} /> {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Results */}
      {submitted && !loading && results !== null && (
        <>
          {activeRides.length === 0 ? (
            <div className="card" style={{ padding: "4rem 2rem", textAlign: "center" }}>
              <ClipboardList size={40} color="var(--color-secondary-text)" style={{ margin: "0 auto 1rem auto" }} />
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                No active rides found for this number
              </h3>
              <p style={{ color: "var(--color-secondary-text)", fontSize: "0.9rem", maxWidth: "420px", margin: "0 auto 1.5rem auto" }}>
                You have no active rides in progress. Past completed rides are automatically cleared from the system.
              </p>
              <Link href="/request-ride" className="btn btn-primary">
                Order a Ride in KL <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-dark-navy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "var(--color-success)", display: "inline-block" }}></span>
                  Active Rides ({activeRides.length})
                </h2>
                <button
                  onClick={() => fetchRides()}
                  className="btn btn-outline"
                  style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {activeRides.map(ride => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    onOpenNegotiation={(offer) => setNegotiatingData({ ride, offer })}
                    onCancelOrder={() => handleCancelOrder(ride.id)}
                    onFindAnotherDriver={() => handleFindAnotherDriver(ride.id)}
                    cancelling={cancellingId === ride.id}
                    reopening={reopeningId === ride.id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* CTA if no search yet */}
      {!submitted && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-secondary-text)" }}>
          <ClipboardList size={44} style={{ margin: "0 auto 1rem auto", opacity: 0.4 }} />
          <p style={{ fontSize: "0.95rem", marginBottom: "1.25rem" }}>
            Enter your phone number above to see your active rides and driver offers.
          </p>
          <Link href="/request-ride" className="btn btn-primary">
            Order a New Ride in KL <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Rider Negotiation Popup Modal */}
      {negotiatingData && (
        <RiderNegotiationModal
          ride={negotiatingData.ride}
          offer={negotiatingData.offer}
          onClose={() => setNegotiatingData(null)}
          onSuccess={() => {
            setNegotiatingData(null);
            refreshActiveRides();
          }}
        />
      )}
    </div>
  );
}

// ─── Ride Card ─────────────────────────────────────────────────────────────

function RideCard({
  ride,
  onOpenNegotiation,
  onCancelOrder,
  onFindAnotherDriver,
  cancelling,
  reopening
}: {
  ride: RideRequest;
  onOpenNegotiation: (offer: RideOffer) => void;
  onCancelOrder: () => void;
  onFindAnotherDriver: () => void;
  cancelling: boolean;
  reopening: boolean;
}) {
  const sched = new Date(ride.scheduled_at);
  const cfg = STATUS_CONFIG[ride.status] ?? STATUS_CONFIG.open;

  const isTaken = ride.status === "taken" || ride.status === "in_progress";
  const waUrl = isTaken && ride.driver_contact ? `https://wa.me/${toE164(ride.driver_contact)}?text=${encodeURIComponent(
    `Hi ${ride.driver_name}! I'm ${ride.rider_name}, your passenger. Regarding our ride from ${ride.pickup_location} to ${ride.dropoff_location} for RM ${Number(ride.fare_amount).toFixed(2)} (${ride.payment_method_preference}):`
  )}` : "";
  const tgUrl = isTaken && ride.driver_contact ? formatTelegramUrl(ride.driver_contact) : "";

  // Pending driver counter-offers on this ride
  const pendingDriverOffers = ride.offers?.filter(
    (o) => o.status === "pending" && o.offered_by === "driver"
  ) || [];

  return (
    <div
      className="card"
      style={{
        padding: "1.5rem",
        border: pendingDriverOffers.length > 0 ? "2px solid var(--color-warning)" : "1px solid var(--color-border)",
        transition: "box-shadow 0.15s"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "0.85rem" }}>
        <div style={{ flex: 1 }}>
          {/* Status badge & alert tag */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <span className={`badge ${cfg.badgeClass}`}>
              {statusIcon(ride.status)}
              {cfg.label}
            </span>

            {pendingDriverOffers.length > 0 && (
              <span className="badge badge-warning" style={{ fontWeight: 800 }}>
                <DollarSign size={13} /> {pendingDriverOffers.length} Driver Negotiation {pendingDriverOffers.length === 1 ? "Offer" : "Offers"}
              </span>
            )}
          </div>

          {/* Route */}
          <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-dark-navy)", marginBottom: "0.3rem" }}>
            {ride.pickup_location} &rarr; {ride.dropoff_location}
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.82rem", color: "var(--color-secondary-text)", marginTop: "0.2rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Calendar size={13} />
              {sched.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Clock size={13} />
              {sched.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Users size={13} />
              {ride.passenger_count} {ride.passenger_count === 1 ? "passenger" : "passengers"}
            </span>
          </div>

          {/* Driver info (if taken) */}
          {isTaken && ride.driver_name && (
            <div style={{
              marginTop: "0.75rem",
              padding: "0.6rem 0.85rem",
              backgroundColor: "var(--alert-success-bg)",
              border: "1px solid var(--alert-success-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              color: "var(--color-dark-navy)"
            }}>
              <strong>Driver:</strong> {ride.driver_name} &bull; {ride.driver_contact}
              {ride.vehicle_details && <> &bull; {ride.vehicle_details}</>}
            </div>
          )}
        </div>

        {/* Fare display */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-primary)" }}>
            RM {Number(ride.fare_amount).toFixed(2)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-secondary-text)" }}>
            {ride.payment_method_preference}
          </div>
        </div>
      </div>

      {/* Driver Counter-Offer Negotiation Banner on Ride Card */}
      {pendingDriverOffers.length > 0 && (
        <div style={{
          backgroundColor: "var(--alert-warning-bg)",
          border: "1px solid var(--alert-warning-border)",
          borderRadius: "var(--radius-md)",
          padding: "0.85rem 1rem",
          marginTop: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ fontWeight: 800, color: "var(--alert-warning-text)", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <DollarSign size={16} /> Driver Proposed Fare Negotiation:
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pendingDriverOffers.map((offer) => (
              <div
                key={offer.id}
                style={{
                  backgroundColor: "var(--color-white)",
                  border: "1px solid var(--color-border)",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.85rem",
                  color: "var(--color-dark-navy)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem"
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {offer.driver_name} <span style={{ fontWeight: 500, color: "var(--color-secondary-text)", fontSize: "0.8rem" }}>({offer.vehicle_details || "Vehicle"})</span>
                  </div>
                  {offer.message && (
                    <div style={{ fontStyle: "italic", fontSize: "0.82rem", color: "var(--color-secondary-text)", marginTop: "2px" }}>
                      &ldquo;{offer.message}&rdquo;
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ fontWeight: 800, color: "var(--color-warning)", fontSize: "1.1rem" }}>
                    RM {Number(offer.counter_fare).toFixed(2)}
                  </div>
                  <button
                    onClick={() => onOpenNegotiation(offer)}
                    className="btn btn-primary"
                    style={{
                      fontSize: "0.82rem",
                      padding: "0.4rem 0.85rem",
                      backgroundColor: "var(--color-warning)",
                      borderColor: "var(--color-warning)",
                      fontWeight: 700
                    }}
                  >
                    Review &amp; Accept Offer &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons: Chat Driver, Find Another Driver, Cancel My Order */}
      <div style={{
        marginTop: "1rem",
        paddingTop: "0.85rem",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.6rem"
      }}>
        {/* Left: Communication Buttons (when driver assigned) */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {isTaken && (
            <>
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{
                  backgroundColor: "#25D366",
                  borderColor: "#25D366",
                  color: "white",
                  fontSize: "0.82rem",
                  padding: "0.4rem 0.85rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                <Phone size={14} /> Chat Driver (WhatsApp)
              </a>

              <a
                href={tgUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{
                  backgroundColor: "#229ED9",
                  borderColor: "#229ED9",
                  color: "white",
                  fontSize: "0.82rem",
                  padding: "0.4rem 0.85rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                <MessageCircle size={14} /> Chat Driver (Telegram)
              </a>
            </>
          )}
        </div>

        {/* Right: Driver Reassignment & Order Cancellation */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {isTaken && (
            <button
              onClick={onFindAnotherDriver}
              disabled={reopening}
              className="btn btn-outline"
              title="Release current driver and repost this order back to the Driver Board"
              style={{
                fontSize: "0.82rem",
                padding: "0.4rem 0.85rem",
                fontWeight: 600,
                color: "var(--color-primary)",
                borderColor: "var(--color-primary)"
              }}
            >
              <RotateCcw size={14} /> {reopening ? "Reposting..." : "Find Another Driver"}
            </button>
          )}

          <button
            onClick={onCancelOrder}
            disabled={cancelling}
            className="btn btn-outline"
            style={{
              fontSize: "0.82rem",
              padding: "0.4rem 0.85rem",
              fontWeight: 600,
              color: "var(--color-error)",
              borderColor: "var(--color-error)"
            }}
          >
            <Ban size={14} /> {cancelling ? "Cancelling..." : "Cancel My Order"}
          </button>
        </div>
      </div>

      {/* Notes */}
      {ride.notes && (
        <div style={{ fontSize: "0.82rem", color: "var(--color-secondary-text)", borderTop: "1px solid var(--color-border)", paddingTop: "0.5rem", marginTop: "0.65rem", fontStyle: "italic" }}>
          Note: &ldquo;{ride.notes}&rdquo;
        </div>
      )}
    </div>
  );
}

// ─── Rider Negotiation Popup Modal ─────────────────────────────────────────

function RiderNegotiationModal({
  ride,
  offer,
  onClose,
  onSuccess
}: {
  ride: RideRequest;
  offer: RideOffer;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"view" | "counter">("view");
  const [riderFare, setRiderFare] = useState<number | string>(offer.counter_fare);
  const [riderMsg, setRiderMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diff = Number(offer.counter_fare) - Number(ride.fare_amount);
  const diffText = diff > 0 ? `+RM ${diff.toFixed(2)}` : diff < 0 ? `-RM ${Math.abs(diff).toFixed(2)}` : "Same as initial fare";

  const waUrl = `https://wa.me/${toE164(offer.driver_contact)}?text=${encodeURIComponent(
    `Hi ${offer.driver_name}, regarding your RM ${Number(offer.counter_fare).toFixed(2)} offer for my ride from ${ride.pickup_location} to ${ride.dropoff_location}:`
  )}`;
  const tgUrl = formatTelegramUrl(offer.driver_contact);

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await fetchApi(`/ride-requests/${ride.id}/offers/${offer.id}/accept`, {
        method: "POST"
      });
      alert(`Offer accepted! ${offer.driver_name} is confirmed as your driver.`);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to accept driver offer.");
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm("Decline this driver offer?")) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchApi(`/ride-requests/${ride.id}/offers/${offer.id}/decline`, {
        method: "POST"
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to decline offer.");
      setSubmitting(false);
    }
  };

  const handleSendCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    const fareNum = Number(riderFare);
    if (isNaN(fareNum) || fareNum < 1) {
      setError("Please enter a valid counter fare amount in RM.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await fetchApi(`/ride-requests/${ride.id}/offers`, {
        method: "POST",
        body: JSON.stringify({
          offered_by: "rider",
          parent_offer_id: offer.id,
          counter_fare: fareNum,
          message: riderMsg.trim() || undefined
        })
      });
      alert(`Counter-offer of RM ${fareNum.toFixed(2)} sent to ${offer.driver_name}!`);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to send counter-offer.");
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "1rem"
    }}>
      <div className="card" style={{ maxWidth: "520px", width: "100%", padding: "2rem", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <span className="badge badge-warning" style={{ fontSize: "0.78rem", marginBottom: "0.3rem" }}>
              Driver Price Negotiation
            </span>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-dark-navy)" }}>
              Respond to Driver Offer
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-secondary-text)" }}>
            <X size={22} />
          </button>
        </div>

        {/* Trip Overview */}
        <div style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)", padding: "0.85rem 1rem", borderRadius: "var(--radius-md)", marginBottom: "1.25rem", fontSize: "0.88rem" }}>
          <div style={{ fontWeight: 700, color: "var(--color-dark-navy)" }}>
            {ride.pickup_location} &rarr; {ride.dropoff_location}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-secondary-text)", marginTop: "2px" }}>
            Your initial offered fare: <strong>RM {Number(ride.fare_amount).toFixed(2)}</strong> ({ride.payment_method_preference})
          </div>
        </div>

        {/* Driver Offer Card */}
        <div style={{ backgroundColor: "var(--alert-warning-bg)", border: "1.5px solid var(--alert-warning-border)", borderRadius: "var(--radius-md)", padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--color-dark-navy)" }}>
                {offer.driver_name}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--color-secondary-text)", marginTop: "2px" }}>
                Vehicle: <strong>{offer.vehicle_details || "TripMate Vehicle"}</strong>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--color-secondary-text)", marginTop: "2px" }}>
                Phone: <strong>{offer.driver_contact}</strong>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-warning)" }}>
                RM {Number(offer.counter_fare).toFixed(2)}
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--alert-warning-text)" }}>
                {diffText}
              </span>
            </div>
          </div>

          {offer.message && (
            <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", backgroundColor: "var(--color-white)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontStyle: "italic", color: "var(--color-dark-navy)" }}>
              Driver note: &ldquo;{offer.message}&rdquo;
            </div>
          )}
        </div>

        {/* Direct Contact Links */}
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.25rem" }}>
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
            style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
          >
            <Phone size={15} color="#25D366" /> WhatsApp
          </a>
          <a
            href={tgUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
            style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
          >
            <MessageCircle size={15} color="#229ED9" /> Telegram
          </a>
        </div>

        {error && (
          <div style={{ backgroundColor: "var(--alert-error-bg)", border: "1px solid var(--alert-error-border)", color: "var(--alert-error-text)", padding: "0.75rem", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {/* Counter Form or Action Buttons */}
        {mode === "counter" ? (
          <form onSubmit={handleSendCounter} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                Your Proposed Counter-Fare (RM):
              </label>
              <input
                type="number"
                min={1}
                step={1}
                required
                className="input-field"
                value={riderFare}
                onChange={(e) => setRiderFare(e.target.value)}
              />

              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginTop: "0.75rem", marginBottom: "0.35rem" }}>
                Note to Driver (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Can we meet in the middle?"
                className="input-field"
                value={riderMsg}
                onChange={(e) => setRiderMsg(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setMode("view")}
                className="btn btn-outline"
                disabled={submitting}
                style={{ fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <Send size={14} /> {submitting ? "Sending..." : "Send Counter-Offer"}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "0.95rem",
                fontWeight: 800,
                backgroundColor: "var(--color-success)",
                borderColor: "var(--color-success)"
              }}
            >
              {submitting ? "Accepting..." : `Accept RM ${Number(offer.counter_fare).toFixed(2)}`}
            </button>

            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                onClick={() => setMode("counter")}
                disabled={submitting}
                className="btn btn-outline"
                style={{ flex: 1, fontSize: "0.88rem", fontWeight: 700 }}
              >
                Counter-Offer Back
              </button>

              <button
                onClick={handleDecline}
                disabled={submitting}
                className="btn btn-outline"
                style={{ flex: 1, fontSize: "0.88rem", color: "var(--color-error)", borderColor: "var(--color-error)" }}
              >
                Decline Offer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
