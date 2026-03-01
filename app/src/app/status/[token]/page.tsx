"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import BatteryMeter from "@/components/BatteryMeter";
import { motion } from "framer-motion";

interface OwnerData {
  owner_id: string;
  label: string;
}

interface DailyLog {
  starting_spoons: number;
  current_spoons: number | null;
  active_task: string | null;
  claimed_tasks: Array<{
    event_id: string;
    event_title: string;
    spoon_cost: number;
    caregiver_name: string;
    claimed_at: string;
  }>;
  sleep_score: number;
  pain_score: number;
  weather_deduction: number;
}

interface ProfileData {
  email: string;
  condition_tags: string[];
  current_multiplier: number;
  baseline_spoons: number;
  educational_note: string | null;
}

interface ManualEventRow {
  id: string;
  title: string;
  spoon_cost: number;
  category: string;
  start_time: string;
}

interface ReportRow {
  share_token: string;
  created_at: string;
  report_data: {
    clinician_message?: string;
  } | null;
}

interface ScheduleEvent {
  id: string;
  title: string;
  cost: number;
  start: string;
  end?: string;
  reason?: string;
  priority: "essential" | "important" | "flexible";
}

interface ForecastAudit {
  event_costs: Array<{
    id: string;
    title: string;
    cost: number;
    start: string;
    end: string;
    reason: string;
    priority: "essential" | "important" | "flexible" | "deferrable";
  }>;
  total_projected_drain: number;
  crash_probability: number;
  risk_summary: string;
}

interface ActivityRow {
  id: string;
  at: string;
  label: string;
  delta: number;
}

export default function CaregiverStatusPage() {
  const params = useParams();
  const token = params.token as string;
  const supabase = createClient();

  const [owner, setOwner] = useState<OwnerData | null>(null);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caregiverName, setCaregiverName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [manualEvents, setManualEvents] = useState<ManualEventRow[]>([]);
  const [latestReport, setLatestReport] = useState<ReportRow | null>(null);
  const [forecastAudit, setForecastAudit] = useState<ForecastAudit | null>(null);
  const [usingDemoForecast, setUsingDemoForecast] = useState(false);

  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"essential" | "important" | "flexible">("important");
  const [newTaskSpoons, setNewTaskSpoons] = useState(3);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!owner) return;

    // Subscribe to realtime changes on daily_logs
    const channel = supabase
      .channel("caregiver-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_logs",
          filter: `user_id=eq.${owner.owner_id}`,
        },
        (payload) => {
          if (payload.new) {
            setDailyLog(payload.new as unknown as DailyLog);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  async function loadData() {
    // Verify token
    const { data: access, error: accessError } = await supabase
      .from("shared_access")
      .select("owner_id, label")
      .eq("access_token", token)
      .single();

    if (accessError || !access) {
      setError("Invalid or expired caregiver link");
      return;
    }

    setOwner(access);

    // Get profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("email, condition_tags, current_multiplier, baseline_spoons, educational_note")
      .eq("id", access.owner_id)
      .single();

    if (profileData) setProfile(profileData);

    // Get today's log
    const today = new Date().toISOString().split("T")[0];
    const { data: log } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", access.owner_id)
      .eq("date", today)
      .single();

    if (log) setDailyLog(log);

    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;

    const [ledgerRes, reportRes] = await Promise.all([
      supabase
        .from("manual_events")
        .select("id, title, spoon_cost, category, start_time")
        .eq("user_id", access.owner_id)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .order("start_time", { ascending: true }),
      supabase
        .from("reports")
        .select("share_token, created_at, report_data")
        .eq("user_id", access.owner_id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setManualEvents(ledgerRes.data ?? []);
    setLatestReport(reportRes.data?.[0] ?? null);

    const forecastRes = await fetch(`/api/caregiver-forecast/${token}`);
    if (forecastRes.ok) {
      const forecastData = await forecastRes.json();
      setUsingDemoForecast(Boolean(forecastData.using_demo));
      if (forecastData.audit) {
        setForecastAudit(forecastData.audit as ForecastAudit);
        const mappedEvents: ScheduleEvent[] =
          (forecastData.audit.event_costs ?? []).map(
            (event: {
              id: string;
              title: string;
              cost: number;
              start: string;
              end: string;
              reason: string;
              priority: "essential" | "important" | "flexible" | "deferrable";
            }) => ({
              id: event.id,
              title: event.title,
              cost: event.cost,
              start: formatTime(event.start),
              end: formatTime(event.end),
              reason: event.reason,
              priority:
                event.priority === "deferrable"
                  ? "flexible"
                  : event.priority,
            }),
          );
        setScheduleEvents(mappedEvents);
      } else {
        setForecastAudit(null);
        setScheduleEvents([]);
      }
    }
  }

  async function claimTask(event: ScheduleEvent) {
    if (!nameSet || !caregiverName.trim()) return;
    setClaiming(event.id);

    try {
      const res = await fetch("/api/claim-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: token,
          event_id: event.id,
          event_title: event.title,
          spoon_cost: event.cost,
          caregiver_name: caregiverName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToast(data.message);
        setTimeout(() => setToast(null), 5000);
        await loadData();
      }
    } catch {
      // Silently fail — toast won't show
    } finally {
      setClaiming(null);
    }
  }

  function formatTaskTime(time24h: string) {
    if (!time24h) return "";

    const [rawHour, rawMinute] = time24h.split(":");
    const hour = Number(rawHour);
    const minute = Number(rawMinute);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time24h;

    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const minuteStr = minute.toString().padStart(2, "0");

    return `${hour12}:${minuteStr} ${suffix}`;
  }

  function addCustomTask() {
    const title = newTaskName.trim();
    if (!title || !newTaskTime) return;

    const createdTask: ScheduleEvent = {
      id: `custom-${Date.now()}`,
      title,
      cost: Math.min(10, Math.max(1, Math.round(newTaskSpoons))),
      start: formatTaskTime(newTaskTime),
      priority: newTaskPriority,
    };

    setScheduleEvents((prev) => [...prev, createdTask]);
    setNewTaskName("");
    setNewTaskTime("");
    setNewTaskPriority("important");
    setNewTaskSpoons(3);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-grid-3">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-h1 text-text-primary">Access Denied</h1>
          <p className="text-body text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  const currentSpoons =
    dailyLog?.current_spoons ?? dailyLog?.starting_spoons ?? 0;
  const maxSpoons = 20;
  const percentage = maxSpoons > 0 ? (currentSpoons / maxSpoons) * 100 : 0;

  const alreadyClaimed = (dailyLog?.claimed_tasks || []).map(
    (c) => c.event_id
  );

  const maxDailySpoons = 20;
  const morningAdjustment = Math.max(0, maxDailySpoons - (dailyLog?.starting_spoons ?? 0));

  const activityRows: ActivityRow[] = [
    ...manualEvents.map((event, index) => ({
      id: `manual-${index}`,
      at: event.start_time,
      label: event.title,
      delta: event.category === "rest" ? event.spoon_cost : -event.spoon_cost,
    })),
    ...((dailyLog?.claimed_tasks ?? []).map((claim, index) => ({
      id: `claim-${index}`,
      at: claim.claimed_at,
      label: `${claim.caregiver_name} claimed “${claim.event_title}”`,
      delta: claim.spoon_cost,
    }))),
  ].sort((a, b) => {
    const aTs = new Date(a.at).getTime();
    const bTs = new Date(b.at).getTime();
    const safeA = Number.isFinite(aTs) ? aTs : Number.MAX_SAFE_INTEGER;
    const safeB = Number.isFinite(bTs) ? bTs : Number.MAX_SAFE_INTEGER;
    return safeA - safeB;
  });

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  const categoryLabel: Record<string, string> = {
    rest: "Rest",
    light: "Light",
    moderate: "Moderate",
    heavy: "Heavy",
  };

  const unclaimedScheduleEvents = scheduleEvents
    .filter((event) => !alreadyClaimed.includes(event.id))
    .sort((a, b) => {
      const parseMinutes = (value: string) => {
        const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return Number.MAX_SAFE_INTEGER;
        const rawHour = Number(match[1]);
        const minute = Number(match[2]);
        const meridiem = match[3].toUpperCase();
        const hour24 = (rawHour % 12) + (meridiem === "PM" ? 12 : 0);
        return hour24 * 60 + minute;
      };

      return parseMinutes(a.start) - parseMinutes(b.start);
    });

  const projectedDrain = unclaimedScheduleEvents.reduce(
    (sum, event) => sum + event.cost,
    0,
  );
  const crashRisk =
    currentSpoons > 0
      ? Math.min(100, Math.round((projectedDrain / currentSpoons) * 100))
      : 100;
  const predictedCrash = projectedDrain > currentSpoons;
  const spoonsOverBudget = Math.max(0, projectedDrain - currentSpoons);

  const timeline = unclaimedScheduleEvents.map((event, index) => {
    const drainSoFar = unclaimedScheduleEvents
      .slice(0, index + 1)
      .reduce((sum, item) => sum + item.cost, 0);
    return {
      ...event,
      remaining: currentSpoons - drainSoFar,
    };
  });

  const crashEvent = timeline.find((event) => event.remaining <= 0) ?? null;

  return (
    <div className="min-h-screen bg-background px-grid-3 py-grid-4 md:px-grid-5">
      <div className="max-w-3xl mx-auto space-y-grid-3">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-h1 text-text-primary">SpoonShare</h1>
          <p className="text-data text-text-secondary">
            Caregiver view for{" "}
            <span className="text-primary">{owner?.label}</span>
          </p>
        </div>

        {/* Caregiver name input */}
        {!nameSet ? (
          <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
            <h3 className="text-body font-semibold text-text-primary">
              What&apos;s your name?
            </h3>
            <p className="text-data text-text-secondary">
              So they know who&apos;s helping.
            </p>
            <div className="flex gap-grid-1">
              <input
                type="text"
                value={caregiverName}
                onChange={(e) => setCaregiverName(e.target.value)}
                placeholder="Your name..."
                className="flex-1 rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-grid-1 text-data text-text-primary placeholder-text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200"
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  caregiverName.trim() &&
                  setNameSet(true)
                }
              />
              <button
                onClick={() => caregiverName.trim() && setNameSet(true)}
                disabled={!caregiverName.trim()}
                className="px-grid-2 py-grid-1 rounded-card bg-primary hover:bg-primary/80 disabled:opacity-50 text-background text-data font-medium transition-colors duration-200 cursor-pointer min-h-[44px]"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* AI Insight */}
            {profile?.educational_note && (
              <div className="glass-card rounded-card p-grid-3 space-y-grid-1 border border-primary/20 bg-primary/5">
                <h4 className="text-data font-semibold text-primary uppercase tracking-wide">
                  AI Insight
                </h4>
                <p className="text-body text-text-primary/90 leading-relaxed">
                  {profile.educational_note}
                </p>
              </div>
            )}

            {/* Live Energy Status */}
            <div className="glass-card rounded-card p-grid-4 space-y-grid-3">
              <div className="text-center">
                <p className="text-text-secondary text-data uppercase tracking-wide">
                  Current Energy Level
                </p>
                <div
                  className={`text-6xl font-bold mt-2 mb-1 ${percentage < 15
                    ? "text-critical"
                    : percentage < 30
                      ? "text-warning"
                      : "text-text-primary"
                    }`}
                >
                  {currentSpoons}
                </div>
                <p className="text-data text-text-secondary">
                  of {maxSpoons} max spoons
                </p>
              </div>

              <BatteryMeter current={currentSpoons} max={maxSpoons} />

              {/* Status indicator */}
              {percentage < 15 && (
                <div className="bg-critical/10 border border-critical/30 rounded-card p-grid-2 text-center">
                  <p className="text-data text-critical font-medium">
                    🚨 Energy critical — they may need help
                  </p>
                </div>
              )}
            </div>

            {/* Condition tags */}
            {profile?.condition_tags && profile.condition_tags.length > 0 && (
              <div className="flex flex-wrap gap-grid-1 justify-center">
                {profile.condition_tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-grid-2 py-grid-1 rounded-pill bg-primary/10 text-primary text-data border border-primary/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Claimable Tasks */}
            <div className="space-y-3">
              <h3 className="text-data font-semibold text-text-secondary uppercase tracking-wide">
                Patient Schedule — Claim to Help
              </h3>

              <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
                <p className="text-data font-semibold text-text-secondary uppercase tracking-wide">
                  Add task
                </p>
                <div className="space-y-grid-1">
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="Task name"
                    className="w-full rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-grid-1 text-data text-text-primary placeholder-text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200"
                  />
                  <div className="grid grid-cols-3 gap-grid-1">
                    <input
                      type="time"
                      value={newTaskTime}
                      onChange={(e) => setNewTaskTime(e.target.value)}
                      className="rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-grid-1 text-data text-text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200"
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e) =>
                        setNewTaskPriority(
                          e.target.value as "essential" | "important" | "flexible",
                        )
                      }
                      className="rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-grid-1 text-data text-text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200"
                    >
                      <option value="essential">Essential</option>
                      <option value="important">Important</option>
                      <option value="flexible">Flexible</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newTaskSpoons}
                      onChange={(e) =>
                        setNewTaskSpoons(
                          Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                        )
                      }
                      className="rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-grid-1 text-data text-text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200"
                    />
                  </div>
                </div>
                <button
                  onClick={addCustomTask}
                  disabled={!newTaskName.trim() || !newTaskTime}
                  className="w-full px-grid-2 py-grid-1 rounded-card bg-primary hover:bg-primary/80 disabled:opacity-50 text-background text-data font-medium transition-colors duration-200 cursor-pointer"
                >
                  Add Claimable Task
                </button>
              </div>

              {scheduleEvents.map((event) => {
                const isClaimed = alreadyClaimed.includes(event.id);

                return (
                  <div
                    key={event.id}
                    className={`glass-card border rounded-card p-grid-3 flex items-center justify-between ${isClaimed
                      ? "border-primary/30"
                      : "border-[rgba(255,255,255,0.1)]"
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-text-primary font-medium text-data">
                          {event.title}
                        </h4>
                        <span className="px-grid-1 py-[2px] rounded-pill bg-warning/15 text-warning text-[12px] border border-warning/30">
                          {event.cost} spoons
                        </span>
                      </div>
                      <p className="text-[12px] text-text-secondary mt-1">
                        {event.start} · {event.priority}
                      </p>
                    </div>

                    {isClaimed ? (
                      <span className="text-[12px] text-primary font-medium">
                        Claimed ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => claimTask(event)}
                        disabled={claiming === event.id}
                        className="px-grid-2 py-grid-1 rounded-card bg-primary hover:bg-primary/80 disabled:opacity-50 text-background text-[12px] font-medium transition-colors duration-200 cursor-pointer"
                      >
                        {claiming === event.id
                          ? "Claiming..."
                          : `Claim (+${event.cost})`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Claimed history */}
            {dailyLog?.claimed_tasks && dailyLog.claimed_tasks.length > 0 && (
              <div className="glass-card border border-primary/20 rounded-card p-grid-3 space-y-grid-1">
                <h4 className="text-data text-primary font-semibold uppercase tracking-wide">
                  Support Activity
                </h4>
                {dailyLog.claimed_tasks.map((claim, i) => (
                  <div key={i} className="flex items-center gap-grid-1 text-data">
                    <span className="text-primary">💚</span>
                    <span className="text-text-primary">
                      {claim.caregiver_name} claimed{" "}
                      <strong>{claim.event_title}</strong> (+
                      {claim.spoon_cost} spoons)
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Why is my budget? (caregiver read-only) */}
            {dailyLog && (
              <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
                <h3 className="text-body font-semibold text-text-primary">
                  Why is my budget {currentSpoons}?
                </h3>

                <div className="space-y-2">
                  <h4 className="text-data font-semibold text-text-secondary uppercase tracking-wide">
                    Budget Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-y-1 text-data">
                    <span className="text-text-secondary">Effective Baseline</span>
                    <span className="text-right text-text-primary font-mono">20 spoons</span>

                    <span className="text-text-secondary">Sleep Factor</span>
                    <span className="text-right text-text-primary font-mono">
                      x {(dailyLog.sleep_score / 10).toFixed(1)} ({Math.round((dailyLog.sleep_score / 10) * 100)}%)
                    </span>

                    {dailyLog.weather_deduction > 0 && (
                      <>
                        <span className="text-warning">Weather Deduction</span>
                        <span className="text-right text-warning font-mono">
                          -{dailyLog.weather_deduction} spoons
                        </span>
                      </>
                    )}

                    {dailyLog.pain_score > 0 && (
                      <>
                        <span className="text-critical">Pain Deduction</span>
                        <span className="text-right text-critical font-mono">
                          -{(dailyLog.pain_score / 2).toFixed(1)} spoons
                        </span>
                      </>
                    )}

                    <span className="text-text-primary font-semibold border-t border-[rgba(255,255,255,0.1)] pt-2">
                      Starting Budget
                    </span>
                    <span className="text-right text-text-primary font-semibold font-mono border-t border-[rgba(255,255,255,0.1)] pt-2">
                      {dailyLog.starting_spoons} spoons
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-[rgba(255,255,255,0.1)] pt-3">
                  <h4 className="text-data font-semibold text-text-secondary uppercase tracking-wide">
                    How you got to current spoons
                  </h4>

                  <div className="flex items-center justify-between text-data">
                    <span className="text-text-secondary">Max daily spoons</span>
                    <span className="text-text-primary font-mono">{maxDailySpoons}</span>
                  </div>

                  {morningAdjustment > 0 && (
                    <div className="flex items-center justify-between text-data text-warning">
                      <span>− Morning adjustments</span>
                      <span className="font-mono">−{morningAdjustment}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-data">
                    <span className="text-text-secondary">= Starting today</span>
                    <span className="text-text-primary font-mono">{dailyLog.starting_spoons}</span>
                  </div>

                  {activityRows.map((row) => {
                    const isGain = row.delta >= 0;
                    const sign = isGain ? "+" : "−";
                    const amount = Math.abs(row.delta);

                    return (
                      <div
                        key={row.id}
                        className={`flex items-center justify-between gap-2 text-data ${isGain ? "text-primary" : "text-critical"}`}
                      >
                        <span className="truncate">
                          {formatTime(row.at)} · {sign} {row.label}
                        </span>
                        <span className="font-mono shrink-0">{sign}{amount}</span>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between text-data font-semibold border-t border-[rgba(255,255,255,0.1)] pt-2">
                    <span className="text-text-primary">= Current spoons</span>
                    <span className="text-text-primary font-mono">{currentSpoons}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Energy Forecast (caregiver) */}
            {unclaimedScheduleEvents.length > 0 && (
              <div className="space-y-grid-2">
                {predictedCrash && (
                  <div className="bg-critical/10 border-2 border-critical/40 rounded-card p-grid-3 text-center space-y-grid-1">
                    <h3 className="text-h2 font-bold text-critical">
                      Energy Crash Predicted
                    </h3>
                    <p className="text-critical/80 text-data">
                      You&apos;re projected to crash
                      {crashEvent ? (
                        <>
                          {" "}at <span className="font-bold font-mono">{crashEvent.start}</span> during <span className="font-bold">{crashEvent.title}</span>
                        </>
                      ) : (
                        " today"
                      )}
                    </p>
                    <p className="text-critical/50 text-[12px] font-mono">
                      {spoonsOverBudget} spoons over budget
                    </p>
                  </div>
                )}

                <section className="glass-card rounded-card p-grid-3 space-y-grid-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-grid-2">
                      <svg
                        className={`w-6 h-6 ${crashRisk > 70 ? "text-critical" : crashRisk > 40 ? "text-warning" : "text-primary"}`}
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
                        <h3 className="text-h2 text-text-primary">Energy Weather Forecast</h3>
                        <p className="text-data text-text-secondary">
                          {forecastAudit?.risk_summary ??
                            (predictedCrash
                              ? "The patient is at a high risk of energy crash due to projected drain exceeding available spoons."
                              : "Projected schedule is within the available spoon budget for today.")}
                        </p>
                        <p className="text-[12px] text-text-secondary/80">
                          Event spoon costs use the same API-backed forecast source as the patient view.
                        </p>
                      </div>
                    </div>
                    {usingDemoForecast && (
                      <span className="px-grid-1 py-[4px] rounded bg-warning/15 text-warning text-[12px]">
                        Demo Data
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-grid-2">
                    <div className="text-center">
                      <p className="text-[24px] font-bold font-mono text-text-primary">{currentSpoons}</p>
                      <p className="text-[12px] text-text-secondary">Starting Budget</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-[24px] font-bold font-mono ${projectedDrain > currentSpoons ? "text-critical" : "text-text-primary"}`}>
                        {projectedDrain}
                      </p>
                      <p className="text-[12px] text-text-secondary">Projected Drain</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-[24px] font-bold font-mono ${crashRisk > 70 ? "text-critical" : crashRisk > 40 ? "text-warning" : "text-primary"}`}>
                        {crashRisk}%
                      </p>
                      <p className="text-[12px] text-text-secondary">Crash Risk</p>
                    </div>
                  </div>

                  <div className="pt-grid-1">
                    <p className="text-[12px] text-text-secondary mb-grid-1 uppercase tracking-wide">
                      Energy Drain Timeline
                    </p>
                    <div className="space-y-grid-1">
                      {timeline.map((event) => {
                        const percentageRemaining =
                          currentSpoons > 0
                            ? Math.max(0, (event.remaining / currentSpoons) * 100)
                            : 0;

                        return (
                          <div key={event.id} className="flex items-center gap-grid-2 text-data">
                            <span className="text-text-secondary w-[64px] text-right shrink-0 font-mono">
                              {event.start}
                            </span>
                            <div className="flex-1">
                              <div className="h-grid-1 bg-surface rounded-pill overflow-hidden">
                                <div
                                  className={`h-full rounded-pill ${event.remaining <= 0 ? "bg-critical" : event.remaining <= 3 ? "bg-warning" : "bg-primary"}`}
                                  style={{ width: `${percentageRemaining}%` }}
                                />
                              </div>
                            </div>
                            <span className={`w-grid-4 text-right text-[12px] font-mono ${event.remaining <= 0 ? "text-critical" : "text-text-secondary"}`}>
                              {event.remaining}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Spoon Ledger (read-only caregiver view) */}
            <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
              <h4 className="text-data font-semibold text-text-secondary uppercase tracking-wide">
                Spoon Ledger
              </h4>
              {manualEvents.length === 0 ? (
                <p className="text-body text-text-secondary">
                  No manual events logged yet today.
                </p>
              ) : (
                <div className="space-y-grid-1">
                  {manualEvents.map((event) => {
                    const isRest = event.category === "rest";
                    const sign = isRest ? "+" : "−";

                    return (
                      <div
                        key={event.id}
                        className="flex items-center justify-between text-data"
                      >
                        <span className="text-text-primary truncate pr-3">
                          {formatTime(event.start_time)} · {event.title} · {categoryLabel[event.category] ?? event.category}
                        </span>
                        <span
                          className={`font-mono shrink-0 ${isRest ? "text-primary" : "text-critical"}`}
                        >
                          {sign}{event.spoon_cost}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clinical Brief access */}
            <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
              <h4 className="text-data font-semibold text-text-secondary uppercase tracking-wide">
                Clinical Brief
              </h4>
              {latestReport?.share_token ? (
                <>
                  <p className="text-body text-text-primary">
                    Latest generated report from {new Date(latestReport.created_at).toLocaleDateString()}.
                  </p>
                  {latestReport.report_data?.clinician_message && (
                    <p className="text-data text-text-secondary leading-relaxed">
                      {latestReport.report_data.clinician_message}
                    </p>
                  )}
                  <a
                    href={`/report/shared/${latestReport.share_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex px-grid-2 py-grid-1 rounded-card bg-primary hover:bg-primary/80 text-background text-[12px] font-medium transition-colors duration-200"
                  >
                    Open Clinical Brief
                  </a>
                </>
              ) : (
                <p className="text-body text-text-secondary">
                  No shared clinical brief is currently available.
                </p>
              )}
            </div>
          </>
        )}

        {/* Toast notification */}
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-background px-grid-3 py-grid-2 rounded-card shadow-lg text-data font-medium z-50"
          >
            {toast}
          </motion.div>
        )}
      </div>
    </div>
  );
}
