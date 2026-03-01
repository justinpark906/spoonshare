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
import SpoonLedger from "@/components/SpoonLedger";

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary text-body">
          Loading your spoon budget...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary text-body">Syncing profile...</div>
      </div>
    );
  }

  const hasCompletedOnboarding =
    profile.symptom_data && Object.keys(profile.symptom_data).length > 0;

  return (
    <div className="min-h-screen bg-background px-grid-3 py-[48px] md:px-grid-5">
      <div className="max-w-2xl mx-auto space-y-grid-4">
        {/* Header — MASTER.md H1: 24px Semibold -0.02em */}
        <header className="flex items-center justify-between">
          <h1 className="text-h1 text-text-primary">SpoonShare</h1>
          <button
            onClick={handleLogout}
            className="text-data text-text-secondary hover:text-text-primary transition-colors duration-200 cursor-pointer"
          >
            Sign Out
          </button>
        </header>

        {/* Onboarding CTA */}
        {!hasCompletedOnboarding && (
          <div className="glass-card p-grid-3 text-center border-primary/30">
            <p className="text-primary text-body mb-grid-2">
              Complete your clinical profile to get a personalized spoon budget
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="px-grid-3 py-[10px] rounded-pill bg-primary/20 hover:bg-primary/30 text-primary font-medium transition-colors duration-200 cursor-pointer"
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
            {/* Battery Meter — Glassmorphism Card §4A */}
            <section className="glass-card rounded-card p-grid-4 space-y-grid-3">
              <div className="text-center">
                <p className="text-text-secondary text-data uppercase tracking-wide">
                  Today&apos;s Spoon Budget
                </p>
                {/* Data/Numbers: font-mono per MASTER.md */}
                <div className="text-[56px] font-bold font-mono text-text-primary mt-grid-1 mb-grid-2">
                  {effectiveSpoons}
                </div>
              </div>

              <BatteryMeter
                current={effectiveSpoons}
                max={Math.round(
                  profile.baseline_spoons / profile.current_multiplier,
                )}
              />

              <div className="pt-grid-1">
                <DeductionTooltip budget={dailyBudget} weather={weatherInfo} />
              </div>
            </section>

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
              <section className="glass-card rounded-card p-grid-3 text-center space-y-grid-2">
                <div className="flex items-center justify-center gap-grid-1">
                  <svg
                    className="w-6 h-6 text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <h3 className="text-h2 text-text-primary">
                    Schedule Energy Forecast
                  </h3>
                </div>
                <p className="text-data text-text-secondary">
                  Let AI analyze your calendar and predict when you might crash
                  today.
                </p>
                <button
                  onClick={handleRunScheduleAudit}
                  disabled={isAuditLoading}
                  className="px-grid-3 py-[10px] rounded-pill bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-background font-medium transition-colors duration-200 cursor-pointer"
                >
                  {isAuditLoading
                    ? "Analyzing Schedule..."
                    : "Analyze My Schedule"}
                </button>
                <p className="text-[12px] text-text-secondary/60">
                  Uses Google Calendar if connected, or demo events for preview
                </p>
              </section>
            )}

            {/* Condition Tags — Pill shape per MASTER.md */}
            {profile.condition_tags.length > 0 && (
              <div className="flex flex-wrap gap-grid-1">
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

            {/* AI Insight */}
            {profile.educational_note && (
              <section className="glass-card rounded-card p-grid-3">
                <p className="text-data text-text-secondary mb-grid-1">
                  AI Insight
                </p>
                <p className="text-body text-text-primary/90">
                  {profile.educational_note}
                </p>
              </section>
            )}

            {/* Weather Card */}
            {weatherInfo && (
              <section className="glass-card rounded-card p-grid-3">
                <div className="flex items-center gap-grid-1 mb-grid-2">
                  <svg
                    className="w-5 h-5 text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                  </svg>
                  <p className="text-data font-medium text-text-secondary">
                    Environmental Conditions
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-grid-2 text-center">
                  <div>
                    <p className="text-[24px] font-semibold font-mono text-text-primary">
                      {weatherInfo.pressure_hpa}
                    </p>
                    <p className="text-[12px] text-text-secondary/60">
                      hPa pressure
                    </p>
                  </div>
                  <div>
                    <p
                      className={`text-[24px] font-semibold font-mono ${
                        weatherInfo.pressure_delta < -5
                          ? "text-critical"
                          : "text-text-primary"
                      }`}
                    >
                      {weatherInfo.pressure_delta > 0 ? "+" : ""}
                      {weatherInfo.pressure_delta.toFixed(1)}
                    </p>
                    <p className="text-[12px] text-text-secondary/60">
                      12h delta
                    </p>
                  </div>
                  <div>
                    <p className="text-[24px] font-semibold font-mono text-text-primary">
                      {weatherInfo.temperature_c.toFixed(0)}°
                    </p>
                    <p className="text-[12px] text-text-secondary/60">
                      celsius
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Spoon Ledger — manual events */}
            <SpoonLedger />

            {/* Caregiver Sync */}
            <CaregiverShare />

            {/* Clinical Brief — Generate Report */}
            <section className="glass-card rounded-card p-grid-3">
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <div>
                    <h3 className="text-body font-semibold text-text-primary">
                      Clinical Brief
                    </h3>
                    <p className="text-[12px] text-text-secondary">
                      Generate an HPO-mapped medical report from your weekly
                      data. Share with your doctor (24h link) or download PDF.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/report")}
                  className="px-grid-2 py-grid-1 rounded-pill bg-primary hover:bg-primary/80 text-background text-data font-medium transition-colors duration-200 cursor-pointer"
                >
                  Generate Report
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
