"use client";

import { useState, useRef, useCallback } from "react";

export interface Prediction {
  baseCost: number;
  finalCost: number;
  multiplier: number;
  reason: string;
  warning: string | null;
}

export function useSpoonPrediction(currentSpoons: number) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideCost, setOverrideCost] = useState(3);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const predict = useCallback(
    (title: string, category?: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (!title.trim() || title.trim().length < 3) {
        setPrediction(null);
        setIsPredicting(false);
        return;
      }

      setIsPredicting(true);

      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const res = await fetch("/api/predict-spoons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title.trim(),
              category,
              currentSpoons,
            }),
            signal: controller.signal,
          });

          if (res.ok) {
            const data = await res.json();
            if (!controller.signal.aborted) {
              setPrediction({
                baseCost: data.baseCost,
                finalCost: data.finalCost,
                multiplier: data.multiplier,
                reason: data.reason,
                warning: data.warning ?? null,
              });
              setOverrideCost(data.finalCost);
            }
          }
        } catch {
          // Aborted or network error
        } finally {
          if (!controller.signal.aborted) {
            setIsPredicting(false);
          }
        }
      }, 500);
    },
    [currentSpoons],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    setPrediction(null);
    setIsPredicting(false);
    setOverrideMode(false);
    setOverrideCost(3);
  }, []);

  // finalCost already has multiplier baked in from the API
  const cost = overrideMode ? overrideCost : (prediction?.finalCost ?? 3);
  // If overriding, multiplier hasn't been applied — flag it
  const multiplierApplied = !overrideMode;
  const wouldGoNegative = currentSpoons - cost < 0;

  return {
    prediction,
    isPredicting,
    overrideMode,
    setOverrideMode,
    overrideCost,
    setOverrideCost,
    /** The cost to submit. If from AI, multiplier is already applied. If overridden, it's raw. */
    finalCost: cost,
    /** Whether the disease multiplier has already been applied to finalCost */
    multiplierApplied,
    wouldGoNegative,
    predict,
    reset,
  };
}
