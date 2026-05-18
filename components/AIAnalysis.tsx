"use client";

import { useState, useRef } from "react";
import type { ShipEvent } from "@/types";

interface AIAnalysisProps {
  events: ShipEvent[];
}

type AnalysisState = "idle" | "loading" | "streaming" | "done" | "error";

export function AIAnalysis({ events }: AIAnalysisProps) {
  const [state, setState] = useState<AnalysisState>("idle");
  const [summary, setSummary] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  // Track the ongoing fetch so we can abort it if the user triggers again
  const abortRef = useRef<AbortController | null>(null);

  const analyze = async () => {
    if (events.length === 0) return;

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");
    setSummary("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err: { error?: string } = await res.json();
        throw new Error(err.error ?? "Analysis failed");
      }

      if (!res.body) throw new Error("No response body");

      setState("streaming");

      // Stream the response body — each chunk is a UTF-8 text fragment
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setSummary((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setState("done");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  const buttonLabel = {
    idle: "Analyze with AI",
    loading: "Connecting…",
    streaming: "Streaming…",
    done: "Analyze Again",
    error: "Retry Analysis",
  }[state];

  const isDisabled = state === "loading" || state === "streaming" || events.length === 0;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h2 className="text-sm font-semibold text-slate-200">AI Operations Brief</h2>
        </div>
        <button
          onClick={analyze}
          disabled={isDisabled}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isDisabled
              ? "bg-slate-700 text-slate-500 cursor-not-allowed"
              : "bg-amber-500 hover:bg-amber-400 text-slate-900 cursor-pointer"
          }`}
        >
          {buttonLabel}
        </button>
      </div>

      {/* Output area */}
      <div className="p-4 min-h-[180px]">
        {state === "idle" && (
          <p className="text-slate-500 text-sm">
            Click &ldquo;Analyze with AI&rdquo; to get a Claude-powered operational
            summary of the current event batch ({events.length} events loaded).
          </p>
        )}

        {state === "loading" && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <span className="animate-spin">⟳</span>
            <span>Sending {events.length} events to Claude…</span>
          </div>
        )}

        {(state === "streaming" || state === "done") && (
          <div className="space-y-2">
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
              {summary}
              {/* Blinking cursor while streaming */}
              {state === "streaming" && (
                <span className="inline-block w-0.5 h-4 bg-amber-400 animate-pulse ml-0.5 align-middle" />
              )}
            </p>
            {state === "done" && (
              <p className="text-xs text-slate-600">
                Powered by Claude claude-opus-4-7 · {events.length} events analyzed
              </p>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="text-red-400 text-sm">
            <p className="font-semibold">Analysis failed</p>
            <p className="text-red-500/80 mt-1">{errorMsg}</p>
            {errorMsg.includes("ANTHROPIC_API_KEY") && (
              <p className="text-slate-400 mt-2 text-xs">
                Add your API key to <code className="bg-slate-700 px-1 rounded">.env.local</code> and restart the dev server.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
