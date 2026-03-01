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
  priority: string;
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

  // Demo schedule events (in production, fetched from audit results)
  const [scheduleEvents] = useState<ScheduleEvent[]>([
    { id: "demo-2", title: "Physical Therapy", cost: 6, start: "10:00 AM", priority: "essential" },
    { id: "demo-3", title: "Grocery Shopping", cost: 5, start: "12:30 PM", priority: "flexible" },
    { id: "demo-4", title: "Team Meeting", cost: 4, start: "2:00 PM", priority: "important" },
    { id: "demo-6", title: "Dinner Cooking", cost: 4, start: "6:00 PM", priority: "flexible" },
  ]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold text-white">Access Denied</h1>
          <p className="text-slate-400">{error}</p>
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

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">SpoonShare</h1>
          <p className="text-sm text-slate-400">
            Caregiver view for{" "}
            <span className="text-violet-400">{owner?.label}</span>
          </p>
        </div>

        {/* Caregiver name input */}
        {!nameSet ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-white font-semibold">
              What&apos;s your name?
            </h3>
            <p className="text-sm text-slate-400">
              So they know who&apos;s helping.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={caregiverName}
                onChange={(e) => setCaregiverName(e.target.value)}
                placeholder="Your name..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 focus:border-violet-500 outline-none transition"
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  caregiverName.trim() &&
                  setNameSet(true)
                }
              />
              <button
                onClick={() => caregiverName.trim() && setNameSet(true)}
                disabled={!caregiverName.trim()}
                className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium transition"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Live Energy Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
              <div className="text-center">
                <p className="text-slate-400 text-sm uppercase tracking-wide">
                  Current Energy Level
                </p>
                <div
                  className={`text-6xl font-bold mt-2 mb-1 ${percentage < 15
                    ? "text-red-400"
                    : percentage < 30
                      ? "text-orange-400"
                      : "text-white"
                    }`}
                >
                  {currentSpoons}
                </div>
                <p className="text-sm text-slate-500">
                  of {maxSpoons} max spoons
                </p>
              </div>

              <BatteryMeter current={currentSpoons} max={maxSpoons} />

              {/* Status indicator */}
              {percentage < 15 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                  <p className="text-sm text-red-400 font-medium">
                    🚨 Energy critical — they may need help
                  </p>
                </div>
              )}
            </div>

            {/* Condition tags */}
            {profile?.condition_tags && profile.condition_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {profile.condition_tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs border border-violet-500/30"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Claimable Tasks */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Patient Schedule — Claim to Help
              </h3>
              {scheduleEvents.map((event) => {
                const isClaimed = alreadyClaimed.includes(event.id);

                return (
                  <div
                    key={event.id}
                    className={`bg-slate-900 border rounded-xl p-4 flex items-center justify-between ${isClaimed
                      ? "border-emerald-500/30"
                      : "border-slate-800"
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium text-sm">
                          {event.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs border border-orange-500/30">
                          {event.cost} spoons
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {event.start} · {event.priority}
                      </p>
                    </div>

                    {isClaimed ? (
                      <span className="text-xs text-emerald-400 font-medium">
                        Claimed ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => claimTask(event)}
                        disabled={claiming === event.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition"
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
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                <h4 className="text-xs text-emerald-400 font-semibold uppercase tracking-wide">
                  Support Activity
                </h4>
                {dailyLog.claimed_tasks.map((claim, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-400">💚</span>
                    <span className="text-slate-300">
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
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200">
                  Why is my budget {currentSpoons}?
                </h3>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Budget Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-y-1 text-sm">
                    <span className="text-slate-400">Effective Baseline</span>
                    <span className="text-right text-slate-100 font-mono">20 spoons</span>

                    <span className="text-slate-400">Sleep Factor</span>
                    <span className="text-right text-slate-100 font-mono">
                      x {(dailyLog.sleep_score / 10).toFixed(1)} ({Math.round((dailyLog.sleep_score / 10) * 100)}%)
                    </span>

                    {dailyLog.weather_deduction > 0 && (
                      <>
                        <span className="text-amber-400">Weather Deduction</span>
                        <span className="text-right text-amber-400 font-mono">
                          -{dailyLog.weather_deduction} spoons
                        </span>
                      </>
                    )}

                    {dailyLog.pain_score > 0 && (
                      <>
                        <span className="text-rose-400">Pain Deduction</span>
                        <span className="text-right text-rose-400 font-mono">
                          -{(dailyLog.pain_score / 2).toFixed(1)} spoons
                        </span>
                      </>
                    )}

                    <span className="text-slate-100 font-semibold border-t border-slate-800 pt-2">
                      Starting Budget
                    </span>
                    <span className="text-right text-slate-100 font-semibold font-mono border-t border-slate-800 pt-2">
                      {dailyLog.starting_spoons} spoons
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    How you got to current spoons
                  </h4>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Max daily spoons</span>
                    <span className="text-slate-100 font-mono">{maxDailySpoons}</span>
                  </div>

                  {morningAdjustment > 0 && (
                    <div className="flex items-center justify-between text-sm text-amber-400">
                      <span>− Morning adjustments</span>
                      <span className="font-mono">−{morningAdjustment}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">= Starting today</span>
                    <span className="text-slate-100 font-mono">{dailyLog.starting_spoons}</span>
                  </div>

                  {activityRows.map((row) => {
                    const isGain = row.delta >= 0;
                    const sign = isGain ? "+" : "−";
                    const amount = Math.abs(row.delta);

                    return (
                      <div
                        key={row.id}
                        className={`flex items-center justify-between gap-2 text-sm ${isGain ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        <span className="truncate">
                          {formatTime(row.at)} · {sign} {row.label}
                        </span>
                        <span className="font-mono shrink-0">{sign}{amount}</span>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between text-sm font-semibold border-t border-slate-800 pt-2">
                    <span className="text-slate-100">= Current spoons</span>
                    <span className="text-slate-100 font-mono">{currentSpoons}</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Insight */}
            {profile?.educational_note && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  AI Insight
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {profile.educational_note}
                </p>
              </div>
            )}

            {/* Spoon Ledger (read-only caregiver view) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Spoon Ledger
              </h4>
              {manualEvents.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No manual events logged yet today.
                </p>
              ) : (
                <div className="space-y-2">
                  {manualEvents.map((event) => {
                    const isRest = event.category === "rest";
                    const sign = isRest ? "+" : "−";

                    return (
                      <div
                        key={event.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-300 truncate pr-3">
                          {formatTime(event.start_time)} · {event.title} · {categoryLabel[event.category] ?? event.category}
                        </span>
                        <span
                          className={`font-mono shrink-0 ${isRest ? "text-emerald-400" : "text-rose-400"}`}
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Clinical Brief
              </h4>
              {latestReport?.share_token ? (
                <>
                  <p className="text-sm text-slate-300">
                    Latest generated report from {new Date(latestReport.created_at).toLocaleDateString()}.
                  </p>
                  {latestReport.report_data?.clinician_message && (
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {latestReport.report_data.clinician_message}
                    </p>
                  )}
                  <a
                    href={`/report/shared/${latestReport.share_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition"
                  >
                    Open Clinical Brief
                  </a>
                </>
              ) : (
                <p className="text-sm text-slate-500">
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium z-50"
          >
            {toast}
          </motion.div>
        )}
      </div>
    </div>
  );
}
