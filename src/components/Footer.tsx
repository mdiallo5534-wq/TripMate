"use client";

import React from "react";
import Link from "next/link";
import { Car } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer style={{
      backgroundColor: "var(--color-white)",
      borderTop: "1px solid var(--color-border)",
      color: "var(--color-secondary-text)",
      padding: "3.5rem 0 2rem 0",
      marginTop: "6rem",
      transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease"
    }}>
      <div className="container" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        maxWidth: "680px",
        margin: "0 auto 2.5rem auto"
      }}>
        {/* Brand column */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", color: "var(--color-dark-navy)" }}>
          <div style={{
            backgroundColor: "var(--color-primary)",
            color: "white",
            padding: "0.45rem",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Car size={20} />
          </div>
          <span style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
            Trip<span style={{ color: "var(--color-primary)" }}>Mate</span> Kuala Lumpur
          </span>
        </div>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "var(--color-secondary-text)" }}>
          Your Journey. Your Way. Request on-demand rides across Kuala Lumpur with instant driver acceptance and zero commission cuts.
        </p>
      </div>

      <div className="container" style={{
        borderTop: "1px solid var(--color-border)",
        paddingTop: "1.75rem",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        fontSize: "0.85rem"
      }}>
        <div style={{ color: "var(--color-secondary-text)", fontWeight: 500 }}>
          &copy; 2026 TripMate Mobility Technologies. All rights reserved.
        </div>
        <div style={{
          color: "var(--color-secondary-text)",
          backgroundColor: "var(--color-bg)",
          padding: "0.35rem 0.75rem",
          borderRadius: "var(--radius-full)",
          border: "1px solid var(--color-border)",
          fontSize: "0.8rem",
          fontWeight: 600
        }}>
          Direct Settlement: Touch &apos;n Go (TNG) eWallet / DuitNow &bull; MYR
        </div>
      </div>
    </footer>
  );
};
