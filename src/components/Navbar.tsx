"use client";

import React from "react";
import Link from "next/link";
import { Car, Compass, ClipboardList } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Navbar: React.FC = () => {
  return (
    <header style={{
      backgroundColor: "var(--color-white)",
      borderBottom: "1px solid var(--color-border)",
      position: "sticky",
      top: 0,
      zIndex: 100
    }}>
      <div className="container" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "72px"
      }}>
        {/* Brand Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            backgroundColor: "var(--color-primary)",
            color: "white",
            padding: "0.5rem",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Car size={24} />
          </div>
          <div>
            <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--color-dark-navy)", letterSpacing: "-0.5px" }}>
              Trip<span style={{ color: "var(--color-primary)" }}>Mate</span>
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-secondary-text)", marginLeft: "6px", fontWeight: 600 }}>
              Kuala Lumpur
            </span>
          </div>
        </Link>

        {/* Navigation & Action Links */}
        <nav className="navbar-nav" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Rider Board Link */}
          <Link
            href="/rider-board"
            className="btn btn-outline nav-btn"
            style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", padding: "0.45rem 0.75rem", fontWeight: 600 }}
            title="Track and manage your ride requests"
          >
            <ClipboardList size={16} />
            <span className="nav-btn-text">Rider Board</span>
          </Link>

          <Link
            href="/driver/rides"
            className="btn btn-outline nav-btn"
            style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", padding: "0.45rem 0.75rem", fontWeight: 600 }}
            title="Driver Board - Browse & accept rides"
          >
            <Car size={16} />
            <span className="nav-btn-text">Driver Board</span>
          </Link>

          <Link
            href="/request-ride"
            className="btn btn-primary nav-btn nav-btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", padding: "0.45rem 0.85rem", fontWeight: 700 }}
            title="Order a ride in Kuala Lumpur"
          >
            <Compass size={16} />
            <span className="nav-btn-text-full">Order a Ride in KL</span>
            <span className="nav-btn-text-short">Order Ride</span>
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
};
