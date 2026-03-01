"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [events, setEvents] = useState<ManualEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [spoonCost, setSpoonCost] = useState(5);
  const [category, setCategory] = useState<"rest" | "light" | "moderate" | "heavy">("moderate");
  const [notes, setNotes] = useState("");

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
          spoon_cost: spoonCost,
          category,
          start_time: startTime.toISOString(),
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setSpoonCost(5);
        setNotes("");
        await fetchEvents();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/manual-events/${id}`, { method: "DELETE" });
      await fetchEvents();
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
    <div className="bg-surface border border-[rgba(255,255,255,0.1)] rounded-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-grid-3 hover:bg-white/5 transition-colors"
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
          className={`w-5 h-5 text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
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
              <div className="space-y-grid-2">
                <label className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                  Log an activity
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Grocery run, Phone call..."
                  className="w-full rounded-card border border-[rgba(255,255,255,0.1)] bg-background px-grid-2 py-[10px] text-text-primary placeholder:text-text-secondary/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-data"
                />
                <div className="flex flex-wrap gap-grid-2 items-center">
                  <div className="flex items-center gap-grid-1">
                    <label className="text-data text-text-secondary">Spoons:</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={spoonCost}
                      onChange={(e) =>
                        setSpoonCost(Math.min(10, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className="w-14 rounded-card border border-[rgba(255,255,255,0.1)] bg-background px-2 py-1.5 text-text-primary font-mono text-data text-center"
                    />
                  </div>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as "rest" | "light" | "moderate" | "heavy")
                    }
                    className="rounded-card border border-[rgba(255,255,255,0.1)] bg-background px-grid-2 py-1.5 text-text-primary text-data"
                  >
                    {(["rest", "light", "moderate", "heavy"] as const).map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel[c]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAdd}
                    disabled={submitting || !title.trim()}
                    className="px-grid-2 py-1.5 rounded-card bg-primary hover:bg-primary/80 disabled:opacity-50 text-background text-data font-medium transition-colors"
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
                    {events.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-center justify-between gap-grid-2 rounded-card border border-[rgba(255,255,255,0.08)] bg-background/50 px-grid-2 py-grid-1.5"
                      >
                        <div>
                          <span className="text-data text-text-primary font-medium">
                            {ev.title}
                          </span>
                          <span className="text-[12px] text-text-secondary ml-2">
                            {formatTime(ev.start_time)} · {categoryLabel[ev.category] ?? ev.category} · −{ev.spoon_cost} spoons
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
                    ))}
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
