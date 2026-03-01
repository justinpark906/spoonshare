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
  const [hrvEnabled, setHrvEnabled] = useState(false);
  const [hrvMs, setHrvMs] = useState<number | "">("");
  const [restingHr, setRestingHr] = useState<number | "">("");
  const [biometricSource, setBiometricSource] = useState<"manual" | "apple_watch" | "oura">("manual");
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

  // MASTER.md: primary #2dd4bf, warning #f59e0b, critical #e11d48
  const getSleepColor = (val: number) => {
    if (val <= 3) return "text-critical";
    if (val <= 5) return "text-warning";
    if (val <= 7) return "text-warning";
    return "text-primary";
  };

  const getPainColor = (val: number) => {
    if (val <= 3) return "text-primary";
    if (val <= 5) return "text-warning";
    if (val <= 7) return "text-warning";
    return "text-critical";
  };

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        sleep_score: sleepScore,
        pain_score: painScore,
        wearable_sleep_score: wearableEnabled ? wearableSleepScore : null,
      };
      if (hrvEnabled && hrvMs !== "") {
        body.hrv_ms = Number(hrvMs);
        if (restingHr !== "") body.resting_hr = Number(restingHr);
        body.biometric_source = biometricSource;
      }
      const res = await fetch("/api/morning-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      className="w-full max-w-lg mx-auto space-y-grid-3"
    >
      <div className="text-center">
        <h2 className="text-h1 text-text-primary">Morning Pre-Flight</h2>
        <p className="mt-grid-1 text-body text-text-secondary">
          How are you starting today? This calibrates your spoon budget.
        </p>
      </div>

      {/* Sleep Quality Slider */}
      <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
        <div className="flex items-center gap-grid-2">
          <svg
            className="w-6 h-6 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <div>
            <h3 className="text-h2 text-text-primary">Sleep Quality</h3>
            <p className="text-data text-text-secondary">
              How restored do you feel?
            </p>
          </div>
        </div>

        <input
          type="range"
          min={1}
          max={10}
          value={sleepScore}
          onChange={(e) => setSleepScore(Number(e.target.value))}
          aria-label="Sleep quality score"
          className="w-full h-[12px] bg-surface rounded-pill appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between items-center">
          <span className="text-[12px] text-text-secondary">Terrible</span>
          <span
            className={`text-data font-semibold font-mono ${getSleepColor(sleepScore)}`}
          >
            {sleepScore}/10 — {getSleepLabel(sleepScore)}
          </span>
          <span className="text-[12px] text-text-secondary">Excellent</span>
        </div>
      </div>

      {/* Pain / Fog Slider */}
      <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
        <div className="flex items-center gap-grid-2">
          <svg
            className="w-6 h-6 text-text-secondary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
          <div>
            <h3 className="text-h2 text-text-primary">Pain & Brain Fog</h3>
            <p className="text-data text-text-secondary">
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
          aria-label="Pain and brain fog score"
          className="w-full h-[12px] bg-surface rounded-pill appearance-none cursor-pointer accent-critical"
        />
        <div className="flex justify-between items-center">
          <span className="text-[12px] text-text-secondary">Minimal</span>
          <span
            className={`text-data font-semibold font-mono ${getPainColor(painScore)}`}
          >
            {painScore}/10 — {getPainLabel(painScore)}
          </span>
          <span className="text-[12px] text-text-secondary">Extreme</span>
        </div>
      </div>

      {/* Health Bridge (HRV) — optional */}
      <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-grid-2">
            <svg
              className="w-6 h-6 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <div>
              <h3 className="text-body font-semibold text-text-primary">
                Health Bridge (HRV)
              </h3>
              <p className="text-[12px] text-text-secondary">
                Optional: HRV from watch or app for autonomic stress deduction
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hrvEnabled}
            aria-label="Toggle HRV entry"
            onClick={() => setHrvEnabled(!hrvEnabled)}
            className={`relative w-[48px] h-[24px] rounded-pill transition-colors duration-200 cursor-pointer ${
              hrvEnabled ? "bg-primary" : "bg-surface"
            }`}
          >
            <motion.div
              className="absolute top-[2px] w-5 h-5 bg-text-primary rounded-full shadow"
              animate={{ left: hrvEnabled ? "26px" : "2px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        {hrvEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-grid-2"
          >
            <div>
              <label htmlFor="hrv-ms" className="text-data text-text-secondary">
                HRV (ms)
              </label>
              <input
                id="hrv-ms"
                type="number"
                min={1}
                max={300}
                value={hrvMs === "" ? "" : hrvMs}
                onChange={(e) => {
                  const v = e.target.value;
                  setHrvMs(v === "" ? "" : Math.min(300, Math.max(1, Number(v))));
                }}
                placeholder="e.g. 45"
                className="w-full rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-[10px] text-text-primary font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200 mt-1"
              />
            </div>
            <div>
              <label htmlFor="resting-hr" className="text-data text-text-secondary">
                Resting HR (bpm) — optional
              </label>
              <input
                id="resting-hr"
                type="number"
                min={30}
                max={120}
                value={restingHr === "" ? "" : restingHr}
                onChange={(e) => {
                  const v = e.target.value;
                  setRestingHr(v === "" ? "" : Math.min(120, Math.max(30, Number(v))));
                }}
                placeholder="e.g. 62"
                className="w-full rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-[10px] text-text-primary font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200 mt-1"
              />
            </div>
            <div>
              <label className="text-data text-text-secondary block mb-1">Source</label>
              <select
                value={biometricSource}
                onChange={(e) => setBiometricSource(e.target.value as "manual" | "apple_watch" | "oura")}
                className="w-full rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-[10px] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="manual">Manual</option>
                <option value="apple_watch">Apple Watch</option>
                <option value="oura">Oura</option>
              </select>
            </div>
          </motion.div>
        )}
      </div>

      {/* Wearable Sync Toggle */}
      <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-grid-2">
            <svg
              className="w-6 h-6 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="6" y="2" width="12" height="20" rx="2" ry="2" />
              <path d="M12 18h.01" />
            </svg>
            <div>
              <h3 className="text-body font-semibold text-text-primary">
                Manual Wearable Sync
              </h3>
              <p className="text-[12px] text-text-secondary">
                Enter sleep score from Apple Watch / Oura
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={wearableEnabled}
            aria-label="Toggle wearable sync"
            onClick={() => setWearableEnabled(!wearableEnabled)}
            className={`relative w-[48px] h-[24px] rounded-pill transition-colors duration-200 cursor-pointer ${
              wearableEnabled ? "bg-primary" : "bg-surface"
            }`}
          >
            <motion.div
              className="absolute top-[2px] w-5 h-5 bg-text-primary rounded-full shadow"
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
            className="space-y-grid-1"
          >
            <label
              htmlFor="wearable-sleep"
              className="text-data text-text-secondary"
            >
              Sleep Score (0–100)
            </label>
            <input
              id="wearable-sleep"
              type="number"
              min={0}
              max={100}
              value={wearableSleepScore}
              onChange={(e) =>
                setWearableSleepScore(
                  Math.min(100, Math.max(0, Number(e.target.value))),
                )
              }
              className="w-full rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-[10px] text-text-primary font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200"
            />
            <p className="text-[12px] text-text-secondary/60">
              This overrides self-reported sleep (converted to 1–10 scale)
            </p>
          </motion.div>
        )}
      </div>

      {error && (
        <div
          className="bg-critical/10 border border-critical/30 text-critical rounded-card p-grid-2 text-data"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Min 44x44px touch target per MASTER.md §5 */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-pill bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold py-grid-2 text-h2 transition-colors duration-200 cursor-pointer min-h-[44px]"
      >
        {loading ? "Calculating your budget..." : "Calculate Today's Spoons"}
      </button>
    </motion.div>
  );
}
