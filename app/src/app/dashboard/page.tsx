"use client";

import { useEffect, useCallback, useState } from "react";
import { useSpoonStore } from "@/store/useSpoonStore";
import { useRouter } from "next/navigation";
import MorningCheckIn from "@/components/MorningCheckIn";
import BatteryMeter from "@/components/BatteryMeter";
import DeductionTooltip from "@/components/DeductionTooltip";
import DailyForecast from "@/components/DailyForecast";
import CaregiverShare from "@/components/CaregiverShare";
import SpoonLedger from "@/components/SpoonLedger";
import CalendarView from "@/components/CalendarView";

export default function DashboardPage() {
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
  } = useSpoonStore();
  const router = useRouter();
  const [onboardingDiseaseMessage, setOnboardingDiseaseMessage] = useState<
    string | null
  >(null);
  const [sleepEditOpen, setSleepEditOpen] = useState(false);
  const [editSleep, setEditSleep] = useState(5);
  const [editPain, setEditPain] = useState(5);
  const [sleepUpdating, setSleepUpdating] = useState(false);

  useEffect(() => {
    syncWithSupabase();
  }, [syncWithSupabase]);

  useEffect(() => {
    if (!isLoading && !profile) {
      router.push("/");
    }
  }, [isLoading, profile, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const msg = sessionStorage.getItem("spoonshare_onboarding_disease_message");
    if (msg) {
      setOnboardingDiseaseMessage(msg);
      sessionStorage.removeItem("spoonshare_onboarding_disease_message");
    }
  }, []);

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

  function handleOpenSleepEdit() {
    if (dailyBudget) {
      setEditSleep(dailyBudget.sleep_score ?? 5);
      setEditPain(dailyBudget.pain_score ?? 5);
    }
    setSleepEditOpen(true);
  }

  async function handleSleepUpdate() {
    setSleepUpdating(true);
    try {
      const res = await fetch("/api/morning-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sleep_score: editSleep,
          pain_score: editPain,
        }),
      });
      if (res.ok) {
        setSleepEditOpen(false);
        await syncWithSupabase();
      }
    } catch (err) {
      console.error("Sleep update error:", err);
    } finally {
      setSleepUpdating(false);
    }
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
    return null;
  }

  const hasCompletedOnboarding =
    profile.symptom_data && Object.keys(profile.symptom_data).length > 0;

  return (
    <div className="min-h-screen bg-background px-grid-3 py-grid-4 md:px-grid-5">
      <div className="max-w-7xl mx-auto">
        {/* Onboarding CTA — full width */}
        {!hasCompletedOnboarding && (
          <div className="glass-card p-grid-3 text-center border-primary/30 mb-grid-4">
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

        {onboardingDiseaseMessage && (
          <div className="glass-card p-grid-3 border-primary/30 rounded-card mb-grid-4">
            <p className="text-body text-primary">{onboardingDiseaseMessage}</p>
            <button
              type="button"
              onClick={() => setOnboardingDiseaseMessage(null)}
              className="mt-grid-2 text-data text-text-secondary hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Morning Check-In — full width */}
        {hasCompletedOnboarding && !hasCheckedInToday && (
          <div className="mb-grid-4">
            <MorningCheckIn onComplete={handleCheckInComplete} />
          </div>
        )}

        {/* Main Dashboard Grid */}
        {hasCheckedInToday && dailyBudget && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-grid-3">
            {/* Left Column — main content */}
            <div className="lg:col-span-2 space-y-grid-3">
              {/* Battery Meter */}
              <section className="glass-card rounded-card p-grid-4 space-y-grid-3">
                <div className="text-center">
                  <p className="text-text-secondary text-data uppercase tracking-wide">
                    Today&apos;s Spoon Budget
                  </p>
                  <div className="text-[56px] font-bold font-mono text-text-primary mt-grid-1 mb-grid-2">
                    {effectiveSpoons}
                  </div>
                </div>

                <BatteryMeter current={effectiveSpoons} max={20} />

                <div className="pt-grid-1">
                  <DeductionTooltip
                    budget={dailyBudget}
                    weather={weatherInfo}
                  />
                </div>
              </section>

              {/* Sleep & Recovery */}
              <section className="glass-card rounded-card p-grid-3 space-y-grid-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-grid-2">
                    <svg
                      className="w-5 h-5 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    <h3 className="text-body font-semibold text-text-primary">
                      Sleep &amp; Recovery
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      sleepEditOpen
                        ? setSleepEditOpen(false)
                        : handleOpenSleepEdit()
                    }
                    className="text-[12px] text-primary hover:text-primary-light cursor-pointer"
                  >
                    {sleepEditOpen ? "Cancel" : "Update"}
                  </button>
                </div>

                {!sleepEditOpen && (
                  <div className="grid grid-cols-2 gap-grid-3">
                    <div className="text-center">
                      <p className="text-[28px] font-bold font-mono text-text-primary">
                        {dailyBudget.sleep_score ?? "–"}
                        <span className="text-[14px] font-normal text-text-secondary">
                          /10
                        </span>
                      </p>
                      <p className="text-[12px] text-text-secondary">
                        Sleep quality
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[28px] font-bold font-mono text-text-primary">
                        {dailyBudget.pain_score ?? "–"}
                        <span className="text-[14px] font-normal text-text-secondary">
                          /10
                        </span>
                      </p>
                      <p className="text-[12px] text-text-secondary">
                        Pain &amp; fog
                      </p>
                    </div>
                  </div>
                )}

                {sleepEditOpen && (
                  <div className="space-y-grid-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] text-text-secondary">
                          Sleep quality
                        </label>
                        <span className="text-[12px] font-mono font-semibold text-text-primary">
                          {editSleep}/10
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={editSleep}
                        onChange={(e) => setEditSleep(Number(e.target.value))}
                        className="w-full h-[8px] bg-surface rounded-pill appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] text-text-secondary">
                          Pain &amp; brain fog
                        </label>
                        <span className="text-[12px] font-mono font-semibold text-text-primary">
                          {editPain}/10
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={editPain}
                        onChange={(e) => setEditPain(Number(e.target.value))}
                        className="w-full h-[8px] bg-surface rounded-pill appearance-none cursor-pointer accent-critical"
                      />
                    </div>
                    <button
                      onClick={handleSleepUpdate}
                      disabled={sleepUpdating}
                      className="w-full py-1.5 rounded-lg bg-primary hover:bg-primary/80 disabled:opacity-50 text-background text-[12px] font-medium transition-colors cursor-pointer"
                    >
                      {sleepUpdating
                        ? "Recalculating..."
                        : "Recalculate Budget"}
                    </button>
                  </div>
                )}
              </section>

              {/* Schedule Audit / Forecast */}
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
                    Let AI analyze your calendar and predict when you might
                    crash today.
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
                    Uses Google Calendar if connected, or demo events for
                    preview
                  </p>
                </section>
              )}

              {/* Condition + Weather row on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-grid-3">
                {/* Condition Tier */}
                {(profile.impact_tier != null ||
                  (profile.activity_multiplier != null &&
                    profile.activity_multiplier > 1)) && (
                  <section className="glass-card rounded-card p-grid-3">
                    <div className="flex items-center gap-grid-2 flex-wrap">
                      <span className="px-grid-2 py-grid-1 rounded-pill bg-primary/15 text-primary text-data font-medium border border-primary/25">
                        {profile.impact_tier === 3
                          ? "Tier 3 (Severe)"
                          : profile.impact_tier === 2
                            ? "Tier 2 (Moderate)"
                            : profile.impact_tier === 1
                              ? "Tier 1 (Mild)"
                              : "Condition tier"}
                      </span>
                      {profile.activity_multiplier != null &&
                        profile.activity_multiplier > 1 && (
                          <span className="text-data text-text-secondary">
                            Activity costs ×
                            {profile.activity_multiplier.toFixed(1)}
                          </span>
                        )}
                      {profile.identified_condition && (
                        <span className="text-data text-text-secondary">
                          {profile.identified_condition}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-text-secondary/80 mt-grid-1">
                      Your activity costs are scaled to reflect your condition.
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
              </div>

              {/* Condition Tags */}
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

              {/* Spoon Ledger + Caregiver side by side on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-grid-3">
                <SpoonLedger />
                <CaregiverShare />
              </div>

              {/* Clinical Brief */}
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
            </div>

            {/* Right Column — Calendar (sticky on desktop) */}
            <div className="lg:sticky lg:top-[80px] lg:self-start space-y-grid-3">
              <CalendarView />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
