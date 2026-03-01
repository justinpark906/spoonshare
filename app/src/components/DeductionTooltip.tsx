"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DailyBudget, WeatherInfo } from "@/store/useSpoonStore";

interface Props {
  budget: DailyBudget;
  weather: WeatherInfo | null;
}

export default function DeductionTooltip({ budget, weather }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const hasDeductions = budget.deduction_reasons.length > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="text-data text-text-secondary hover:text-primary transition-colors duration-200 flex items-center gap-grid-1 cursor-pointer min-h-[44px]"
      >
        <span>Why is my budget {budget.starting_spoons}?</span>
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
