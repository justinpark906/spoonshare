"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpoonStore } from "@/store/useSpoonStore";

interface Insight {
  risk_level: "low" | "medium" | "high";
  label: string;
  insight: string;
  action_label: string;
  action_type: "rest" | "move" | "cancel" | "none";
}

const riskConfig = {
  low: {
    icon: "\u2728",
    border: "border-primary/30",
    bg: "bg-primary/5",
    labelColor: "text-primary",
    btnClass: "",
  },
  medium: {
    icon: "\u26A1",
    border: "border-warning/40",
    bg: "bg-warning/5",
    labelColor: "text-warning",
    btnClass: "bg-warning hover:bg-warning/80 text-background",
  },
  high: {
    icon: "\uD83D\uDEE1\uFE0F",
    border: "border-critical/40",
    bg: "bg-critical/5",
    labelColor: "text-critical",
    btnClass: "bg-critical hover:bg-critical/80 text-white",
  },
};

export default function AIInsightCard() {
  const effectiveSpoons = useSpoonStore((s) => s.effectiveSpoons);
  const syncWithSupabase = useSpoonStore((s) => s.syncWithSupabase);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const [error, setError] = useState(false);

  const fetchInsight = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/ai-insight", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.risk_level) {
          setInsight(data);
        } else {
          setError(true);
        }
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Failed to fetch AI insight:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  async function handleAction() {
    if (!insight || insight.action_type === "none") return;
    setActing(true);

    try {
      if (insight.action_type === "rest") {
        // Create a 30-min rest block starting now
        const now = new Date();
        const end = new Date(now.getTime() + 30 * 60 * 1000);
        await fetch("/api/manual-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Rest Block (AI Recommended)",
            spoon_cost: 2,
            category: "rest",
            start_time: now.toISOString(),
            end_time: end.toISOString(),
            multiplier_applied: true,
          }),
        });
        await syncWithSupabase();
        setActionDone(true);
      }
      // For move/cancel, just mark as acknowledged
      if (insight.action_type === "move" || insight.action_type === "cancel") {
        setActionDone(true);
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-card p-grid-3 space-y-grid-2 animate-pulse">
        <div className="flex items-center gap-grid-2">
          <div className="w-6 h-6 rounded-full bg-primary/20" />
          <div className="h-4 w-32 bg-primary/10 rounded" />
        </div>
        <div className="h-4 w-full bg-primary/10 rounded" />
        <div className="h-4 w-2/3 bg-primary/10 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <section className="glass-card rounded-card p-grid-3 border border-primary/20">
        <div className="flex items-center gap-grid-2">
          <span className="text-xl" aria-hidden>
            {"\u2728"}
          </span>
          <span className="text-data font-semibold text-primary">
            Energy Stable
          </span>
        </div>
        <p className="text-body text-text-primary/80 mt-grid-1">
          Your energy data looks normal. Check back after logging some
          activities.
        </p>
      </section>
    );
  }

  if (!insight) return null;

  const config = riskConfig[insight.risk_level];
  const showAction =
    insight.risk_level !== "low" &&
    insight.action_type !== "none" &&
    !actionDone;

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`glass-card rounded-card p-grid-3 space-y-grid-2 border ${config.border} ${config.bg}`}
      >
        {/* Top row: icon + label */}
        <div className="flex items-center gap-grid-2">
          <span className="text-xl" aria-hidden>
            {config.icon}
          </span>
          <span className={`text-data font-semibold ${config.labelColor}`}>
            {insight.label}
          </span>
          {effectiveSpoons != null && (
            <span className="ml-auto text-[11px] text-text-secondary font-mono">
              {effectiveSpoons} spoons left
            </span>
          )}
        </div>

        {/* Middle row: insight sentence */}
        <p className="text-body text-text-primary font-medium leading-snug">
          {insight.insight}
        </p>

        {/* Bottom row: action button */}
        {showAction && (
          <button
            onClick={handleAction}
            disabled={acting}
            className={`px-grid-3 py-1.5 rounded-pill text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${config.btnClass}`}
          >
            {acting ? "Working..." : insight.action_label}
          </button>
        )}

        {actionDone && (
          <p className="text-[12px] text-primary font-medium">
            Done! Your schedule has been updated.
          </p>
        )}
      </motion.section>
    </AnimatePresence>
  );
}
