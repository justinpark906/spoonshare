"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onComplete: () => void;
}

export default function MorningCheckIn({ onComplete }: Props) {
  const [sleepScore, setSleepScore] = useState(5);
  const [painScore, setPainScore] = useState(5);
  const [wearableEnabled, setWearableEnabled] = useState(false);
  const [wearableSleepScore, setWearableSleepScore] = useState(70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSleepLabel = (val: number) => {
    if (val <= 2) return "Terrible — barely slept";
    if (val <= 4) return "Poor — restless night";
    if (val <= 6) return "Okay — some rest";
    if (val <= 8) return "Good — fairly restored";
    return "Excellent — fully recharged";
  };

  const getPainLabel = (val: number) => {
    if (val <= 2) return "Minimal discomfort";
    if (val <= 4) return "Mild — manageable";
    if (val <= 6) return "Moderate — noticeable";
    if (val <= 8) return "Severe — limiting";
    return "Extreme — overwhelming";
  };

  const getSleepColor = (val: number) => {
    if (val <= 3) return "text-red-400";
    if (val <= 5) return "text-orange-400";
    if (val <= 7) return "text-yellow-400";
    return "text-emerald-400";
  };

  const getPainColor = (val: number) => {
    if (val <= 3) return "text-emerald-400";
    if (val <= 5) return "text-yellow-400";
    if (val <= 7) return "text-orange-400";
    return "text-red-400";
  };

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/morning-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sleep_score: sleepScore,
          pain_score: painScore,
          wearable_sleep_score: wearableEnabled ? wearableSleepScore : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to calculate budget");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-lg mx-auto space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Morning Pre-Flight</h2>
        <p className="mt-1 text-slate-400">
          How are you starting today? This calibrates your spoon budget.
        </p>
      </div>

      {/* Sleep Quality Slider */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">😴</span>
          <div>
            <h3 className="text-lg font-semibold text-white">Sleep Quality</h3>
            <p className="text-sm text-slate-400">How restored do you feel?</p>
          </div>
        </div>

        <input
          type="range"
          min={1}
          max={10}
          value={sleepScore}
          onChange={(e) => setSleepScore(Number(e.target.value))}
          className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Terrible</span>
          <span
            className={`text-sm font-semibold ${getSleepColor(sleepScore)}`}
          >
            {sleepScore}/10 — {getSleepLabel(sleepScore)}
          </span>
          <span className="text-xs text-slate-500">Excellent</span>
        </div>
      </div>

      {/* Pain / Fog Slider */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌫️</span>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Pain & Brain Fog
            </h3>
            <p className="text-sm text-slate-400">
              What is your baseline discomfort right now?
            </p>
          </div>
        </div>

        <input
          type="range"
          min={1}
          max={10}
          value={painScore}
          onChange={(e) => setPainScore(Number(e.target.value))}
          className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Minimal</span>
          <span className={`text-sm font-semibold ${getPainColor(painScore)}`}>
            {painScore}/10 — {getPainLabel(painScore)}
          </span>
          <span className="text-xs text-slate-500">Extreme</span>
        </div>
      </div>

      {/* Wearable Sync Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⌚</span>
            <div>
              <h3 className="text-base font-semibold text-white">
                Manual Wearable Sync
              </h3>
              <p className="text-xs text-slate-400">
                Enter sleep score from Apple Watch / Oura
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWearableEnabled(!wearableEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              wearableEnabled ? "bg-violet-600" : "bg-slate-700"
            }`}
          >
            <motion.div
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
              animate={{ left: wearableEnabled ? "26px" : "2px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {wearableEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <label className="text-sm text-slate-300">
              Sleep Score (0–100)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={wearableSleepScore}
              onChange={(e) =>
                setWearableSleepScore(
                  Math.min(100, Math.max(0, Number(e.target.value))),
                )
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition"
            />
            <p className="text-xs text-slate-500">
              This overrides self-reported sleep (converted to 1–10 scale)
            </p>
          </motion.div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 text-lg transition"
      >
        {loading ? "Calculating your budget..." : "Calculate Today's Spoons"}
      </button>
    </motion.div>
  );
}
