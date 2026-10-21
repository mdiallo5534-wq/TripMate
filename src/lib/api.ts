const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export interface RideOffer {
  id: string;
  ride_id: string;
  driver_name: string;
  driver_contact: string;
  vehicle_details: string;
  counter_fare: number;
  payment_details?: string;
  message?: string;
  offered_by?: "driver" | "rider";
  parent_offer_id?: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
}

export interface RideRequest {
  id: string;
  rider_name: string;
  rider_contact: string;
  driver_name?: string;
  driver_contact?: string;
  vehicle_details?: string;
  city: string;
  pickup_location: string;
  dropoff_location: string;
  scheduled_at: string;
  passenger_count: number;
  fare_amount: number;
  currency: string;
  payment_method_preference: string;
  payment_details?: string;
  notes?: string;
  status: "open" | "taken" | "in_progress" | "completed" | "cancelled";
  taken_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  offers?: RideOffer[];
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = "An error occurred";
      try {
        const errData = await res.json();
        errorMsg = errData.detail || errorMsg;
      } catch {
        errorMsg = res.statusText;
      }
      throw new Error(errorMsg);
    }

    return res.json();
  } catch (err: any) {
    if (err.name === "TypeError" && (err.message === "Failed to fetch" || err.message.includes("fetch"))) {
      throw new Error("Cannot reach TripMate backend server. Please verify the server is running on http://127.0.0.1:8000.");
    }
    throw err;
  }
}
