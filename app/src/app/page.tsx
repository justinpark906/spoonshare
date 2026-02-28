"use client";

import { useEffect, useCallback } from "react";
import { useSpoonStore } from "@/store/useSpoonStore";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import MorningCheckIn from "@/components/MorningCheckIn";
import BatteryMeter from "@/components/BatteryMeter";
import DeductionTooltip from "@/components/DeductionTooltip";
import DailyForecast from "@/components/DailyForecast";
import CaregiverShare from "@/components/CaregiverShare";

export default function HomePage() {
  const {
    profile,
    effectiveSpoons,
    isLoading,
    dailyBudget,
    weatherInfo,
    hasCheckedInToday,
    scheduleAudit,
    scheduleOptimization,
    crashPrediction,
    isAuditLoading,
    usingDemoCalendar,
    syncWithSupabase,
    setScheduleAudit,
    setAuditLoading,
    logout,
  } = useSpoonStore();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    syncWithSupabase();
  }, [syncWithSupabase]);

  const handleCheckInComplete = useCallback(() => {
    syncWithSupabase();
  }, [syncWithSupabase]);

  // Trigger schedule audit after check-in is complete
  const handleRunScheduleAudit = useCallback(async () => {
    if (!effectiveSpoons) return;

    setAuditLoading(true);
    try {
      const res = await fetch("/api/schedule-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starting_spoons: effectiveSpoons }),
      });

      if (!res.ok) {
        console.error("Schedule audit failed");
        setAuditLoading(false);
        return;
      }

      const data = await res.json();

      if (data.audit) {
        setScheduleAudit(
          data.audit,
          data.optimization || null,
          data.crash_predicted,
          data.using_demo,
        );
      } else {
        setAuditLoading(false);
      }
    } catch (err) {
      console.error("Schedule audit error:", err);
      setAuditLoading(false);
    }
  }, [effectiveSpoons, setScheduleAudit, setAuditLoading]);

  async function handleLogout() {
    await supabase.auth.signOut();
    logout();
    router.push("/login");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-lg">
          Loading your spoon budget...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Syncing profile...</div>
      </div>
    );
  }

  const hasCompletedOnboarding =
    profile.symptom_data && Object.keys(profile.symptom_data).length > 0;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">SpoonShare</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white transition"
          >
            Sign Out
          </button>
        </div>

        {/* Onboarding CTA */}
        {!hasCompletedOnboarding && (
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-6 text-center">
            <p className="text-violet-300 mb-3">
              Complete your clinical profile to get a personalized spoon budget
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition"
            >
              Start Onboarding
            </button>
          </div>
        )}

        {/* Morning Check-In */}
        {hasCompletedOnboarding && !hasCheckedInToday && (
          <MorningCheckIn onComplete={handleCheckInComplete} />
        )}

        {/* Dashboard (after check-in) */}
        {hasCheckedInToday && dailyBudget && (
          <>
            {/* Battery Meter */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
              <div className="text-center">
                <p className="text-slate-400 text-sm uppercase tracking-wide">
                  Today&apos;s Spoon Budget
                </p>
                <div className="text-6xl font-bold text-white mt-2 mb-4">
                  {effectiveSpoons}
                </div>
              </div>

              <BatteryMeter
                current={effectiveSpoons}
                max={Math.round(
                  profile.baseline_spoons / profile.current_multiplier,
                )}
              />

              <div className="pt-2">
                <DeductionTooltip budget={dailyBudget} weather={weatherInfo} />
              </div>
            </div>

            {/* Schedule Audit Section */}
            {scheduleAudit ? (
              <DailyForecast
                audit={scheduleAudit}
                optimization={scheduleOptimization}
                crashPrediction={crashPrediction}
                startingSpoons={effectiveSpoons}
                usingDemo={usingDemoCalendar}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">📅</span>
                  <h3 className="text-lg font-semibold text-white">
                    Schedule Energy Forecast
                  </h3>
                </div>
                <p className="text-sm text-slate-400">
                  Let AI analyze your calendar and predict when you might crash
                  today.
                </p>
                <button
                  onClick={handleRunScheduleAudit}
                  disabled={isAuditLoading}
                  className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
                >
                  {isAuditLoading
                    ? "Analyzing Schedule..."
                    : "Analyze My Schedule"}
                </button>
                <p className="text-xs text-slate-600">
                  Uses Google Calendar if connected, or demo events for preview
                </p>
              </div>
            )}

            {/* Condition Tags */}
            {profile.condition_tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.condition_tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-sm border border-violet-500/30"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* AI Insight */}
            {profile.educational_note && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <p className="text-sm text-slate-400 mb-1">AI Insight</p>
                <p className="text-slate-200">{profile.educational_note}</p>
              </div>
            )}

            {/* Weather Card */}
            {weatherInfo && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">
                    {weatherInfo.pressure_delta < -5 ? "🌧️" : "☀️"}
                  </span>
                  <p className="text-sm font-medium text-slate-300">
                    Environmental Conditions
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-semibold text-white">
                      {weatherInfo.pressure_hpa}
                    </p>
                    <p className="text-xs text-slate-500">hPa pressure</p>
                  </div>
                  <div>
                    <p
                      className={`text-2xl font-semibold ${
                        weatherInfo.pressure_delta < -5
                          ? "text-red-400"
                          : "text-white"
                      }`}
                    >
                      {weatherInfo.pressure_delta > 0 ? "+" : ""}
                      {weatherInfo.pressure_delta.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-500">12h delta</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">
                      {weatherInfo.temperature_c.toFixed(0)}°
                    </p>
                    <p className="text-xs text-slate-500">celsius</p>
                  </div>
                </div>
              </div>
            )}

            {/* Caregiver Sync */}
            <CaregiverShare />

            {/* Clinical Brief — Generate Report (Phase 5) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📋</span>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Clinical Brief
                    </h3>
                    <p className="text-xs text-slate-400">
                      Generate an HPO-mapped medical report from your weekly
                      data. Share with your doctor (24h link) or download PDF.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/report")}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition"
                >
                  Generate Report
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
