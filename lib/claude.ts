import Anthropic from "@anthropic-ai/sdk";
import type { ShipEvent } from "@/types";

// Lazy-initialized so the missing key only throws at call time, not import time.
// This lets the app boot and serve auth routes even without an API key configured.
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-anthropic-api-key-here") {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured. Add it to .env.local to enable AI analysis."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// Converts raw event objects into a compact human-readable summary for the
// Claude prompt — avoids sending redundant JSON structure tokens
function formatEventsForPrompt(events: ShipEvent[]): string {
  return events
    .map((e) => {
      const ts = new Date(e.createdAt).toLocaleTimeString();
      switch (e.type) {
        case "guest_checkin":
          return `[${ts}] CHECK-IN: ${e.payload.name} → Cabin ${e.payload.cabin}, Deck ${e.payload.deck}`;
        case "excursion_booking":
          return `[${ts}] EXCURSION: Guest ${e.payload.guestId} booked "${e.payload.excursion}" at ${e.payload.port} ($${e.payload.amount})`;
        case "drink_purchase":
          return `[${ts}] DRINK: Guest ${e.payload.guestId} ordered ${e.payload.item} at ${e.payload.venue} ($${e.payload.amount})`;
        case "ad_impression":
          return `[${ts}] AD: Campaign "${e.payload.campaign}" shown at ${e.payload.placement}`;
      }
    })
    .join("\n");
}

// Returns an async iterable of text chunks so the API route can stream them
// directly to the client without buffering the full response
export async function streamOperationalSummary(
  events: ShipEvent[]
): Promise<AsyncIterable<string>> {
  const client = getClient();
  const formatted = formatEventsForPrompt(events);

  const stream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    system:
      "You are an experienced cruise ship operations analyst. Analyze the provided real-time event feed and deliver a concise, actionable operational summary. Focus on passenger flow, revenue opportunities, and any patterns that operations staff should act on. Be direct and specific.",
    messages: [
      {
        role: "user",
        content: `Here are the last ${events.length} shipboard events. Provide a brief operational summary:\n\n${formatted}`,
      },
    ],
  });

  // Return the SDK's built-in text stream — each chunk is a string fragment
  return stream.toReadableStream() as unknown as AsyncIterable<string>;
}

// Non-streaming version for simpler use cases / testing
export async function getOperationalSummary(events: ShipEvent[]): Promise<string> {
  const client = getClient();
  const formatted = formatEventsForPrompt(events);

  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Summarize these shipboard events concisely:\n\n${formatted}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
