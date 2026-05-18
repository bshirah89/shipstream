import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type {
  ShipEvent,
  ShipEventType,
  GuestCheckinPayload,
  ExcursionBookingPayload,
  DrinkPurchasePayload,
  AdImpressionPayload,
} from "@/types";

// ─── Mock data generators ─────────────────────────────────────────────────────

const GUEST_NAMES = [
  "Maria Santos", "James Chen", "Aisha Patel", "Lars Eriksson",
  "Fatima Al-Hassan", "Carlos Mendez", "Yuki Tanaka", "Sophie Dubois",
];

const EXCURSIONS = [
  { name: "Snorkeling at Blue Lagoon", port: "Nassau" },
  { name: "Historic Old Town Walking Tour", port: "Cartagena" },
  { name: "Zipline Canopy Adventure", port: "Costa Maya" },
  { name: "Cenote Swim & Ruins", port: "Cozumel" },
];

const DRINKS = ["Mango Daiquiri", "Craft IPA", "Sparkling Water", "Espresso Martini", "Piña Colada"];
const VENUES = ["Lido Bar", "Main Pool Bar", "Sunset Terrace", "The Captain's Lounge"];
const AD_CAMPAIGNS = ["Drink Package Upsell", "Spa Promotion", "Port Shopping Guide", "Specialty Dining"];
const AD_PLACEMENTS = ["cabin_tv", "poolside_screen", "restaurant_menu_tablet", "app_banner"];

function randomId(): string {
  return `G${Math.floor(Math.random() * 9000) + 1000}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEvent(): Omit<ShipEvent, "id" | "createdAt"> {
  const types: ShipEventType[] = ["guest_checkin", "excursion_booking", "drink_purchase", "ad_impression"];
  const type = pick(types);

  switch (type) {
    case "guest_checkin": {
      const payload: GuestCheckinPayload = {
        guestId: randomId(),
        name: pick(GUEST_NAMES),
        cabin: `${Math.floor(Math.random() * 9) + 1}${String(Math.floor(Math.random() * 50) + 1).padStart(2, "0")}`,
        deck: Math.floor(Math.random() * 10) + 3,
      };
      return { type, payload };
    }
    case "excursion_booking": {
      const excursion = pick(EXCURSIONS);
      const payload: ExcursionBookingPayload = {
        guestId: randomId(),
        excursion: excursion.name,
        port: excursion.port,
        amount: Math.floor(Math.random() * 120) + 40,
      };
      return { type, payload };
    }
    case "drink_purchase": {
      const payload: DrinkPurchasePayload = {
        guestId: randomId(),
        item: pick(DRINKS),
        venue: pick(VENUES),
        amount: Math.floor(Math.random() * 14) + 8,
      };
      return { type, payload };
    }
    case "ad_impression": {
      const payload: AdImpressionPayload = {
        adId: `AD-${Math.floor(Math.random() * 900) + 100}`,
        campaign: pick(AD_CAMPAIGNS),
        placement: pick(AD_PLACEMENTS),
        guestId: randomId(),
      };
      return { type, payload };
    }
  }
  // TypeScript can't prove the switch is exhaustive when the discriminant comes
  // from a runtime array — this unreachable throw satisfies the return type check
  throw new Error(`Unhandled event type`);
}

// ─── SSE Route ────────────────────────────────────────────────────────────────

// SSE requires the route to never resolve — we return a ReadableStream that
// pushes data and stays open until the client disconnects
export async function GET(request: NextRequest): Promise<Response> {
  // Validate JWT from cookie — SSE doesn't support Authorization headers
  // easily from EventSource, so we authenticate via httpOnly cookie
  const token = request.cookies.get("shipstream_token")?.value;
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    verifyToken(token);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Signal the stream is alive — some proxies close idle connections
      const sendKeepAlive = () => {
        controller.enqueue(`: keep-alive\n\n`);
      };

      const sendEvent = async () => {
        const generated = generateEvent();

        // Persist every event — provides the historical batch for AI analysis
        // payload stored as JSON string because SQLite has no native JSON column
        const saved = await prisma.event.create({
          data: {
            type: generated.type,
            payload: JSON.stringify(generated.payload),
          },
        });

        const event: ShipEvent = {
          ...generated,
          id: saved.id,
          createdAt: saved.createdAt.toISOString(),
        } as ShipEvent;

        // SSE wire format: "data: <json>\n\n"
        // The `event:` field lets clients filter with addEventListener(type)
        const message = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(message);
      };

      // Emit an event immediately then every 2 seconds
      await sendEvent();
      const eventInterval = setInterval(sendEvent, 2000);
      const keepAliveInterval = setInterval(sendKeepAlive, 15000);

      // request.signal fires when the client closes the connection (tab close,
      // navigation, component unmount). Clean up intervals to avoid memory leaks.
      request.signal.addEventListener("abort", () => {
        clearInterval(eventInterval);
        clearInterval(keepAliveInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      // Vercel and some proxies buffer by default — X-Accel-Buffering disables it
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
