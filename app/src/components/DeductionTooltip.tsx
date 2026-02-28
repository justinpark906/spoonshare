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
        className="text-sm text-slate-400 hover:text-violet-400 transition flex items-center gap-1"
      >
        <span>Why is my budget {budget.starting_spoons}?</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
            className="mt-3 bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4 overflow-hidden"
          >
            {/* Formula breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Budget Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-slate-400">Effective Baseline</span>
                <span className="text-white text-right">
                  {budget.effective_baseline} spoons
                </span>

                <span className="text-slate-400">Sleep Factor</span>
                <span className="text-white text-right">
                  x {budget.sleep_factor.toFixed(1)} (
                  {Math.round(budget.sleep_factor * 100)}%)
                </span>

                {budget.weather_deduction > 0 && (
                  <>
                    <span className="text-orange-400">Weather Deduction</span>
                    <span className="text-orange-400 text-right">
                      -{budget.weather_deduction} spoons
                    </span>
                  </>
                )}

                {budget.pain_deduction > 0 && (
                  <>
                    <span className="text-rose-400">Pain Deduction</span>
                    <span className="text-rose-400 text-right">
                      -{budget.pain_deduction.toFixed(1)} spoons
                    </span>
                  </>
                )}

                <span className="text-white font-semibold border-t border-slate-700 pt-2">
                  Starting Budget
                </span>
                <span className="text-white font-semibold text-right border-t border-slate-700 pt-2">
                  {budget.starting_spoons} spoons
                </span>
              </div>
            </div>

            {/* Weather info */}
            {weather && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Weather Conditions
                </h4>
                <div className="text-sm text-slate-300 space-y-1">
                  <p>
                    Pressure: {weather.pressure_hpa} hPa
                    {weather.pressure_delta !== 0 && (
                      <span
                        className={
                          weather.pressure_delta < -5
                            ? "text-red-400"
                            : "text-slate-500"
                        }
                      >
                        {" "}
                        ({weather.pressure_delta > 0 ? "+" : ""}
                        {weather.pressure_delta.toFixed(1)} hPa in 12h)
                      </span>
                    )}
                  </p>
                  <p>Temperature: {weather.temperature_c.toFixed(1)}°C</p>
                </div>
              </div>
            )}

            {/* Deduction reasons */}
            {hasDeductions && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Why Your Budget Changed
                </h4>
                <ul className="space-y-1">
                  {budget.deduction_reasons.map((reason, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-amber-300"
                    >
                      <span className="mt-0.5">⚠️</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasDeductions && (
              <p className="text-sm text-emerald-400">
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
