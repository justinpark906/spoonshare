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

  // Only show when fog is active
  if (fogLevel === "healthy") return null;

  async function handleRest() {
    if (!profile || !dailyBudget) return;
    setResting(true);

    // Simulate a 30-minute rest block — restore 3 spoons
    const restoreAmount = 3;
    const newSpoons = effectiveSpoons + restoreAmount;
    const today = new Date().toISOString().split("T")[0];

    await supabase
      .from("daily_logs")
      .update({ current_spoons: newSpoons })
      .eq("user_id", profile.id)
      .eq("date", today);

    // Update local store
    useSpoonStore.setState({ effectiveSpoons: newSpoons });

    setResting(false);
    setRestored(true);
    setTimeout(() => setRestored(false), 3000);
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {restored && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full right-0 mb-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap shadow-lg"
          >
            +3 spoons restored — fog clearing...
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleRest}
        disabled={resting}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`flex items-center gap-2 px-5 py-3 rounded-full shadow-xl font-medium text-sm transition ${
          fogLevel === "emergency"
            ? "bg-red-600 hover:bg-red-500 text-white"
            : fogLevel === "critical"
              ? "bg-orange-600 hover:bg-orange-500 text-white"
              : "bg-amber-600 hover:bg-amber-500 text-white"
        } disabled:opacity-50`}
        // Keep this button OUTSIDE the fog filter so it remains readable
        style={{ filter: "none" }}
      >
        <span>🔋</span>
        {resting ? (
          "Resting..."
        ) : (
          <>
            Clear My Fog
            <span className="text-xs opacity-75">
              ({Math.round(spoonPercentage)}%)
            </span>
          </>
        )}
      </motion.button>
    </div>
  );
}
