import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";

export interface SpoonProfile {
  id: string;
  email: string;
  baseline_spoons: number;
  current_multiplier: number;
  symptom_data: Record<string, number>;
  condition_tags: string[];
  educational_note: string | null;
}

export interface DailyBudget {
  starting_spoons: number;
  effective_baseline: number;
  sleep_factor: number;
  pain_deduction: number;
  weather_deduction: number;
  hrv_deduction?: number;
  deduction_reasons: string[];
}

export interface WeatherInfo {
  pressure_hpa: number;
  pressure_delta: number;
  temperature_c: number;
  condition: string;
}

// --- Phase 3: Schedule Audit Types ---

export interface EventCost {
  id: string;
  title: string;
  cost: number;
  reason: string;
  start: string;
  end: string;
  priority: "essential" | "important" | "flexible" | "deferrable";
}

export interface ScheduleAudit {
  event_costs: EventCost[];
  total_projected_drain: number;
  crash_probability: number;
  risk_summary: string;
}

export interface OptimizedEvent {
  id: string;
  title: string;
  action: "keep" | "move" | "cancel_suggest" | "add_rest";
  original_time: string;
  suggested_time: string | null;
  note: string;
}

export interface RestBlock {
  after_event_id: string;
  start: string;
  duration_minutes: number;
  reason: string;
}

export interface ScheduleOptimization {
  optimized_events: OptimizedEvent[];
  rest_blocks: RestBlock[];
  new_total_drain: number;
  new_crash_probability: number;
  optimization_summary: string;
}

export interface CrashPrediction {
  will_crash: boolean;
  crash_time: string | null; // ISO time when battery hits zero
  crash_event_title: string | null;
  spoons_over_budget: number;
}

interface SpoonState {
  // Profile data
  profile: SpoonProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Computed spoon budget (from profile multiplier)
  effectiveSpoons: number;

  // Daily budget (from morning audit)
  dailyBudget: DailyBudget | null;
  weatherInfo: WeatherInfo | null;
  hasCheckedInToday: boolean;

  // Schedule audit (Phase 3)
  scheduleAudit: ScheduleAudit | null;
  scheduleOptimization: ScheduleOptimization | null;
  crashPrediction: CrashPrediction | null;
  isAuditLoading: boolean;
  usingDemoCalendar: boolean;

  // Actions
  setProfile: (profile: SpoonProfile) => void;
  setLoading: (loading: boolean) => void;
  setDailyBudget: (budget: DailyBudget, weather: WeatherInfo) => void;
  setScheduleAudit: (
    audit: ScheduleAudit,
    optimization: ScheduleOptimization | null,
    crashPredicted: boolean,
    usingDemo: boolean,
  ) => void;
  setAuditLoading: (loading: boolean) => void;
  syncWithSupabase: () => Promise<void>;
  logout: () => void;
}

export const useSpoonStore = create<SpoonState>()(
  persist(
    (set, get) => ({
      profile: null,
      isLoading: false,
      isAuthenticated: false,
      effectiveSpoons: 20,
      dailyBudget: null,
      weatherInfo: null,
      hasCheckedInToday: false,
      scheduleAudit: null,
      scheduleOptimization: null,
      crashPrediction: null,
      isAuditLoading: false,
      usingDemoCalendar: false,

      setProfile: (profile) =>
        set({
          profile,
          isAuthenticated: true,
          effectiveSpoons: 20,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setDailyBudget: (budget, weather) =>
        set({
          dailyBudget: budget,
          weatherInfo: weather,
          hasCheckedInToday: true,
          effectiveSpoons: budget.starting_spoons,
        }),

      setScheduleAudit: (audit, optimization, crashPredicted, usingDemo) => {
        const state = get();
        const startingSpoons = state.effectiveSpoons;

        // Calculate crash prediction
        let crashPrediction: CrashPrediction = {
          will_crash: false,
          crash_time: null,
          crash_event_title: null,
          spoons_over_budget: 0,
        };

        if (crashPredicted && audit) {
          let cumulative = 0;
          for (const ec of audit.event_costs) {
            cumulative += ec.cost;
            if (cumulative > startingSpoons) {
              crashPrediction = {
                will_crash: true,
                crash_time: ec.start,
                crash_event_title: ec.title,
                spoons_over_budget:
                  audit.total_projected_drain - startingSpoons,
              };
              break;
            }
          }
        }

        set({
          scheduleAudit: audit,
          scheduleOptimization: optimization,
          crashPrediction,
          usingDemoCalendar: usingDemo,
          isAuditLoading: false,
        });
      },

      setAuditLoading: (loading) => set({ isAuditLoading: loading }),

      syncWithSupabase: async () => {
        const supabase = createClient();
        set({ isLoading: true });

        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            set({ profile: null, isAuthenticated: false, isLoading: false });
            return;
          }

          const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (error || !profile) {
            set({ isLoading: false });
            return;
          }

          const spoonProfile: SpoonProfile = {
            id: profile.id,
            email: profile.email,
            baseline_spoons: profile.baseline_spoons,
            current_multiplier: profile.current_multiplier,
            symptom_data: profile.symptom_data || {},
            condition_tags: profile.condition_tags || [],
            educational_note: profile.educational_note,
          };

          const today = new Date().toISOString().split("T")[0];
          const { data: dailyLog } = await supabase
            .from("daily_logs")
            .select("*")
            .eq("user_id", user.id)
            .eq("date", today)
            .single();

          const updates: Partial<SpoonState> = {
            profile: spoonProfile,
            isAuthenticated: true,
            isLoading: false,
            effectiveSpoons: 20,
          };

          if (dailyLog) {
            updates.dailyBudget = {
              starting_spoons: dailyLog.starting_spoons,
              effective_baseline: dailyLog.baseline_used,
              sleep_factor: dailyLog.sleep_score / 10,
              pain_deduction: dailyLog.pain_score / 2,
              weather_deduction: dailyLog.weather_deduction,
              hrv_deduction: dailyLog.hrv_deduction ?? 0,
              deduction_reasons: dailyLog.deduction_reasons || [],
            };
            updates.weatherInfo = {
              pressure_hpa: dailyLog.pressure_hpa ?? 0,
              pressure_delta: dailyLog.pressure_delta ?? 0,
              temperature_c: dailyLog.temperature_c ?? 0,
              condition: "",
            };
            updates.hasCheckedInToday = true;
            updates.effectiveSpoons = Math.min(
              20,
              dailyLog.current_spoons ?? dailyLog.starting_spoons,
            );
          } else {
            updates.hasCheckedInToday = false;
            updates.dailyBudget = null;
            updates.weatherInfo = null;
          }

          set(updates as SpoonState);
        } catch {
          set({ isLoading: false });
        }
      },

      logout: () =>
        set({
          profile: null,
          isAuthenticated: false,
          effectiveSpoons: 20,
          dailyBudget: null,
          weatherInfo: null,
          hasCheckedInToday: false,
          scheduleAudit: null,
          scheduleOptimization: null,
          crashPrediction: null,
          usingDemoCalendar: false,
        }),
    }),
    {
      name: "spoonshare-store",
      partialize: (state) => ({
        profile: state.profile,
        isAuthenticated: state.isAuthenticated,
        effectiveSpoons: state.effectiveSpoons,
        dailyBudget: state.dailyBudget,
        weatherInfo: state.weatherInfo,
        hasCheckedInToday: state.hasCheckedInToday,
        scheduleAudit: state.scheduleAudit,
        scheduleOptimization: state.scheduleOptimization,
        crashPrediction: state.crashPrediction,
        usingDemoCalendar: state.usingDemoCalendar,
      }),
    },
  ),
);
