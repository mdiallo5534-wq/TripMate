import { NextRequest } from "next/server";
import { Client } from "pg";

export const dynamic = "force-dynamic";

type SSEController = ReadableStreamDefaultController<Uint8Array>;

interface GlobalBroadcaster {
  client: Client | null;
  subscribers: Set<SSEController>;
  isConnecting: boolean;
  reconnectTimer: NodeJS.Timeout | null;
  heartbeatTimer: NodeJS.Timeout | null;
}

declare global {
  var _sseBroadcaster: GlobalBroadcaster | undefined;
}

// Single singleton listener state across the entire Next.js server instance
const broadcaster: GlobalBroadcaster = global._sseBroadcaster || {
  client: null,
  subscribers: new Set(),
  isConnecting: false,
  reconnectTimer: null,
  heartbeatTimer: null,
};
global._sseBroadcaster = broadcaster;

const encoder = new TextEncoder();

function broadcastToAll(event: string, data: any) {
  const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  for (const controller of broadcaster.subscribers) {
    try {
      controller.enqueue(payload);
    } catch {
      broadcaster.subscribers.delete(controller);
    }
  }
}

// Ensure 1 shared background PostgreSQL client running LISTEN tripmate_realtime
async function initPgListener() {
  if (broadcaster.client || broadcaster.isConnecting) return;
  broadcaster.isConnecting = true;

  const directDbUrl =
    "postgresql://postgres.nbftvqatmlmmwqtybcxy:Mamoudou3105@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

  try {
    const client = new Client({
      connectionString: directDbUrl,
      ssl: { rejectUnauthorized: false },
    });

    client.on("error", (err) => {
      console.warn("[Broadcaster] Postgres listener client error:", err.message);
      cleanupListener();
      scheduleReconnect();
    });

    client.on("end", () => {
      console.warn("[Broadcaster] Postgres listener client connection ended");
      cleanupListener();
      scheduleReconnect();
    });

    client.on("notification", (msg) => {
      if (msg.channel === "tripmate_realtime" && msg.payload) {
        try {
          const parsed = JSON.parse(msg.payload);
          broadcastToAll("db_change", parsed);
        } catch {
          broadcastToAll("db_change", { raw: msg.payload });
        }
      }
    });

    await client.connect();
    await client.query("LISTEN tripmate_realtime");
    broadcaster.client = client;
    broadcaster.isConnecting = false;
    console.log("[Broadcaster] Shared Postgres LISTEN client connected successfully.");

    // Start 15s keepalive ping for all connected browser clients
    if (!broadcaster.heartbeatTimer) {
      broadcaster.heartbeatTimer = setInterval(() => {
        broadcastToAll("ping", { t: Date.now() });
      }, 15000);
    }
  } catch (err: any) {
    console.error("[Broadcaster] Failed to connect shared Postgres listener:", err.message);
    cleanupListener();
    scheduleReconnect();
  }
}

function cleanupListener() {
  if (broadcaster.client) {
    broadcaster.client.removeAllListeners();
    broadcaster.client.end().catch(() => {});
    broadcaster.client = null;
  }
  broadcaster.isConnecting = false;
}

function scheduleReconnect() {
  if (broadcaster.reconnectTimer) return;
  broadcaster.reconnectTimer = setTimeout(() => {
    broadcaster.reconnectTimer = null;
    initPgListener().catch(console.error);
  }, 3000);
}

export async function GET(req: NextRequest) {
  // Ensure the single shared background listener is active
  await initPgListener();

  let subscriberController: SSEController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      subscriberController = controller;
      broadcaster.subscribers.add(controller);

      // Welcome event
      try {
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "ready" })}\n\n`)
        );
      } catch {}

      req.signal.addEventListener("abort", () => {
        if (subscriberController) {
          broadcaster.subscribers.delete(subscriberController);
        }
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      if (subscriberController) {
        broadcaster.subscribers.delete(subscriberController);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
