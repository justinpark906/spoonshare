"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpoonStore } from "@/store/useSpoonStore";
import { useSpoonPrediction } from "@/hooks/useSpoonPrediction";

export interface ManualEvent {
  id: string;
  title: string;
  spoon_cost: number;
  category: string;
  start_time: string;
  end_time: string | null;
  notes: string | null;
  created_at: string;
}

export default function SpoonLedger() {
  const syncWithSupabase = useSpoonStore((s) => s.syncWithSupabase);
  const effectiveSpoons = useSpoonStore((s) => s.effectiveSpoons);
  const [events, setEvents] = useState<ManualEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<
    "rest" | "light" | "moderate" | "heavy"
  >("moderate");
  const [notes, setNotes] = useState("");

  // AI prediction
  const {
    prediction,
    isPredicting,
    overrideMode,
    setOverrideMode,
    overrideCost,
    setOverrideCost,
    finalCost,
    multiplierApplied,
    wouldGoNegative,
    predict,
    reset: resetPrediction,
  } = useSpoonPrediction(effectiveSpoons);

  const today = new Date().toISOString().split("T")[0];

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manual-events?from=${today}&to=${today}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        setEvents(data.events);
      }
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function handleTitleChange(value: string) {
    setTitle(value);
    predict(value, category);
  }

  function handleCategoryChange(
    value: "rest" | "light" | "moderate" | "heavy",
  ) {
    setCategory(value);
    if (title.trim().length >= 3) {
      predict(title, value);
    }
  }

  async function handleAdd() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const startTime = new Date();
      const res = await fetch("/api/manual-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          spoon_cost: finalCost,
          category,
          start_time: startTime.toISOString(),
          notes: notes.trim() || null,
          multiplier_applied: multiplierApplied,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setNotes("");
        resetPrediction();
        await fetchEvents();
        await syncWithSupabase();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/manual-events/${id}`, { method: "DELETE" });
      await fetchEvents();
      await syncWithSupabase();
    } catch {
      // ignore
    }
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  const categoryLabel: Record<string, string> = {
    rest: "Rest",
    light: "Light",
    moderate: "Moderate",
    heavy: "Heavy",
  };

  return (
    <div className="glass-card rounded-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-grid-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-200 cursor-pointer min-h-[44px]"
      >
        <div className="flex items-center gap-grid-2">
          <span className="text-xl" aria-hidden>
            📒
          </span>
          <div className="text-left">
            <h3 className="text-body font-semibold text-text-primary">
              Spoon Ledger
            </h3>
            <p className="text-[12px] text-text-secondary">
              Log manual events and activities
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-grid-3 pb-grid-3 space-y-grid-3">
              {/* Add event form */}
              <div
                className={`space-y-grid-2 rounded-card p-grid-2 -mx-grid-2 border transition-colors ${wouldGoNegative && prediction
                    ? "border-critical bg-critical/5"
                    : "border-transparent"
                  }`}
              >
                <label className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                  Log an activity
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Grocery run, Phone call..."
                  className="w-full rounded-card border border-[rgba(255,255,255,0.1)] bg-background px-grid-2 py-[10px] text-text-primary placeholder:text-text-secondary/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-data"
                />
                <div className="flex flex-wrap gap-grid-2 items-center">
                  <select
                    value={category}
                    onChange={(e) =>
                      handleCategoryChange(
                        e.target.value as
                        | "rest"
                        | "light"
                        | "moderate"
                        | "heavy",
                      )
                    }
                    className="rounded-card border border-[rgba(255,255,255,0.1)] bg-background px-grid-2 py-1.5 text-text-primary text-data"
                  >
                    {(["rest", "light", "moderate", "heavy"] as const).map(
                      (c) => (
                        <option key={c} value={c}>
                          {categoryLabel[c]}
                        </option>
                      ),
                    )}
                  </select>
                  <button
                    onClick={handleAdd}
                    disabled={
                      submitting ||
                      !title.trim() ||
                      (isPredicting && !overrideMode)
                    }
                    className="px-grid-2 py-1.5 rounded-card bg-primary hover:bg-primary/80 disabled:opacity-50 text-background text-data font-medium transition-colors duration-200 cursor-pointer min-h-[44px]"
                  >
                    {submitting ? "Adding..." : "Add"}
                  </button>
                </div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-card border border-[rgba(255,255,255,0.1)] bg-background px-grid-2 py-1.5 text-text-secondary text-data placeholder:text-text-secondary/60 focus:border-primary outline-none"
                />

                {/* AI Energy Forecast */}
                {isPredicting && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[11px] text-primary font-medium">
                      Calculating energy impact...
                    </p>
                    <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/40 rounded-full animate-pulse w-1/2" />
                    </div>
                  </div>
                )}

                {prediction && !isPredicting && !overrideMode && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-text-secondary">
                        AI Estimate:{" "}
                        <span className="font-mono font-semibold text-text-primary">
                          {prediction.finalCost}
                        </span>{" "}
                        spoons
                        {prediction.multiplier > 1 && (
                          <span className="text-text-secondary/60">
                            {" "}
                            ({prediction.baseCost} &times;{" "}
                            {prediction.multiplier}x)
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOverrideMode(true)}
                        className="text-[11px] text-text-secondary/60 hover:text-text-secondary cursor-pointer min-h-[44px]"
                      >
                        I know better
                      </button>
                    </div>
                    <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${wouldGoNegative ? "bg-critical" : "bg-primary"
                          }`}
                        style={{
                          width: `${(prediction.finalCost / 10) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-text-secondary/80">
                      {prediction.reason}
                    </p>
                    {prediction.warning && (
                      <p className="text-[11px] text-critical font-medium">
                        {prediction.warning}
                      </p>
                    )}
                  </div>
                )}

                {overrideMode && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-text-secondary">
                        Manual cost:{" "}
                        <span className="font-mono font-semibold text-text-primary">
                          {overrideCost}
                        </span>{" "}
                        spoons
                      </span>
                      <button
                        type="button"
                        onClick={() => setOverrideMode(false)}
                        className="text-[11px] text-primary cursor-pointer min-h-[44px]"
                      >
                        Use AI estimate
                      </button>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={overrideCost}
                      onChange={(e) => setOverrideCost(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                )}

                {!prediction && !isPredicting && (
                  <p className="text-[12px] text-text-secondary/80">
                    AI will estimate the energy cost as you type.
                  </p>
                )}
              </div>

              {/* Today's logged events */}
              <div className="space-y-grid-1">
                <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                  Today&apos;s log
                </h4>
                {loading ? (
                  <p className="text-data text-text-secondary">Loading...</p>
                ) : events.length === 0 ? (
                  <p className="text-data text-text-secondary/80">
                    No manual events yet. Add one above.
                  </p>
                ) : (
                  <ul className="space-y-grid-1">
                    {events.map((ev) => {
                      const isRestorative = ev.category === "rest";
                      const sign = isRestorative ? "+" : "−";

                      return (
                        <li
                          key={ev.id}
                          className="flex items-center justify-between gap-grid-2 rounded-card border border-[rgba(255,255,255,0.08)] bg-surface px-grid-2 py-grid-1.5"
                        >
                          <div>
                            <span className="text-data text-text-primary font-medium">
                              {ev.title}
                            </span>
                            <span
                              className={`text-[12px] ml-2 ${isRestorative ? "text-primary" : "text-text-secondary"}`}
                            >
                              {formatTime(ev.start_time)} ·{" "}
                              {categoryLabel[ev.category] ?? ev.category} ·{" "}
                              {sign}
                              {ev.spoon_cost} spoons
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(ev.id)}
                            className="text-[12px] text-critical hover:underline"
                            aria-label={`Delete ${ev.title}`}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
