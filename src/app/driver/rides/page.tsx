"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi, RideRequest } from "@/lib/api";
import {
  MapPin, Calendar, Clock, Users, ArrowRight, ShieldCheck,
  CheckCircle2, AlertCircle, RefreshCw, Car, Phone, User, X,
  MessageSquare, DollarSign, Bell, ExternalLink, Zap, MessageCircle, ArrowLeft
} from "lucide-react";

interface DriverRidesResponse {
  driver_phone: string;
  accepted_rides: RideRequest[];
  my_offers: RideRequest[];
}

// ─── Contact URL helpers ───────────────────────────────────────────────────

function toE164(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    clean = "60" + clean.substring(1);
  } else if (!clean.startsWith("60") && clean.length >= 9) {
    clean = "60" + clean;
  }
  return clean;
}

function formatWhatsAppUrl(
  phone: string,
  riderName: string,
  driverName: string,
  vehicleDetails: string,
  pickup: string,
  dropoff: string,
  fare: number
): string {
  const e164 = toE164(phone);
  const message = `Hi ${riderName}! I'm ${driverName}, your TripMate driver (${vehicleDetails}). I've accepted your ride from ${pickup} to ${dropoff} for RM ${Number(fare).toFixed(2)}. I'm on my way to pick you up!`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

function formatTelegramUrl(phone: string): string {
  const e164 = toE164(phone);
  return `https://t.me/+${e164}`;
}

// ─── Contact Choice Modal ──────────────────────────────────────────────────

interface ContactChoiceModalProps {
  ride: RideRequest;
  driverName: string;
  vehicleDetails: string;
  onDismiss: () => void;
}

function ContactChoiceModal({ ride, driverName, vehicleDetails, onDismiss }: ContactChoiceModalProps) {
  const waUrl = formatWhatsAppUrl(
    ride.rider_contact,
    ride.rider_name,
    driverName,
    vehicleDetails,
    ride.pickup_location,
    ride.dropoff_location,
    ride.fare_amount
  );
  const tgUrl = formatTelegramUrl(ride.rider_contact);

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      padding: "1rem"
    }}>
      <div className="card" style={{ maxWidth: "420px", width: "100%", padding: "2rem", textAlign: "center" }}>
        <CheckCircle2 size={44} color="var(--color-success)" style={{ margin: "0 auto 0.75rem auto" }} />
        <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--color-dark-navy)", marginBottom: "0.35rem" }}>
          Ride Accepted!
        </h3>
        <p style={{ fontSize: "0.88rem", color: "var(--color-secondary-text)", marginBottom: "1.5rem" }}>
          How would you like to contact <strong>{ride.rider_name}</strong>?
        </p>

        <div style={{ backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)", padding: "0.85rem 1rem", marginBottom: "1.5rem", fontSize: "0.85rem", textAlign: "left" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>{ride.pickup_location} → {ride.dropoff_location}</div>
          <div style={{ color: "var(--color-secondary-text)" }}>RM {Number(ride.fare_amount).toFixed(2)} · {ride.payment_method_preference}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{
              backgroundColor: "#25D366",
              borderColor: "#25D366",
              color: "white",
              fontWeight: 800,
              fontSize: "1rem",
              padding: "0.85rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              textDecoration: "none",
              borderRadius: "var(--radius-md)"
            }}
          >
            <Phone size={18} /> Contact on WhatsApp
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
              fontWeight: 800,
              fontSize: "1rem",
              padding: "0.85rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              textDecoration: "none",
              borderRadius: "var(--radius-md)"
            }}
          >
            <MessageCircle size={18} /> Contact on Telegram
          </a>
        </div>

        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-secondary-text)",
            fontSize: "0.88rem",
            cursor: "pointer",
            textDecoration: "underline"
          }}
        >
          Skip — I'll contact them later
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function DriverRideBoardPage() {
  const [tab, setTab] = useState<"available" | "my_rides">("available");

  // Open Rides Feed
  const [openRides, setOpenRides] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<RideRequest | null>(null);

  // Driver Identity & Assigned Rides
  const [driverContactFilter, setDriverContactFilter] = useState("");
  const [acceptedRides, setAcceptedRides] = useState<RideRequest[]>([]);
  const [myBids, setMyBids] = useState<RideRequest[]>([]);
  const [loadingDriverRides, setLoadingDriverRides] = useState(false);

  // Contact Choice Modal (shown after accepting a ride)
  const [contactChoiceRide, setContactChoiceRide] = useState<RideRequest | null>(null);

  // Modal Form
  const [modalMode, setModalMode] = useState<"accept" | "negotiate">("accept");
  const [driverName, setDriverName] = useState("");
  const [driverContact, setDriverContact] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [counterFare, setCounterFare] = useState<number | string>("");
  const [negotiateMessage, setNegotiateMessage] = useState("");
  const [submittingModal, setSubmittingModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Defensive filter: only truly accepted/completed rides
  const confirmedAcceptedRides = acceptedRides.filter(
    (r) => r.status === "taken" || r.status === "completed"
  );

  const loadOpenRides = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<RideRequest[]>("/ride-requests/open");
      setOpenRides(data);
    } catch (err: any) {
      setError(err.message || "Failed to load open rides");
    } finally {
      setLoading(false);
    }
  };

  const loadDriverRides = async (explicitPhone?: string) => {
    const phoneToQuery = explicitPhone || driverContactFilter;
    setLoadingDriverRides(true);
    try {
      const url = phoneToQuery
        ? `/ride-requests/driver?phone=${encodeURIComponent(phoneToQuery.trim())}`
        : "/ride-requests/driver";
      const data = await fetchApi<DriverRidesResponse>(url);
      setAcceptedRides(data.accepted_rides || []);
      setMyBids(data.my_offers || []);
      if (data.driver_phone && !driverContactFilter) {
        setDriverContactFilter(data.driver_phone);
        if (!driverContact) setDriverContact(data.driver_phone);
      }
    } catch (err) {
      // Ignore background fetch errors
    } finally {
      setLoadingDriverRides(false);
    }
  };

  // Load saved driver info on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tripmate_driver_saved_details");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name && !driverName) setDriverName(parsed.name);
        if (parsed.contact && !driverContact) {
          setDriverContact(parsed.contact);
          setDriverContactFilter(parsed.contact);
        }
        if (parsed.vehicle && !vehicleDetails) setVehicleDetails(parsed.vehicle);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadOpenRides();
    loadDriverRides();

    let sse: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        sse = new EventSource("/api/v1/realtime");
        sse.addEventListener("db_change", (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.table === "ride_requests" || payload.table === "ride_offers") {
              // Seamless background update across both feeds
              loadOpenRides();
              loadDriverRides();
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
  }, [driverContactFilter]);

  const handleOpenModal = (ride: RideRequest, mode: "accept" | "negotiate") => {
    setSelectedRide(ride);
    setModalMode(mode);
    setCounterFare(ride.fare_amount);
    setError(null);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRide) return;

    setSubmittingModal(true);
    setError(null);

    try {
      // Save driver info for future sessions
      try {
        localStorage.setItem(
          "tripmate_driver_saved_details",
          JSON.stringify({
            name: driverName.trim(),
            contact: driverContact.trim(),
            vehicle: vehicleDetails.trim()
          })
        );
      } catch {}

      if (modalMode === "accept") {
        const acceptedRide = await fetchApi<RideRequest>(`/ride-requests/${selectedRide.id}/accept`, {
          method: "POST",
          body: JSON.stringify({
            driver_name: driverName.trim(),
            driver_contact: driverContact.trim(),
            vehicle_details: vehicleDetails.trim()
          })
        });

        setSelectedRide(null);
        setSuccessMsg(`Ride successfully accepted and locked as TAKEN!`);

        // Show contact choice modal instead of auto-opening WhatsApp
        setContactChoiceRide(acceptedRide);
      } else {
        const fare = Number(counterFare);
        if (isNaN(fare) || fare < 1) {
          throw new Error("Please enter a valid counter-offer fare in RM.");
        }
        await fetchApi(`/ride-requests/${selectedRide.id}/offers`, {
          method: "POST",
          body: JSON.stringify({
            driver_name: driverName.trim(),
            driver_contact: driverContact.trim(),
            vehicle_details: vehicleDetails.trim(),
            counter_fare: fare,
            message: negotiateMessage.trim() || undefined,
            offered_by: "driver"
          })
        });
        setSuccessMsg(`Counter-offer of RM ${fare.toFixed(2)} sent to rider! You will be notified here as soon as they accept.`);
        setSelectedRide(null);
        setNegotiateMessage("");
      }

      setDriverContactFilter(driverContact.trim());
      loadOpenRides();
      loadDriverRides(driverContact.trim());
    } catch (err: any) {
      setError(err.message || "Failed to submit request.");
      loadOpenRides();
    } finally {
      setSubmittingModal(false);
    }
  };

  const [completingId, setCompletingId] = useState<string | null>(null);

  const handleCompleteRide = async (rideId: string) => {
    if (!confirm("Confirm that this trip is completed and payment has been collected?")) return;

    setCompletingId(rideId);
    setError(null);
    try {
      await fetchApi(`/ride-requests/${rideId}/complete`, {
        method: "POST"
      });
      // Immediately remove the ride from the frontend list
      setAcceptedRides((prev) => prev.filter((r) => r.id !== rideId));
      setSuccessMsg("Trip successfully marked as COMPLETED and removed from the active marketplace!");
      loadDriverRides();
    } catch (err: any) {
      setError(err.message || "Failed to mark ride as completed.");
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="container" style={{ padding: "2.5rem 1.25rem" }}>
      <Link
        href="/"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--color-secondary-text)", marginBottom: "1.5rem", fontSize: "0.9rem" }}
      >
        <ArrowLeft size={16} /> Back to Home
      </Link>

      {/* Contact Choice Modal */}
      {contactChoiceRide && (
        <ContactChoiceModal
          ride={contactChoiceRide}
          driverName={driverName}
          vehicleDetails={vehicleDetails}
          onDismiss={() => setContactChoiceRide(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
            <span className="badge badge-carpool">
              <MapPin size={13} /> Kuala Lumpur Driver Board
            </span>
            <span className="badge badge-warning">
              Direct Cash / TNG / Bank Transfer
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#166534", backgroundColor: "#DCFCE7", padding: "0.25rem 0.65rem", borderRadius: "9999px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#16A34A" }}></span>
              Live Realtime Feed (Instant)
            </span>
          </div>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--color-dark-navy)" }}>
            Kuala Lumpur Driver Hub
          </h1>
          <p style={{ color: "var(--color-secondary-text)", fontSize: "0.95rem" }}>
            Accept open passenger requests in KL, negotiate fares, and chat directly with riders on WhatsApp or Telegram.
          </p>
        </div>

        <button onClick={() => { loadOpenRides(); loadDriverRides(); }} className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <RefreshCw size={15} /> Refresh Feed
        </button>
      </div>

      {/* Accepted Rides Live Alert Banner */}
      {confirmedAcceptedRides.length > 0 && (
        <div style={{
          backgroundColor: "#ECFDF5",
          border: "2px solid #10B981",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ backgroundColor: "#10B981", color: "white", padding: "0.5rem", borderRadius: "var(--radius-full)" }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#065F46" }}>
                You have {confirmedAcceptedRides.length} Accepted {confirmedAcceptedRides.length === 1 ? "Ride" : "Rides"} Ready for Pickup!
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#047857", marginTop: "2px" }}>
                Contact your riders via WhatsApp or Telegram to coordinate pickup.
              </p>
            </div>
          </div>

          <button
            onClick={() => setTab("my_rides")}
            className="btn btn-primary"
            style={{ backgroundColor: "#059669", borderColor: "#059669", fontSize: "0.9rem", fontWeight: 700 }}
          >
            View Accepted Rides &rarr;
          </button>
        </div>
      )}

      {/* Tab Switcher */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid var(--color-border)", marginBottom: "1.5rem" }}>
        <button
          onClick={() => setTab("available")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: tab === "available" ? "3px solid var(--color-primary)" : "3px solid transparent",
            color: tab === "available" ? "var(--color-primary)" : "var(--color-secondary-text)",
            cursor: "pointer",
            marginBottom: "-2px"
          }}
        >
          Available Requests ({openRides.length})
        </button>
        <button
          onClick={() => setTab("my_rides")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: tab === "my_rides" ? "3px solid var(--color-primary)" : "3px solid transparent",
            color: tab === "my_rides" ? "var(--color-primary)" : "var(--color-secondary-text)",
            cursor: "pointer",
            marginBottom: "-2px",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          <span>My Rides</span>
          {confirmedAcceptedRides.length > 0 && (
            <span style={{ backgroundColor: "#10B981", color: "white", borderRadius: "9999px", padding: "1px 7px", fontSize: "0.72rem" }}>
              {confirmedAcceptedRides.length} Accepted
            </span>
          )}
          {myBids.length > 0 && (
            <span style={{ backgroundColor: "#F59E0B", color: "white", borderRadius: "9999px", padding: "1px 7px", fontSize: "0.72rem" }}>
              {myBids.length} Negotiating
            </span>
          )}
        </button>
      </div>

      {successMsg && (
        <div style={{
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          color: "var(--color-success)",
          padding: "1rem",
          borderRadius: "var(--radius-md)",
          fontSize: "0.9rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: "#FEF2F2",
          border: "1px solid #FCA5A5",
          color: "var(--color-error)",
          padding: "1rem",
          borderRadius: "var(--radius-md)",
          fontSize: "0.9rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: AVAILABLE RIDES */}
      {tab === "available" && (
        <>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="card" style={{ padding: "2rem", opacity: 0.6 }}>
                  <div style={{ height: "20px", width: "40%", backgroundColor: "var(--color-border)", borderRadius: "4px", marginBottom: "1rem" }} />
                  <div style={{ height: "16px", width: "70%", backgroundColor: "var(--color-border)", borderRadius: "4px" }} />
                </div>
              ))}
            </div>
          ) : openRides.length === 0 ? (
            <div className="card" style={{ padding: "4rem 2rem", textAlign: "center" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-surface-hover)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem auto"
              }}>
                <Car size={26} color="var(--color-secondary-text)" />
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                No open ride requests in Kuala Lumpur right now
              </h3>
              <p style={{ color: "var(--color-secondary-text)", maxWidth: "420px", margin: "0 auto 1.5rem auto", fontSize: "0.92rem" }}>
                When passengers submit trips, they appear here live.
              </p>
              <button onClick={loadOpenRides} className="btn btn-primary">
                <RefreshCw size={15} /> Refresh Board
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {openRides.map((ride) => {
                const sched = new Date(ride.scheduled_at);
                const riderCounters = ride.offers?.filter(o => o.status === "pending" && o.offered_by === "rider") || [];

                return (
                  <div key={ride.id} className="card" style={{ padding: "1.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <span className="badge badge-carpool">
                            {ride.city}
                          </span>
                          <span className="badge badge-verified">
                            Status: OPEN
                          </span>
                        </div>

                        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-dark-navy)" }}>
                          {ride.pickup_location} &rarr; {ride.dropoff_location}
                        </div>

                        <div style={{ fontSize: "0.85rem", color: "var(--color-secondary-text)", marginTop: "0.3rem" }}>
                          Rider: <strong>{ride.rider_name}</strong> &bull; Contact: <strong>{ride.rider_contact}</strong>
                        </div>

                        {ride.notes && (
                          <div style={{ fontSize: "0.85rem", color: "var(--color-secondary-text)", marginTop: "0.4rem", backgroundColor: "var(--color-bg)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)" }}>
                            Note: &ldquo;{ride.notes}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Fare & Payment Method */}
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-primary)" }}>
                          RM {Number(ride.fare_amount).toFixed(2)}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--color-secondary-text)", fontWeight: 600 }}>
                          Direct {ride.payment_method_preference}
                        </div>
                      </div>
                    </div>

                    {/* Rider Counter-Offer Alert on Driver Card */}
                    {riderCounters.length > 0 && (
                      <div style={{
                        backgroundColor: "var(--alert-info-bg)",
                        border: "1px solid var(--alert-info-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "0.75rem 1rem",
                        marginBottom: "1rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "0.5rem"
                      }}>
                        <div>
                          <span style={{ fontWeight: 800, color: "var(--color-primary)", fontSize: "0.88rem" }}>
                            ⚡ Rider Counter-Offered:
                          </span>
                          {riderCounters.map(rOffer => (
                            <span key={rOffer.id} style={{ marginLeft: "6px", fontSize: "0.88rem", color: "var(--alert-info-text)" }}>
                              <strong>RM {Number(rOffer.counter_fare).toFixed(2)}</strong> {rOffer.message ? `("${rOffer.message}")` : ""}
                            </span>
                          ))}
                        </div>
                        <Link
                          href={`/rides/${ride.id}`}
                          className="btn btn-primary"
                          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                        >
                          Review &amp; Accept Rider Counter
                        </Link>
                      </div>
                    )}

                    <hr style={{ borderColor: "var(--color-border)", margin: "1rem 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", fontSize: "0.88rem", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Calendar size={16} color="var(--color-secondary-text)" />
                          <span>{sched.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Clock size={16} color="var(--color-secondary-text)" />
                          <span>{sched.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Users size={16} color="var(--color-secondary-text)" />
                          <span><strong>{ride.passenger_count}</strong> {ride.passenger_count === 1 ? "passenger" : "passengers"}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Link href={`/rides/${ride.id}`} className="btn btn-outline" style={{ fontSize: "0.88rem" }}>
                          View Details
                        </Link>
                        <button
                          onClick={() => handleOpenModal(ride, "negotiate")}
                          className="btn btn-outline"
                          style={{ padding: "0.6rem 1rem", fontSize: "0.88rem", fontWeight: 700, borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                        >
                          Negotiate Fare
                        </button>
                        <button
                          onClick={() => handleOpenModal(ride, "accept")}
                          className="btn btn-primary"
                          style={{ padding: "0.6rem 1.25rem", fontSize: "0.88rem", fontWeight: 700 }}
                        >
                          Accept (RM {Number(ride.fare_amount).toFixed(2)})
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: MY RIDES */}
      {tab === "my_rides" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Driver Phone Filter */}
          <div className="card" style={{ padding: "1.25rem", backgroundColor: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <strong style={{ fontSize: "0.95rem" }}>Driver Identification (Phone Number):</strong>
              <div style={{ fontSize: "0.82rem", color: "var(--color-secondary-text)", marginTop: "2px" }}>
                Filter your accepted rides and active negotiations by phone number.
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="tel"
                placeholder="e.g. 012-3334444"
                className="input-field"
                value={driverContactFilter}
                onChange={(e) => setDriverContactFilter(e.target.value)}
                style={{ width: "200px" }}
              />
              <button onClick={() => loadDriverRides(driverContactFilter)} className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
                Filter
              </button>
            </div>
          </div>

          {/* Section A: Active Negotiations — shown first */}
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem", color: "var(--color-dark-navy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <DollarSign color="#D97706" size={20} />
              Active Negotiations ({myBids.length})
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--color-secondary-text)", marginBottom: "1rem" }}>
              These are rides where you submitted a counter-offer. They will move to <strong>Accepted Rides</strong> once the rider confirms your fare.
            </p>

            {myBids.length === 0 ? (
              <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--color-secondary-text)" }}>
                You have no pending counter-offers awaiting rider confirmation.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {myBids.map((bRide) => {
                  const sched = new Date(bRide.scheduled_at);
                  const myOffer = bRide.offers?.find(
                    o => o.status === "pending" && o.offered_by !== "rider"
                  );
                  const riderCounterOffers = bRide.offers?.filter(
                    o => o.status === "pending" && o.offered_by === "rider"
                  ) || [];

                  return (
                    <div key={bRide.id} className="card" style={{ padding: "1.5rem", border: "2px solid var(--alert-warning-border)", backgroundColor: "var(--alert-warning-bg)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                            <span className="badge badge-warning" style={{ fontSize: "0.78rem" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--color-warning)", display: "inline-block" }}></span>
                              AWAITING RIDER CONFIRMATION
                            </span>
                          </div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-dark-navy)", marginBottom: "0.3rem" }}>
                            {bRide.pickup_location} &rarr; {bRide.dropoff_location}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--color-secondary-text)" }}>
                            Rider: <strong>{bRide.rider_name}</strong> &bull; Contact: <strong>{bRide.rider_contact}</strong>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          {myOffer && (
                            <>
                              <div style={{ fontSize: "0.75rem", color: "var(--color-secondary-text)", marginBottom: "2px" }}>Your offered fare</div>
                              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-warning)" }}>
                                RM {Number(myOffer.counter_fare).toFixed(2)}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--color-secondary-text)" }}>
                                Rider asked: RM {Number(bRide.fare_amount).toFixed(2)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {myOffer?.message && (
                        <div style={{ margin: "0.75rem 0 0 0", padding: "0.5rem 0.75rem", backgroundColor: "var(--color-white)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", color: "var(--color-dark-navy)", fontStyle: "italic" }}>
                          Your note: &ldquo;{myOffer.message}&rdquo;
                        </div>
                      )}

                      {/* Rider Counter-Offer alert in driver's negotiation card */}
                      {riderCounterOffers.length > 0 && (
                        <div style={{
                          margin: "0.75rem 0 0 0",
                          padding: "0.65rem 0.85rem",
                          backgroundColor: "var(--alert-info-bg)",
                          border: "1px solid var(--alert-info-border)",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "0.5rem"
                        }}>
                          <div style={{ fontSize: "0.88rem", color: "var(--alert-info-text)" }}>
                            <strong style={{ color: "var(--color-primary)" }}>⚡ Rider Counter-Offered Back:</strong>{" "}
                            {riderCounterOffers.map(r => (
                              <span key={r.id} style={{ fontWeight: 800 }}>RM {Number(r.counter_fare).toFixed(2)} {r.message ? `("${r.message}")` : ""}</span>
                            ))}
                          </div>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, backgroundColor: "var(--color-primary)", color: "#FFFFFF", padding: "0.2rem 0.55rem", borderRadius: "9999px" }}>
                            Action Required
                          </span>
                        </div>
                      )}

                      <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--alert-warning-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.82rem", color: "var(--color-secondary-text)" }}>
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
                            {bRide.passenger_count} pax
                          </span>
                        </div>
                        <Link
                          href={`/rides/${bRide.id}`}
                          className="btn btn-primary"
                          style={{ fontSize: "0.85rem", padding: "0.45rem 1rem", backgroundColor: "var(--color-warning)", borderColor: "var(--color-warning)", fontWeight: 700 }}
                        >
                          View Live Negotiation &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B: Accepted Rides — shown below negotiations */}
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "1rem", color: "var(--color-dark-navy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 color="var(--color-success)" size={20} />
              Accepted Rides ({confirmedAcceptedRides.length})
            </h3>

            {confirmedAcceptedRides.length === 0 ? (
              <div className="card" style={{ padding: "2.5rem", textAlign: "center", color: "var(--color-secondary-text)" }}>
                No confirmed rides yet. When a rider accepts your offer or you accept a ride directly, it will appear here.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {confirmedAcceptedRides.map((ride) => {
                  const waUrl = formatWhatsAppUrl(
                    ride.rider_contact,
                    ride.rider_name,
                    ride.driver_name || "Driver",
                    ride.vehicle_details || "TripMate Vehicle",
                    ride.pickup_location,
                    ride.dropoff_location,
                    ride.fare_amount
                  );
                  const tgUrl = formatTelegramUrl(ride.rider_contact);

                  return (
                    <div key={ride.id} className="card" style={{ padding: "1.5rem", border: "2px solid var(--alert-success-border)", backgroundColor: "var(--alert-success-bg)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "0.75rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                            <span className="badge badge-verified">
                              CONFIRMED / TAKEN
                            </span>
                            <span style={{ fontSize: "0.82rem", color: "var(--alert-success-text)", fontWeight: 700 }}>
                              Agreed Fare: RM {Number(ride.fare_amount).toFixed(2)}
                            </span>
                          </div>
                          <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-dark-navy)" }}>
                            {ride.pickup_location} &rarr; {ride.dropoff_location}
                          </div>
                          <div style={{ fontSize: "0.88rem", marginTop: "0.3rem" }}>
                            Rider: <strong>{ride.rider_name}</strong> &bull; Contact: <strong>{ride.rider_contact}</strong>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {ride.status === "completed" ? (
                            <span className="badge badge-verified" style={{ padding: "0.5rem 1rem", fontSize: "0.88rem" }}>
                              <CheckCircle2 size={16} /> Trip Completed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCompleteRide(ride.id)}
                              disabled={completingId === ride.id}
                              className="btn btn-outline"
                              style={{
                                backgroundColor: "#059669",
                                borderColor: "#059669",
                                color: "white",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                padding: "0.5rem 0.9rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem"
                              }}
                            >
                              <CheckCircle2 size={15} />
                              {completingId === ride.id ? "Completing..." : "Mark as Completed"}
                            </button>
                          )}
                          {/* WhatsApp Button */}
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary"
                            style={{
                              backgroundColor: "#25D366",
                              borderColor: "#25D366",
                              color: "white",
                              fontWeight: 800,
                              fontSize: "0.88rem",
                              padding: "0.5rem 0.9rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              textDecoration: "none"
                            }}
                          >
                            <Phone size={14} /> WhatsApp
                          </a>
                          {/* Telegram Button */}
                          <a
                            href={tgUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary"
                            style={{
                              backgroundColor: "#229ED9",
                              borderColor: "#229ED9",
                              color: "white",
                              fontWeight: 800,
                              fontSize: "0.88rem",
                              padding: "0.5rem 0.9rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              textDecoration: "none"
                            }}
                          >
                            <MessageCircle size={14} /> Telegram
                          </a>
                          <Link href={`/rides/${ride.id}`} className="btn btn-outline" style={{ fontSize: "0.82rem", padding: "0.5rem 0.75rem" }}>
                            View
                          </Link>
                        </div>
                      </div>

                      <div style={{ fontSize: "0.82rem", color: "var(--color-secondary-text)", borderTop: "1px solid #BBF7D0", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
                        Scheduled: {new Date(ride.scheduled_at).toLocaleString("en-MY", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} &bull; Direct {ride.payment_method_preference}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Driver Acceptance & Negotiation Modal */}
      {selectedRide && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "1rem"
        }}>
          <div className="card" style={{ maxWidth: "520px", width: "100%", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                {modalMode === "accept" ? "Accept Ride in Kuala Lumpur" : "Negotiate Fare with Rider"}
              </h3>
              <button onClick={() => setSelectedRide(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: "var(--color-bg)", padding: "1rem", borderRadius: "var(--radius-md)", marginBottom: "1.25rem", fontSize: "0.88rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>
                {selectedRide.pickup_location} &rarr; {selectedRide.dropoff_location}
              </div>
              <div style={{ color: "var(--color-primary)", fontWeight: 800 }}>
                Rider&apos;s Initial Offer: RM {Number(selectedRide.fare_amount).toFixed(2)} &bull; {selectedRide.payment_method_preference}
              </div>
            </div>

            <form onSubmit={handleModalSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {modalMode === "negotiate" && (
                <div style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, color: "var(--color-warning)", marginBottom: "0.3rem" }}>
                    Your Proposed Fare (RM)
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={1}
                    required
                    className="input-field"
                    value={counterFare}
                    onChange={(e) => setCounterFare(e.target.value)}
                  />
                  <div style={{ marginTop: "0.75rem" }}>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--color-warning)", marginBottom: "0.3rem" }}>
                      Negotiation Note / Reason (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Peak hour traffic near KLCC, ready now"
                      className="input-field"
                      value={negotiateMessage}
                      onChange={(e) => setNegotiateMessage(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  <User size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Driver Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmad Razali"
                  className="input-field"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  <Phone size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Driver Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 012-3456789"
                  className="input-field"
                  value={driverContact}
                  onChange={(e) => setDriverContact(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  <Car size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Vehicle Model, Color &amp; Plate
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Silver Perodua Myvi - VBG 8821"
                  className="input-field"
                  value={vehicleDetails}
                  onChange={(e) => setVehicleDetails(e.target.value)}
                />
              </div>

              {error && (
                <div style={{ color: "var(--color-error)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setSelectedRide(null)}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="btn btn-primary"
                  style={{ flex: 2, fontWeight: 700 }}
                >
                  {submittingModal
                    ? "Submitting..."
                    : modalMode === "accept"
                    ? `Accept Ride (RM ${Number(selectedRide.fare_amount).toFixed(2)})`
                    : `Send Counter-Offer (RM ${Number(counterFare).toFixed(2)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
