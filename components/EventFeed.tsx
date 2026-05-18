"use client";

import { useEventStream } from "@/hooks/useEventStream";
import type { ShipEvent } from "@/types";

// ─── Event type display config ────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  ShipEvent["type"],
  { label: string; icon: string; color: string }
> = {
  guest_checkin: { label: "Check-In", icon: "🛳️", color: "text-blue-400" },
  excursion_booking: { label: "Excursion", icon: "⚓", color: "text-emerald-400" },
  drink_purchase: { label: "Purchase", icon: "🍹", color: "text-amber-400" },
  ad_impression: { label: "Ad", icon: "📺", color: "text-purple-400" },
};

function formatEventSummary(event: ShipEvent): string {
  switch (event.type) {
    case "guest_checkin":
      return `${event.payload.name} → Cabin ${event.payload.cabin} (Deck ${event.payload.deck})`;
    case "excursion_booking":
      return `${event.payload.excursion} at ${event.payload.port} — $${event.payload.amount}`;
    case "drink_purchase":
      return `${event.payload.item} at ${event.payload.venue} — $${event.payload.amount}`;
    case "ad_impression":
      return `"${event.payload.campaign}" on ${event.payload.placement}`;
  }
}

// ─── Single event row ─────────────────────────────────────────────────────────

function EventRow({ event }: { event: ShipEvent }) {
  const config = EVENT_CONFIG[event.type];
  const time = new Date(event.createdAt).toLocaleTimeString();

  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-700/50 animate-fadeIn">
      <span className="text-lg shrink-0">{config.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
            {config.label}
          </span>
          <span className="text-xs text-slate-500">{time}</span>
        </div>
        <p className="text-sm text-slate-300 truncate">{formatEventSummary(event)}</p>
      </div>
      <span className="text-xs text-slate-600 shrink-0">#{event.id}</span>
    </div>
  );
}

// ─── Feed component ───────────────────────────────────────────────────────────

interface EventFeedProps {
  onEventsChange?: (events: ShipEvent[]) => void;
}

export function EventFeed({ onEventsChange }: EventFeedProps) {
  const { events, connected, clearEvents } = useEventStream({ maxEvents: 50 });

  // Notify parent (Dashboard) so it can pass the current batch to AI analysis
  if (onEventsChange) {
    onEventsChange(events);
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Live Event Feed</h2>
          {/* Connection status indicator */}
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-slate-500">
            {connected ? "Connected" : "Reconnecting…"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{events.length} events</span>
          <button
            onClick={clearEvents}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Event list — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            Waiting for events…
          </div>
        ) : (
          events.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
