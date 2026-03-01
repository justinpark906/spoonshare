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

// MASTER.md: primary #2dd4bf, warning #f59e0b, critical #e11d48
function CostBadge({ cost }: { cost: number }) {
  const color =
    cost <= 2
      ? "bg-primary/20 text-primary border-primary/30"
      : cost <= 4
        ? "bg-warning/20 text-warning border-warning/30"
        : cost <= 6
          ? "bg-warning/20 text-warning border-warning/30"
          : "bg-critical/20 text-critical border-critical/30";

  return (
    <span
      className={`px-grid-1 py-[2px] rounded-pill text-[12px] font-semibold font-mono border ${color}`}
    >
      {cost} spoons
    </span>
  );
}

function PriorityBadge({ priority }: { priority: EventCost["priority"] }) {
  const styles = {
    essential: "bg-critical/15 text-critical",
    important: "bg-primary/15 text-primary",
    flexible: "bg-primary/10 text-primary/70",
    deferrable: "bg-surface text-text-secondary",
  };

  return (
    <span
      className={`px-grid-1 py-[2px] rounded text-[12px] ${styles[priority]}`}
    >
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
    <div className="space-y-grid-1">
      {events.map((event) => {
        remaining -= event.cost;
        const percentage = Math.max(0, (remaining / startingSpoons) * 100);

        return (
          <div
            key={event.id}
            className="flex items-center gap-grid-2 text-data"
          >
            <span className="text-text-secondary w-[64px] text-right shrink-0 font-mono">
              {formatTime(event.start)}
            </span>
            <div className="flex-1">
              <div className="h-grid-1 bg-surface rounded-pill overflow-hidden">
                <motion.div
                  className={`h-full rounded-pill ${
                    remaining <= 0
                      ? "bg-critical"
                      : remaining <= 3
                        ? "bg-warning"
                        : "bg-primary"
                  }`}
                  initial={{ width: "100%" }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
              </div>
            </div>
            <span
              className={`w-grid-4 text-right text-[12px] font-mono ${
                remaining <= 0 ? "text-critical" : "text-text-secondary"
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
    "original",
  );
  const { isAuditLoading } = useSpoonStore();

  if (isAuditLoading) {
    return (
      <div className="glass-card rounded-card p-grid-4 text-center">
        <div className="animate-pulse text-text-secondary">
          AI is analyzing your schedule...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-grid-3">
      {/* Crash Alert Banner */}
      {crashPrediction?.will_crash && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-critical/10 border-2 border-critical/40 rounded-card p-grid-3 text-center space-y-grid-1"
          role="alert"
        >
          <svg
            className="w-8 h-8 text-critical mx-auto"
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
          <h3 className="text-h2 font-bold text-critical">
            Energy Crash Predicted
          </h3>
          <p className="text-critical/80 text-data">
            You&apos;re projected to crash at{" "}
            <span className="font-bold font-mono">
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
          <p className="text-critical/50 text-[12px] font-mono">
            {crashPrediction.spoons_over_budget} spoons over budget
          </p>
        </motion.div>
      )}

      {/* Energy Weather Forecast Header */}
      <section className="glass-card rounded-card p-grid-3 space-y-grid-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-grid-2">
            <svg
              className={`w-6 h-6 ${audit.crash_probability > 70 ? "text-critical" : audit.crash_probability > 40 ? "text-warning" : "text-primary"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
            <div>
              <h3 className="text-h2 text-text-primary">
                Energy Weather Forecast
              </h3>
              <p className="text-data text-text-secondary">
                {audit.risk_summary}
              </p>
            </div>
          </div>
          {usingDemo && (
            <span className="px-grid-1 py-[4px] rounded bg-warning/15 text-warning text-[12px]">
              Demo Data
            </span>
          )}
        </div>

        {/* Stats Row — font-mono for numbers */}
        <div className="grid grid-cols-3 gap-grid-2">
          <div className="text-center">
            <p className="text-[24px] font-bold font-mono text-text-primary">
              {startingSpoons}
            </p>
            <p className="text-[12px] text-text-secondary">Starting Budget</p>
          </div>
          <div className="text-center">
            <p
              className={`text-[24px] font-bold font-mono ${
                audit.total_projected_drain > startingSpoons
                  ? "text-critical"
                  : "text-text-primary"
              }`}
            >
              {audit.total_projected_drain}
            </p>
            <p className="text-[12px] text-text-secondary">Projected Drain</p>
          </div>
          <div className="text-center">
            <p
              className={`text-[24px] font-bold font-mono ${
                audit.crash_probability > 70
                  ? "text-critical"
                  : audit.crash_probability > 40
                    ? "text-warning"
                    : "text-primary"
              }`}
            >
              {audit.crash_probability}%
            </p>
            <p className="text-[12px] text-text-secondary">Crash Risk</p>
          </div>
        </div>

        {/* Spoon Drain Timeline */}
        <div className="pt-grid-1">
          <p className="text-[12px] text-text-secondary mb-grid-1 uppercase tracking-wide">
            Energy Drain Timeline
          </p>
          <SpoonTimeline
            events={audit.event_costs}
            startingSpoons={startingSpoons}
          />
        </div>
      </section>

      {/* View Toggle — Original vs Optimized */}
      {optimization && (
        <div className="flex rounded-card bg-surface p-[4px]">
          <button
            onClick={() => setViewMode("original")}
            className={`flex-1 py-grid-1 text-data font-medium rounded-[10px] transition-colors duration-200 cursor-pointer min-h-[44px] ${
              viewMode === "original"
                ? "bg-[rgba(255,255,255,0.1)] text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Original Schedule
          </button>
          <button
            onClick={() => setViewMode("optimized")}
            className={`flex-1 py-grid-1 text-data font-medium rounded-[10px] transition-colors duration-200 cursor-pointer min-h-[44px] ${
              viewMode === "optimized"
                ? "bg-primary text-background"
                : "text-text-secondary hover:text-text-primary"
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
          className="space-y-grid-2"
        >
          {viewMode === "original" ? (
            audit.event_costs.map((event) => (
              <div
                key={event.id}
                className="glass-card rounded-card p-grid-2 space-y-grid-1"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-text-primary font-medium text-body">
                      {event.title}
                    </h4>
                    <p className="text-data text-text-secondary font-mono">
                      {formatTime(event.start)} — {formatTime(event.end)}
                    </p>
                  </div>
                  <div className="flex items-center gap-grid-1">
                    <PriorityBadge priority={event.priority} />
                    <CostBadge cost={event.cost} />
                  </div>
                </div>
                <p className="text-[12px] text-text-secondary">
                  {event.reason}
                </p>
              </div>
            ))
          ) : optimization ? (
            <>
              {/* Optimization summary */}
              <div className="bg-primary/10 border border-primary/30 rounded-card p-grid-2">
                <p className="text-data text-primary">
                  {optimization.optimization_summary}
                </p>
                <div className="flex gap-grid-2 mt-grid-1 text-[12px] text-text-secondary">
                  <span>
                    New drain:{" "}
                    <strong className="text-text-primary font-mono">
                      {optimization.new_total_drain}
                    </strong>{" "}
                    spoons
                  </span>
                  <span>
                    Crash risk:{" "}
                    <strong
                      className={`font-mono ${
                        optimization.new_crash_probability > 50
                          ? "text-warning"
                          : "text-primary"
                      }`}
                    >
                      {optimization.new_crash_probability}%
                    </strong>
                  </span>
                </div>
              </div>

              {optimization.optimized_events.map((event) => (
                <div
                  key={event.id}
                  className={`glass-card rounded-card p-grid-2 space-y-grid-1 ${
                    event.action === "keep"
                      ? ""
                      : event.action === "move"
                        ? "border-warning/30"
                        : event.action === "cancel_suggest"
                          ? "border-critical/30"
                          : "border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-grid-1">
                        <h4 className="text-text-primary font-medium text-body">
                          {event.title}
                        </h4>
                        {event.action !== "keep" && (
                          <span
                            className={`px-grid-1 py-[2px] rounded text-[12px] font-medium ${
                              event.action === "move"
                                ? "bg-warning/20 text-warning"
                                : event.action === "cancel_suggest"
                                  ? "bg-critical/20 text-critical"
                                  : "bg-primary/20 text-primary"
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
                      <p className="text-data text-text-secondary font-mono">
                        {event.suggested_time
                          ? `${formatTime(event.original_time)} → ${formatTime(event.suggested_time)}`
                          : formatTime(event.original_time)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[12px] text-text-secondary">
                    {event.note}
                  </p>
                </div>
              ))}

              {/* Rest blocks */}
              {optimization.rest_blocks.length > 0 && (
                <div className="space-y-grid-1">
                  <p className="text-[12px] text-text-secondary uppercase tracking-wide">
                    Recommended Rest Blocks
                  </p>
                  {optimization.rest_blocks.map((block, i) => (
                    <div
                      key={i}
                      className="bg-primary/5 border border-primary/20 rounded-card p-grid-2 flex items-center gap-grid-2"
                    >
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="1"
                          y="6"
                          width="18"
                          height="12"
                          rx="2"
                          ry="2"
                        />
                        <line x1="23" y1="13" x2="23" y2="11" />
                      </svg>
                      <div>
                        <p className="text-data text-primary font-medium">
                          <span className="font-mono">
                            {block.duration_minutes}
                          </span>
                          min Spoon Recharge
                        </p>
                        <p className="text-[12px] text-text-secondary">
                          <span className="font-mono">
                            {formatTime(block.start)}
                          </span>{" "}
                          — {block.reason}
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
