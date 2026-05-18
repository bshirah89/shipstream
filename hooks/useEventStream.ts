"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ShipEvent, ShipEventType } from "@/types";

interface UseEventStreamOptions {
  maxEvents?: number; // Cap the list length to avoid unbounded memory growth
}

interface UseEventStreamReturn {
  events: ShipEvent[];
  connected: boolean;
  error: string | null;
  clearEvents: () => void;
}

export function useEventStream(
  options: UseEventStreamOptions = {}
): UseEventStreamReturn {
  const { maxEvents = 50 } = options;
  const [events, setEvents] = useState<ShipEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref so the cleanup function always has access to the current EventSource
  // instance without needing it as a dependency
  const sourceRef = useRef<EventSource | null>(null);

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    // EventSource automatically reconnects on network errors — we only need to
    // set up listeners once and let the browser handle transient failures
    const source = new EventSource("/api/events/stream");
    sourceRef.current = source;

    source.onopen = () => {
      setConnected(true);
      setError(null);
    };

    source.onerror = () => {
      setConnected(false);
      // Don't set error here — EventSource retries automatically and will
      // call onopen again when reconnected
    };

    // Listen on all four event types — the server sends `event: <type>` on each message
    const eventTypes: ShipEventType[] = [
      "guest_checkin",
      "excursion_booking",
      "drink_purchase",
      "ad_impression",
    ];

    const handleEvent = (messageEvent: MessageEvent) => {
      const data: ShipEvent = JSON.parse(messageEvent.data as string);
      setEvents((prev) => {
        // Prepend newest event and trim to maxEvents — O(1) amortized
        const next = [data, ...prev];
        return next.length > maxEvents ? next.slice(0, maxEvents) : next;
      });
    };

    for (const type of eventTypes) {
      source.addEventListener(type, handleEvent);
    }

    // Cleanup: close the SSE connection when the component unmounts.
    // This triggers the abort signal on the server, which clears the intervals.
    return () => {
      for (const type of eventTypes) {
        source.removeEventListener(type, handleEvent);
      }
      source.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, []); // Empty deps — only open one connection for the lifetime of the component

  return { events, connected, error, clearEvents };
}
