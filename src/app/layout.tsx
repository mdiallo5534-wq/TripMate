import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "TripMate Kuala Lumpur — On-Demand Ride Matching & Driver Board",
  description: "Request a ride in Kuala Lumpur. Drivers accept and lock rides directly. Off-platform Touch 'n Go & Bank Transfer payments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <Navbar />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
