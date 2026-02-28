"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useSpoonStore,
  ScheduleAudit,
  ScheduleOptimization,
  CrashPrediction,
  EventCost,
} from "@/store/useSpoonStore";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function CostBadge({ cost }: { cost: number }) {
  const color =
    cost <= 2
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : cost <= 4
        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        : cost <= 6
          ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
          : "bg-red-500/20 text-red-400 border-red-500/30";

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}
    >
      {cost} spoons
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: EventCost["priority"];
}) {
  const styles = {
    essential: "bg-red-500/15 text-red-300",
    important: "bg-violet-500/15 text-violet-300",
    flexible: "bg-blue-500/15 text-blue-300",
    deferrable: "bg-slate-500/15 text-slate-400",
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${styles[priority]}`}>
      {priority}
    </span>
  );
}

function SpoonTimeline({
  events,
  startingSpoons,
}: {
  events: EventCost[];
  startingSpoons: number;
}) {
  let remaining = startingSpoons;

  return (
    <div className="space-y-1">
      {events.map((event) => {
        remaining -= event.cost;
        const percentage = Math.max(0, (remaining / startingSpoons) * 100);

        return (
          <div key={event.id} className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 w-16 text-right shrink-0">
              {formatTime(event.start)}
            </span>
            <div className="flex-1">
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    remaining <= 0
                      ? "bg-red-500"
                      : remaining <= 3
                        ? "bg-orange-500"
                        : "bg-violet-500"
                  }`}
                  initial={{ width: "100%" }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
              </div>
            </div>
            <span
              className={`w-8 text-right text-xs font-mono ${
                remaining <= 0 ? "text-red-400" : "text-slate-400"
              }`}
            >
              {remaining}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  audit: ScheduleAudit;
  optimization: ScheduleOptimization | null;
  crashPrediction: CrashPrediction | null;
  startingSpoons: number;
  usingDemo: boolean;
}

export default function DailyForecast({
  audit,
  optimization,
  crashPrediction,
  startingSpoons,
  usingDemo,
}: Props) {
  const [viewMode, setViewMode] = useState<"original" | "optimized">(
    "original"
  );
  const { isAuditLoading } = useSpoonStore();

  if (isAuditLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="animate-pulse text-slate-400">
          AI is analyzing your schedule...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Crash Alert Banner */}
      {crashPrediction?.will_crash && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-6 text-center space-y-2"
        >
          <div className="text-3xl">🚨</div>
          <h3 className="text-lg font-bold text-red-400">
            Energy Crash Predicted
          </h3>
          <p className="text-red-300 text-sm">
            You&apos;re projected to crash at{" "}
            <span className="font-bold">
              {crashPrediction.crash_time
                ? formatTime(crashPrediction.crash_time)
                : "unknown"}
            </span>
            {crashPrediction.crash_event_title && (
              <>
                {" "}
                during{" "}
                <span className="font-bold">
                  {crashPrediction.crash_event_title}
                </span>
              </>
            )}
          </p>
          <p className="text-red-400/70 text-xs">
            {crashPrediction.spoons_over_budget} spoons over budget
          </p>
        </motion.div>
      )}

      {/* Energy Weather Forecast Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {audit.crash_probability > 70
                ? "🌪️"
                : audit.crash_probability > 40
                  ? "⛅"
                  : "☀️"}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Energy Weather Forecast
              </h3>
              <p className="text-sm text-slate-400">{audit.risk_summary}</p>
            </div>
          </div>
          {usingDemo && (
            <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-400 text-xs">
              Demo Data
            </span>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{startingSpoons}</p>
            <p className="text-xs text-slate-500">Starting Budget</p>
          </div>
          <div className="text-center">
            <p
              className={`text-2xl font-bold ${
                audit.total_projected_drain > startingSpoons
                  ? "text-red-400"
                  : "text-white"
              }`}
            >
              {audit.total_projected_drain}
            </p>
            <p className="text-xs text-slate-500">Projected Drain</p>
          </div>
          <div className="text-center">
            <p
              className={`text-2xl font-bold ${
                audit.crash_probability > 70
                  ? "text-red-400"
                  : audit.crash_probability > 40
                    ? "text-orange-400"
                    : "text-emerald-400"
              }`}
            >
              {audit.crash_probability}%
            </p>
            <p className="text-xs text-slate-500">Crash Risk</p>
          </div>
        </div>

        {/* Spoon Drain Timeline */}
        <div className="pt-2">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
            Energy Drain Timeline
          </p>
          <SpoonTimeline
            events={audit.event_costs}
            startingSpoons={startingSpoons}
          />
        </div>
      </div>

      {/* View Toggle — Original vs Optimized */}
      {optimization && (
        <div className="flex rounded-lg bg-slate-800 p-1">
          <button
            onClick={() => setViewMode("original")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              viewMode === "original"
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Original Schedule
          </button>
          <button
            onClick={() => setViewMode("optimized")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              viewMode === "optimized"
                ? "bg-violet-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            AI-Optimized
          </button>
        </div>
      )}

      {/* Event List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, x: viewMode === "optimized" ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: viewMode === "optimized" ? -20 : 20 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {viewMode === "original" ? (
            // Original schedule
            audit.event_costs.map((event) => (
              <div
                key={event.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-medium">{event.title}</h4>
                    <p className="text-sm text-slate-400">
                      {formatTime(event.start)} — {formatTime(event.end)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={event.priority} />
                    <CostBadge cost={event.cost} />
                  </div>
                </div>
                <p className="text-xs text-slate-500">{event.reason}</p>
              </div>
            ))
          ) : optimization ? (
            // Optimized schedule
            <>
              {/* Optimization summary */}
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
                <p className="text-sm text-violet-300">
                  {optimization.optimization_summary}
                </p>
                <div className="flex gap-4 mt-2 text-xs text-slate-400">
                  <span>
                    New drain:{" "}
                    <strong className="text-white">
                      {optimization.new_total_drain}
                    </strong>{" "}
                    spoons
                  </span>
                  <span>
                    Crash risk:{" "}
                    <strong
                      className={
                        optimization.new_crash_probability > 50
                          ? "text-orange-400"
                          : "text-emerald-400"
                      }
                    >
                      {optimization.new_crash_probability}%
                    </strong>
                  </span>
                </div>
              </div>

              {optimization.optimized_events.map((event) => (
                <div
                  key={event.id}
                  className={`bg-slate-900 border rounded-xl p-4 space-y-2 ${
                    event.action === "keep"
                      ? "border-slate-800"
                      : event.action === "move"
                        ? "border-amber-500/30"
                        : event.action === "cancel_suggest"
                          ? "border-red-500/30"
                          : "border-emerald-500/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium">
                          {event.title}
                        </h4>
                        {event.action !== "keep" && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              event.action === "move"
                                ? "bg-amber-500/20 text-amber-400"
                                : event.action === "cancel_suggest"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {event.action === "move"
                              ? "Reschedule"
                              : event.action === "cancel_suggest"
                                ? "Consider Canceling"
                                : "Rest Block"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">
                        {event.suggested_time
                          ? `${formatTime(event.original_time)} → ${formatTime(event.suggested_time)}`
                          : formatTime(event.original_time)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{event.note}</p>
                </div>
              ))}

              {/* Rest blocks */}
              {optimization.rest_blocks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">
                    Recommended Rest Blocks
                  </p>
                  {optimization.rest_blocks.map((block, i) => (
                    <div
                      key={i}
                      className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3"
                    >
                      <span className="text-xl">🔋</span>
                      <div>
                        <p className="text-sm text-emerald-300 font-medium">
                          {block.duration_minutes}min Spoon Recharge
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTime(block.start)} — {block.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
