"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchApi, RideRequest, RideOffer } from "@/lib/api";
import {
  MapPin, Calendar, Clock, Users, ArrowLeft, ShieldCheck,
  CheckCircle2, AlertCircle, Phone, Car, CreditCard, RefreshCw,
  MessageSquare, DollarSign, Send, X, ArrowUpRight, Search, Ban, History, MessageCircle
} from "lucide-react";

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

export default function RideStatusDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [ride, setRide] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancellingRide, setCancellingRide] = useState(false);
  const [completingRide, setCompletingRide] = useState(false);

  const handleCompleteRide = async () => {
    if (!ride) return;
    if (!confirm("Confirm that this trip is completed and payment has been collected?")) return;

    setCompletingRide(true);
    try {
      await fetchApi<any>(`/ride-requests/${ride.id}/complete`, {
        method: "POST"
      });
      // The ride has been deleted immediately from the database upon completion.
      // Redirect back to driver rides page.
      alert("Trip completed and closed! Returning to Driver Board.");
      router.push("/driver/rides");
    } catch (err: any) {
      alert(err.message || "Failed to mark ride as completed.");
      setCompletingRide(false);
    }
  };

  const [actionOfferId, setActionOfferId] = useState<string | null>(null);

  // Rider Counter-Offer State
  const [counteringOfferId, setCounteringOfferId] = useState<string | null>(null);
  const [riderCounterFare, setRiderCounterFare] = useState<number | string>("");
  const [riderCounterMessage, setRiderCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);

  const loadRide = async () => {
    try {
      const data = await fetchApi<RideRequest>(`/ride-requests/${resolvedParams.id}`);
      setRide(data);
    } catch (err: any) {
      setError(err.message || "Failed to load ride details");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!ride) return;
    if (!confirm("Are you sure you want to cancel this ride request?")) return;

    setCancellingRide(true);
    try {
      const updated = await fetchApi<RideRequest>(`/ride-requests/${ride.id}/cancel`, {
        method: "POST"
      });
      setRide(updated);
    } catch (err: any) {
      alert(err.message || "Failed to cancel ride.");
    } finally {
      setCancellingRide(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    setActionOfferId(offerId);
    setError(null);
    try {
      const updated = await fetchApi<RideRequest>(`/ride-requests/${resolvedParams.id}/offers/${offerId}/accept`, {
        method: "POST"
      });
      setRide(updated);
    } catch (err: any) {
      setError(err.message || "Failed to accept driver offer.");
    } finally {
      setActionOfferId(null);
    }
  };

  const handleDeclineOffer = async (offerId: string) => {
    setActionOfferId(offerId);
    setError(null);
    try {
      await fetchApi<RideOffer>(`/ride-requests/${resolvedParams.id}/offers/${offerId}/decline`, {
        method: "POST"
      });
      await loadRide();
    } catch (err: any) {
      setError(err.message || "Failed to decline offer.");
    } finally {
      setActionOfferId(null);
    }
  };

  const handleSubmitRiderCounter = async (parentOfferId: string) => {
    const fare = Number(riderCounterFare);
    if (isNaN(fare) || fare < 1) {
      setError("Please enter a valid counter-fare amount (at least RM 1).");
      return;
    }

    setSubmittingCounter(true);
    setError(null);
    try {
      await fetchApi<RideOffer>(`/ride-requests/${resolvedParams.id}/offers`, {
        method: "POST",
        body: JSON.stringify({
          counter_fare: fare,
          message: riderCounterMessage.trim() || undefined,
          offered_by: "rider",
          parent_offer_id: parentOfferId
        })
      });
      setCounteringOfferId(null);
      setRiderCounterFare("");
      setRiderCounterMessage("");
      await loadRide();
    } catch (err: any) {
      setError(err.message || "Failed to submit counter offer.");
    } finally {
      setSubmittingCounter(false);
    }
  };

  useEffect(() => {
    loadRide();

    let sse: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        sse = new EventSource("/api/v1/realtime");
        sse.addEventListener("db_change", (event) => {
          try {
            const payload = JSON.parse(event.data);
            const isTargetRide =
              (payload.table === "ride_requests" && payload.data?.id === resolvedParams.id) ||
              (payload.table === "ride_offers" && payload.data?.ride_id === resolvedParams.id);

            if (isTargetRide) {
              if (payload.action === "DELETE") {
                // If ride was deleted (completed or purged), update state cleanly
                setRide(null);
                setError("This ride has been completed and concluded by the driver.");
              } else {
                loadRide();
              }
            }
          } catch (err) {
            // Ignore parse errors
          }
        });

        sse.onerror = () => {
          if (sse) sse.close();
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
  }, [resolvedParams.id]);

  if (loading) {
    return <div className="container" style={{ padding: "4rem 1.25rem" }}>Loading ride details...</div>;
  }

  if (error || !ride) {
    return (
      <div className="container" style={{ padding: "4rem 1.25rem", textAlign: "center" }}>
        <div className="card" style={{ maxWidth: "480px", margin: "0 auto", padding: "2rem" }}>
          <AlertCircle size={36} color="var(--color-error)" style={{ margin: "0 auto 0.75rem auto" }} />
          <h3>Ride Not Found</h3>
          <p style={{ color: "var(--color-secondary-text)", marginTop: "0.5rem", marginBottom: "1.5rem" }}>
            {error || "The specified ride request does not exist."}
          </p>
          <Link href="/request-ride" className="btn btn-primary">
            Order a Ride in KL
          </Link>
        </div>
      </div>
    );
  }

  const sched = new Date(ride.scheduled_at);
  const isTaken = ride.status === "taken" || ride.status === "in_progress" || ride.status === "completed";
  const isCancelled = ride.status === "cancelled";

  // Filter offers
  const pendingDriverOffers = ride.offers?.filter(o => o.status === "pending" && o.offered_by !== "rider") || [];
  const pendingRiderCounters = ride.offers?.filter(o => o.status === "pending" && o.offered_by === "rider") || [];

  return (
    <div className="container" style={{ padding: "2.5rem 1.25rem", maxWidth: "800px" }}>
      {/* Top Navigation & Realtime Status Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link href="/driver/rides" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--color-secondary-text)", fontSize: "0.9rem" }}>
          <ArrowLeft size={16} /> Driver Board
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#166534", backgroundColor: "#DCFCE7", padding: "0.3rem 0.65rem", borderRadius: "9999px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#16A34A" }}></span>
            Realtime Live
          </span>
          <button onClick={loadRide} className="btn btn-outline" style={{ fontSize: "0.82rem", padding: "0.35rem 0.75rem" }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: "2.5rem" }}>
        {/* Status Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span className="badge badge-carpool">
                {ride.city}
              </span>
              <span className={`badge ${ride.status === "taken" ? "badge-verified" : ride.status === "open" ? "badge-warning" : ride.status === "cancelled" ? "badge-error" : "badge-commercial"}`}>
                STATUS: {ride.status.toUpperCase()}
              </span>
              {ride.payment_method_preference && (
                <span className="badge" style={{ backgroundColor: "#F3F4F6", color: "#374151" }}>
                  {ride.payment_method_preference}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-dark-navy)" }}>
              {ride.pickup_location} &rarr; {ride.dropoff_location}
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--color-primary)" }}>
              RM {Number(ride.fare_amount).toFixed(2)}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--color-secondary-text)" }}>
              {isTaken ? "Agreed Final Fare" : "Initial Offered Fare"}
            </div>
          </div>
        </div>

        {/* Schedule & Passenger Details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ backgroundColor: "var(--color-bg)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--color-secondary-text)" }}>Scheduled Pickup</div>
            <div style={{ fontWeight: 700, marginTop: "2px" }}>{sched.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })} &bull; {sched.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <div style={{ backgroundColor: "var(--color-bg)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--color-secondary-text)" }}>Passenger Count</div>
            <div style={{ fontWeight: 700, marginTop: "2px" }}>{ride.passenger_count} {ride.passenger_count === 1 ? "Person" : "Persons"}</div>
          </div>
        </div>

        {ride.notes && (
          <div style={{ backgroundColor: "var(--color-bg)", padding: "1rem", borderRadius: "var(--radius-md)", marginBottom: "1.5rem", fontSize: "0.88rem" }}>
            <span style={{ fontWeight: 700 }}>Rider Notes:</span> {ride.notes}
          </div>
        )}

        {/* Driver Assignment Status */}
        {isCancelled ? (
          <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "var(--radius-md)", padding: "1.5rem", textAlign: "center" }}>
            <Ban size={36} color="var(--color-error)" style={{ margin: "0 auto 0.5rem auto" }} />
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-error)", marginBottom: "0.25rem" }}>
              Ride Request Cancelled
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--color-secondary-text)", marginBottom: "1rem" }}>
              This ride request is no longer active on the Kuala Lumpur driver board.
            </p>
            <Link href="/request-ride" className="btn btn-primary" style={{ fontSize: "0.88rem" }}>
              Order a New Ride
            </Link>
          </div>
        ) : isTaken ? (
          <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "var(--radius-md)", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", color: "var(--color-success)" }}>
              <CheckCircle2 size={20} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Ride Accepted by Driver</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.9rem" }}>
              <div>
                <span style={{ color: "var(--color-secondary-text)" }}>Driver Name:</span>
                <div style={{ fontWeight: 700 }}>{ride.driver_name}</div>
              </div>
              <div>
                <span style={{ color: "var(--color-secondary-text)" }}>Driver Contact:</span>
                <div style={{ fontWeight: 700 }}>
                  <a href={`tel:${ride.driver_contact}`} style={{ color: "var(--color-primary)" }}>{ride.driver_contact}</a>
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ color: "var(--color-secondary-text)" }}>Vehicle Details:</span>
                <div style={{ fontWeight: 700 }}>{ride.vehicle_details}</div>
              </div>
              <div style={{ gridColumn: "span 2", display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {ride.status === "completed" ? (
                  <span className="badge badge-verified" style={{ padding: "0.6rem 1.25rem", fontSize: "0.95rem" }}>
                    <CheckCircle2 size={18} /> Ride Completed
                  </span>
                ) : (
                  <button
                    onClick={handleCompleteRide}
                    disabled={completingRide}
                    className="btn btn-outline"
                    style={{
                      backgroundColor: "#059669",
                      borderColor: "#059669",
                      color: "white",
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      padding: "0.6rem 1.25rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem"
                    }}
                  >
                    <CheckCircle2 size={16} />
                    {completingRide ? "Completing Trip..." : "(Driver) Mark Ride as Completed"}
                  </button>
                )}

                {/* Driver: Chat with Rider */}
                <a
                  href={`https://wa.me/${toE164(ride.rider_contact || "")}?text=${encodeURIComponent(`Hi ${ride.rider_name}! I'm ${ride.driver_name}, your driver. I'm on my way to pick you up at ${ride.pickup_location} for RM ${Number(ride.fare_amount).toFixed(2)} (${ride.payment_method_preference})!`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    padding: "0.6rem 1.25rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem"
                  }}
                >
                  <Phone size={16} /> Chat Rider (WhatsApp)
                </a>
                <a
                  href={formatTelegramUrl(ride.rider_contact || "")}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    padding: "0.6rem 1.25rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem"
                  }}
                >
                  <MessageCircle size={16} /> Chat Rider (Telegram)
                </a>
              </div>
              <div style={{ gridColumn: "span 2", backgroundColor: "white", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#15803D", fontWeight: 700, fontSize: "0.82rem" }}>Payment Settlement:</span>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--color-dark-navy)" }}>Direct to Driver via {ride.payment_method_preference} upon pickup/dropoff</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Driver Counter-Offers Alert & Negotiation Section */}
            {pendingDriverOffers.length > 0 && (
              <div style={{ border: "2px solid #F59E0B", backgroundColor: "#FFFBEB", borderRadius: "var(--radius-lg)", padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                  <DollarSign size={22} color="#D97706" />
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#92400E" }}>
                    Driver Price Negotiations ({pendingDriverOffers.length})
                  </h3>
                </div>
                <p style={{ fontSize: "0.85rem", color: "#B45309", marginBottom: "1.25rem" }}>
                  Drivers have proposed alternate fares. You can <strong>Accept</strong> their fare, <strong>Decline</strong>, or <strong>Counter-Offer</strong> back!
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {pendingDriverOffers.map((offer) => {
                    const diff = Number(offer.counter_fare) - Number(ride.fare_amount);
                    const diffText = diff > 0 ? `+RM ${diff.toFixed(2)}` : `-RM ${Math.abs(diff).toFixed(2)}`;
                    const isCounteringThis = counteringOfferId === offer.id;

                    // Check if rider already placed a counter to this offer
                    const myCounter = pendingRiderCounters.find(c => c.parent_offer_id === offer.id);

                    return (
                      <div key={offer.id} style={{ backgroundColor: "var(--color-white)", border: "1px solid #FDE68A", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <strong style={{ fontSize: "1rem" }}>{offer.driver_name}</strong>
                              <span style={{ fontSize: "0.82rem", color: "var(--color-secondary-text)" }}>({offer.vehicle_details})</span>
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "var(--color-secondary-text)", marginTop: "2px" }}>
                              Phone: <strong>{offer.driver_contact}</strong>
                            </div>
                            {offer.message && (
                              <div style={{ fontSize: "0.85rem", color: "#B45309", marginTop: "0.4rem", fontStyle: "italic", backgroundColor: "#FEF3C7", padding: "0.35rem 0.65rem", borderRadius: "var(--radius-sm)" }}>
                                &ldquo;{offer.message}&rdquo;
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--color-primary)" }}>
                              RM {Number(offer.counter_fare).toFixed(2)}
                            </div>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: diff > 0 ? "#D97706" : "var(--color-success)", backgroundColor: diff > 0 ? "#FEF3C7" : "#DCFCE7", padding: "2px 6px", borderRadius: "4px" }}>
                              {diffText} vs initial fare
                            </span>
                          </div>
                        </div>

                        {/* Existing Rider Counter Notice */}
                        {myCounter && (
                          <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", color: "#1E40AF" }}>
                            <strong>Your counter-proposal:</strong> RM {Number(myCounter.counter_fare).toFixed(2)} &mdash; waiting for {offer.driver_name} to accept or decline.
                          </div>
                        )}

                        {/* Inline Rider Counter Input Form */}
                        {isCounteringThis ? (
                          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--color-border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                              <strong style={{ fontSize: "0.88rem", color: "var(--color-dark-navy)" }}>Counter-Offer to {offer.driver_name}</strong>
                              <button onClick={() => setCounteringOfferId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-secondary-text)" }}>
                                <X size={16} />
                              </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: "0.5rem", alignItems: "center" }}>
                              <input
                                type="number"
                                min={1}
                                step={1}
                                placeholder="Fare (RM)"
                                className="input-field"
                                value={riderCounterFare}
                                onChange={(e) => setRiderCounterFare(e.target.value)}
                              />
                              <input
                                type="text"
                                placeholder="Message to driver (e.g. Meet halfway?)"
                                className="input-field"
                                value={riderCounterMessage}
                                onChange={(e) => setRiderCounterMessage(e.target.value)}
                              />
                              <button
                                onClick={() => handleSubmitRiderCounter(offer.id)}
                                disabled={submittingCounter}
                                className="btn btn-primary"
                                style={{ padding: "0.5rem 0.85rem", fontSize: "0.85rem" }}
                              >
                                {submittingCounter ? "Sending..." : "Send Counter"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Action Buttons */
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.6rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #F3F4F6", flexWrap: "wrap" }}>
                            <button
                              onClick={() => { setCounteringOfferId(offer.id); setRiderCounterFare(offer.counter_fare); }}
                              className="btn btn-outline"
                              style={{ fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
                            >
                              Counter-Offer
                            </button>
                            <button
                              onClick={() => handleDeclineOffer(offer.id)}
                              disabled={actionOfferId === offer.id}
                              className="btn btn-outline"
                              style={{ fontSize: "0.82rem", padding: "0.4rem 0.75rem", color: "var(--color-error)" }}
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => handleAcceptOffer(offer.id)}
                              disabled={actionOfferId === offer.id}
                              className="btn btn-primary"
                              style={{ fontSize: "0.85rem", padding: "0.45rem 1rem", fontWeight: 700 }}
                            >
                              {actionOfferId === offer.id ? "Accepting..." : `Accept RM ${Number(offer.counter_fare).toFixed(2)}`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
