"use client";

import React from "react";
import Link from "next/link";
import {
  Car, MapPin, Calendar, Clock, ArrowRight, ShieldCheck,
  CreditCard, CheckCircle2, ChevronRight, Info
} from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section style={{
        backgroundColor: "var(--color-white)",
        borderBottom: "1px solid var(--color-border)",
        padding: "5rem 0 4rem 0",
        position: "relative"
      }}>
        <div className="container">
          <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.4rem 1rem",
              borderRadius: "var(--radius-full)",
              backgroundColor: "#EFF6FF",
              color: "var(--color-primary)",
              fontWeight: 700,
              fontSize: "0.85rem",
              marginBottom: "1.5rem"
            }}>
              <span>📍 Live Exclusively in Kuala Lumpur</span>
            </div>

            <h1 style={{
              fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-1px",
              color: "var(--color-dark-navy)",
              marginBottom: "1.25rem"
            }}>
              Order a Ride. <span style={{ color: "var(--color-primary)" }}>Accepted Directly.</span>
            </h1>

            <p style={{
              fontSize: "1.15rem",
              color: "var(--color-secondary-text)",
              lineHeight: 1.6,
              marginBottom: "2.5rem"
            }}>
              No accounts, no logins, and no apps required. Anyone can order a ride across Kuala Lumpur, and any driver can accept it on the open Driver Board. Settle fares directly via <strong>Cash</strong>, <strong>Touch &apos;n Go (TNG) eWallet</strong>, or <strong>DuitNow Bank Transfer</strong>.
            </p>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "2rem" }}>
              <Link href="/request-ride" className="btn btn-primary" style={{ padding: "0.95rem 2rem", fontSize: "1.05rem", fontWeight: 700 }}>
                Order a Ride in KL <ArrowRight size={18} />
              </Link>
              <Link href="/driver/rides" className="btn btn-outline" style={{ padding: "0.95rem 2rem", fontSize: "1.05rem", fontWeight: 600 }}>
                Driver Board (Available Rides)
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{ padding: "4.5rem 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto 3rem auto" }}>
            <h2 style={{ fontSize: "1.85rem", fontWeight: 700, color: "var(--color-dark-navy)" }}>
              How TripMate Works
            </h2>
            <p style={{ color: "var(--color-secondary-text)", marginTop: "0.5rem" }}>
              Instant peer-to-peer ride coordination with zero authentication barriers.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "2rem"
          }}>
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "#EFF6FF",
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
                fontWeight: 800,
                fontSize: "1.2rem"
              }}>
                1
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>Order a Ride in KL</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--color-secondary-text)", lineHeight: 1.5 }}>
                Enter your pickup and destination in Kuala Lumpur, your name, phone number, and offered fare. No signup needed.
              </p>
            </div>

            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "#EFF6FF",
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
                fontWeight: 800,
                fontSize: "1.2rem"
              }}>
                2
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>Driver Accepts & Locks</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--color-secondary-text)", lineHeight: 1.5 }}>
                A driver on the Driver Board accepts your request. The ride is immediately marked as <strong>Taken</strong> and reserved for them.
              </p>
            </div>

            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "#EFF6FF",
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
                fontWeight: 800,
                fontSize: "1.2rem"
              }}>
                3
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>Direct Cash / TNG / Bank Payment</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--color-secondary-text)", lineHeight: 1.5 }}>
                Coordinate pickup directly and settle payment in Cash, Touch &apos;n Go eWallet QR, or DuitNow Bank Transfer. Zero platform fees.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
