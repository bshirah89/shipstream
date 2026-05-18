"use client";

import { useState, useCallback } from "react";
import { EventFeed } from "./EventFeed";
import { AIAnalysis } from "./AIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import type { ShipEvent } from "@/types";

interface DashboardProps {
  userEmail: string;
}

// Dashboard is a Client Component so it can hold the shared `currentEvents`
// state that flows from EventFeed → AIAnalysis without prop-drilling through
// a Server Component tree
export function Dashboard({ userEmail }: DashboardProps) {
  const [currentEvents, setCurrentEvents] = useState<ShipEvent[]>([]);
  const { logout } = useAuth();

  // useCallback so EventFeed doesn't re-render on every Dashboard render
  const handleEventsChange = useCallback((events: ShipEvent[]) => {
    setCurrentEvents(events);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Top nav */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚓</span>
            <div>
              <h1 className="text-base font-bold text-slate-100 leading-none">ShipStream</h1>
              <p className="text-xs text-slate-500">Real-time Operations Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 hidden sm:block">{userEmail}</span>
            <button
              onClick={logout}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg border border-slate-600 hover:border-slate-400"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="border-b border-slate-700/50 bg-slate-800/30">
        <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Events captured"
            value={currentEvents.length}
            icon="📡"
          />
          <StatCard
            label="Check-ins"
            value={currentEvents.filter((e) => e.type === "guest_checkin").length}
            icon="🛳️"
          />
          <StatCard
            label="Revenue events"
            value={
              currentEvents.filter(
                (e) => e.type === "excursion_booking" || e.type === "drink_purchase"
              ).length
            }
            icon="💰"
          />
          <StatCard
            label="Ad impressions"
            value={currentEvents.filter((e) => e.type === "ad_impression").length}
            icon="📺"
          />
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event feed takes 2/3 width on large screens */}
        <div className="lg:col-span-2 h-[600px]">
          <EventFeed onEventsChange={handleEventsChange} />
        </div>

        {/* AI panel */}
        <div className="lg:col-span-1">
          <AIAnalysis events={currentEvents} />
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-lg font-bold text-slate-100 leading-none">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
