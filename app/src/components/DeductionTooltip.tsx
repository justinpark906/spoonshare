"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DailyBudget, WeatherInfo, useSpoonStore } from "@/store/useSpoonStore";
import { createClient } from "@/lib/supabase/client";

interface ManualEventRow {
  title: string;
  spoon_cost: number;
  category: string;
  start_time: string;
}

interface ClaimedTaskRow {
  event_title: string;
  spoon_cost: number;
  caregiver_name: string;
  claimed_at?: string;
}

interface Props {
  budget: DailyBudget;
  weather: WeatherInfo | null;
}

interface ActivityRow {
  id: string;
  at: string;
  label: string;
  delta: number;
}

function formatActivityTime(iso?: string) {
  if (!iso) return "";

  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function DeductionTooltip({ budget, weather }: Props) {
  const maxSpoons = 20;
  const [isOpen, setIsOpen] = useState(false);
  const [manualEvents, setManualEvents] = useState<ManualEventRow[]>([]);
  const [claimedTasks, setClaimedTasks] = useState<ClaimedTaskRow[]>([]);
  const [currentFromLog, setCurrentFromLog] = useState<number | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const effectiveSpoons = useSpoonStore((s) => s.effectiveSpoons);
  const profile = useSpoonStore((s) => s.profile);

  const hasDeductions = budget.deduction_reasons.length > 0;
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00.000Z`;
  const todayEnd = `${today}T23:59:59.999Z`;

  useEffect(() => {
    if (!isOpen || !profile?.id) return;
    setLoadingActivity(true);
    const supabase = createClient();
    Promise.all([
      supabase
        .from("manual_events")
        .select("title, spoon_cost, category, start_time")
        .eq("user_id", profile.id)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .order("start_time", { ascending: true }),
      supabase
        .from("daily_logs")
        .select("claimed_tasks, current_spoons")
        .eq("user_id", profile.id)
        .eq("date", today)
        .single(),
    ])
      .then(([eventsRes, claimsRes]) => {
        setManualEvents(eventsRes.data ?? []);
        const claims = (claimsRes.data?.claimed_tasks ??
          []) as ClaimedTaskRow[];
        setClaimedTasks(claims);
        const currentSpoons = claimsRes.data?.current_spoons;
        setCurrentFromLog(
          typeof currentSpoons === "number" ? currentSpoons : null,
        );
      })
      .finally(() => setLoadingActivity(false));
  }, [isOpen, profile?.id, today, todayStart, todayEnd]);

  const morningAdjustment = maxSpoons - budget.starting_spoons;

  const activityRows: ActivityRow[] = [
    ...manualEvents.map((event, index) => ({
      id: `manual-${index}`,
      at: event.start_time,
      label: event.title,
      delta:
        event.category === "rest"
          ? Number(event.spoon_cost ?? 0)
          : -Number(event.spoon_cost ?? 0),
    })),
    ...claimedTasks.map((claim, index) => ({
      id: `claim-${index}`,
      at: claim.claimed_at ?? "",
      label: `${claim.caregiver_name} claimed “${claim.event_title}”`,
      delta: Number(claim.spoon_cost ?? 0),
    })),
  ].sort((a, b) => {
    const aTs = new Date(a.at).getTime();
    const bTs = new Date(b.at).getTime();
    const safeA = Number.isFinite(aTs) ? aTs : Number.MAX_SAFE_INTEGER;
    const safeB = Number.isFinite(bTs) ? bTs : Number.MAX_SAFE_INTEGER;
    return safeA - safeB;
  });

  const calculatedCurrent = activityRows.reduce(
    (running, row) => Math.min(maxSpoons, Math.max(0, running + row.delta)),
    budget.starting_spoons,
  );
  const finalCurrent = currentFromLog ?? calculatedCurrent;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="text-data text-text-secondary hover:text-primary transition-colors duration-200 flex items-center gap-grid-1 cursor-pointer min-h-[44px]"
      >
        <span>Why is my budget {currentFromLog ?? effectiveSpoons}?</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mt-grid-2 bg-surface border border-[rgba(255,255,255,0.1)] rounded-card p-grid-3 space-y-grid-2 overflow-hidden"
          >
            {/* Formula breakdown */}
            <div className="space-y-grid-1">
              <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                Budget Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-grid-1 text-data">
                <span className="text-text-secondary">Effective Baseline</span>
                <span className="text-text-primary text-right font-mono">
                  {budget.effective_baseline} spoons
                </span>

                <span className="text-text-secondary">Sleep Factor</span>
                <span className="text-text-primary text-right font-mono">
                  x {budget.sleep_factor.toFixed(1)} (
                  {Math.round(budget.sleep_factor * 100)}%)
                </span>

                {budget.weather_deduction > 0 && (
                  <>
                    <span className="text-warning">Weather Deduction</span>
                    <span className="text-warning text-right font-mono">
                      -{budget.weather_deduction} spoons
                    </span>
                  </>
                )}

                {(budget.hrv_deduction ?? 0) > 0 && (
                  <>
                    <span className="text-primary">HRV Deduction</span>
                    <span className="text-primary text-right font-mono">
                      -{budget.hrv_deduction} spoons
                    </span>
                  </>
                )}

                {budget.pain_deduction > 0 && (
                  <>
                    <span className="text-critical">Pain Deduction</span>
                    <span className="text-critical text-right font-mono">
                      -{budget.pain_deduction.toFixed(1)} spoons
                    </span>
                  </>
                )}

                <span className="text-text-primary font-semibold border-t border-[rgba(255,255,255,0.1)] pt-grid-1">
                  Starting Budget
                </span>
                <span className="text-text-primary font-semibold text-right font-mono border-t border-[rgba(255,255,255,0.1)] pt-grid-1">
                  {budget.starting_spoons} spoons
                </span>
              </div>
            </div>

            {/* Current spoons calculation: starting − activities + caregiver claims */}
            <div className="space-y-grid-1 border-t border-[rgba(255,255,255,0.1)] pt-grid-2">
              <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                How you got to current spoons
              </h4>
              <div className="text-data space-y-grid-1">
                <div className="flex justify-between gap-grid-2">
                  <span className="text-text-secondary">Max daily spoons</span>
                  <span className="font-mono text-text-primary">
                    {maxSpoons}
                  </span>
                </div>
                {morningAdjustment > 0 && (
                  <div className="flex justify-between gap-grid-2 text-warning">
                    <span className="truncate">− Morning adjustments</span>
                    <span className="font-mono shrink-0">
                      −{morningAdjustment}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-grid-2">
                  <span className="text-text-secondary">= Starting today</span>
                  <span className="font-mono text-text-primary">
                    {budget.starting_spoons}
                  </span>
                </div>
                {loadingActivity ? (
                  <p className="text-text-secondary text-[12px]">
                    Loading activities…
                  </p>
                ) : (
                  <>
                    {activityRows.map((row) => {
                      const isGain = row.delta >= 0;
                      const sign = isGain ? "+" : "−";
                      const amount = Math.abs(row.delta);
                      const timeLabel = formatActivityTime(row.at);

                      return (
                        <div
                          key={row.id}
                          className={`flex justify-between gap-grid-2 ${isGain ? "text-primary" : "text-critical"}`}
                        >
                          <span className="truncate">
                            {timeLabel ? `${timeLabel} · ` : ""}
                            {sign} {row.label}
                          </span>
                          <span className="font-mono shrink-0">
                            {sign}
                            {amount}
                          </span>
                        </div>
                      );
                    })}
                    {activityRows.length > 0 && (
                      <div className="flex justify-between gap-grid-2 font-semibold border-t border-[rgba(255,255,255,0.08)] pt-grid-1 mt-grid-1">
                        <span className="text-text-primary">
                          = Current spoons
                        </span>
                        <span className="font-mono text-text-primary">
                          {finalCurrent}
                        </span>
                      </div>
                    )}
                    {activityRows.length === 0 && (
                      <p className="text-text-secondary text-[12px]">
                        No activities or caregiver claims yet today — current =
                        starting ({budget.starting_spoons}).
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Weather info */}
            {weather && (
              <div className="space-y-grid-1">
                <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                  Weather Conditions
                </h4>
                <div className="text-data text-text-primary/80 space-y-grid-1">
                  <p>
                    Pressure:{" "}
                    <span className="font-mono">
                      {weather.pressure_hpa} hPa
                    </span>
                    {weather.pressure_delta !== 0 && (
                      <span
                        className={
                          weather.pressure_delta < -5
                            ? "text-critical"
                            : "text-text-secondary"
                        }
                      >
                        {" "}
                        (
                        <span className="font-mono">
                          {weather.pressure_delta > 0 ? "+" : ""}
                          {weather.pressure_delta.toFixed(1)}
                        </span>{" "}
                        hPa in 12h)
                      </span>
                    )}
                  </p>
                  <p>
                    Temperature:{" "}
                    <span className="font-mono">
                      {weather.temperature_c.toFixed(1)}°C
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Deduction reasons */}
            {hasDeductions && (
              <div className="space-y-grid-1">
                <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                  Why Your Budget Changed
                </h4>
                <ul className="space-y-grid-1">
                  {budget.deduction_reasons.map((reason, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-grid-1 text-data text-warning"
                    >
                      <svg
                        className="w-4 h-4 mt-0.5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasDeductions && (
              <p className="text-data text-primary">
                No unusual deductions today — you&apos;re starting at a normal
                baseline!
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
