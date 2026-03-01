"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFog } from "./FogProvider";
import { useSpoonStore } from "@/store/useSpoonStore";
import { createClient } from "@/lib/supabase/client";

export default function ClearFogButton() {
  const { fogLevel, spoonPercentage } = useFog();
  const { profile, effectiveSpoons, dailyBudget } = useSpoonStore();
  const [resting, setResting] = useState(false);
  const [restored, setRestored] = useState(false);
  const supabase = createClient();

  if (fogLevel === "healthy") return null;

  async function handleRest() {
    if (!profile || !dailyBudget) return;
    setResting(true);

    const restoreAmount = 3;
    const newSpoons = effectiveSpoons + restoreAmount;
    const today = new Date().toISOString().split("T")[0];

    await supabase
      .from("daily_logs")
      .update({ current_spoons: newSpoons })
      .eq("user_id", profile.id)
      .eq("date", today);

    useSpoonStore.setState({ effectiveSpoons: newSpoons });

    setResting(false);
    setRestored(true);
    setTimeout(() => setRestored(false), 3000);
  }

  // MASTER.md: critical #e11d48, warning #f59e0b, primary #2dd4bf
  const buttonColor =
    fogLevel === "emergency"
      ? "bg-critical hover:bg-critical/80"
      : fogLevel === "critical"
        ? "bg-warning hover:bg-warning/80"
        : "bg-warning hover:bg-warning/80";

  return (
    <div className="fixed bottom-grid-3 right-grid-3 z-40">
      <AnimatePresence>
        {restored && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full right-0 mb-grid-1 bg-primary text-background px-grid-2 py-grid-1 rounded-card text-data font-medium whitespace-nowrap shadow-lg"
          >
            +3 spoons restored — fog clearing...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Min 44x44px touch target per MASTER.md §5 */}
      <motion.button
        onClick={handleRest}
        disabled={resting}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`flex items-center gap-grid-1 px-grid-3 py-grid-2 rounded-pill shadow-xl font-medium text-data transition-colors duration-200 cursor-pointer min-h-[44px] ${buttonColor} text-text-primary disabled:opacity-50`}
        style={{ filter: "none" }}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
          <line x1="23" y1="13" x2="23" y2="11" />
        </svg>
        {resting ? (
          "Resting..."
        ) : (
          <>
            Clear My Fog
            <span className="text-[12px] opacity-75 font-mono">
              ({Math.round(spoonPercentage)}%)
            </span>
          </>
        )}
      </motion.button>
    </div>
  );
}
