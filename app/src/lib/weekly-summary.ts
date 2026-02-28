/**
 * Weekly Data Aggregation Service
 * Pulls the last 7 days of data from Supabase for clinical report generation.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface DailyLogEntry {
  date: string;
  starting_spoons: number;
  current_spoons: number | null;
  sleep_score: number;
  pain_score: number;
  weather_deduction: number;
  deduction_reasons: string[];
  pressure_hpa: number | null;
  pressure_delta: number | null;
  temperature_c: number | null;
  claimed_tasks: Array<{
    event_title: string;
    spoon_cost: number;
    caregiver_name: string;
  }>;
}

export interface WeatherLogEntry {
  pressure_hpa: number;
  temperature_c: number;
  weather_condition: string;
  recorded_at: string;
}

export interface UserNote {
  content: string;
  date: string;
}

export interface WeeklySummary {
  period: { start: string; end: string };
  daily_logs: DailyLogEntry[];
  weather_logs: WeatherLogEntry[];
  user_notes: UserNote[];
  stats: {
    avg_starting_spoons: number;
    avg_ending_spoons: number;
    total_weather_deductions: number;
    days_with_crashes: number;
    worst_day: string | null;
    best_day: string | null;
    avg_sleep: number;
    avg_pain: number;
    total_caregiver_claims: number;
    pacing_adherence: number; // % of time above 2 spoons
  };
  hourly_risk: number[]; // 24 entries, each 0-10 risk score
}

export async function getWeeklySummary(
  supabase: SupabaseClient,
  userId: string
): Promise<WeeklySummary> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = weekAgo.toISOString().split("T")[0];
  const endDate = now.toISOString().split("T")[0];

  // Fetch all data in parallel
  const [dailyLogsRes, weatherLogsRes, notesRes] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true }),

    supabase
      .from("weather_logs")
      .select("pressure_hpa, temperature_c, weather_condition, recorded_at")
      .eq("user_id", userId)
      .gte("recorded_at", weekAgo.toISOString())
      .order("recorded_at", { ascending: true }),

    supabase
      .from("user_notes")
      .select("content, date")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true }),
  ]);

  const dailyLogs: DailyLogEntry[] = (dailyLogsRes.data || []).map((d) => ({
    date: d.date,
    starting_spoons: d.starting_spoons,
    current_spoons: d.current_spoons,
    sleep_score: d.sleep_score,
    pain_score: d.pain_score,
    weather_deduction: d.weather_deduction,
    deduction_reasons: d.deduction_reasons || [],
    pressure_hpa: d.pressure_hpa,
    pressure_delta: d.pressure_delta,
    temperature_c: d.temperature_c,
    claimed_tasks: d.claimed_tasks || [],
  }));

  const weatherLogs: WeatherLogEntry[] = (weatherLogsRes.data || []).map(
    (w) => ({
      pressure_hpa: w.pressure_hpa,
      temperature_c: w.temperature_c,
      weather_condition: w.weather_condition,
      recorded_at: w.recorded_at,
    })
  );

  const userNotes: UserNote[] = (notesRes.data || []).map((n) => ({
    content: n.content,
    date: n.date,
  }));

  // Calculate stats
  const totalDays = dailyLogs.length || 1;

  const avgStarting =
    dailyLogs.reduce((s, d) => s + d.starting_spoons, 0) / totalDays;

  const avgEnding =
    dailyLogs.reduce(
      (s, d) => s + (d.current_spoons ?? d.starting_spoons),
      0
    ) / totalDays;

  const totalWeatherDeductions = dailyLogs.reduce(
    (s, d) => s + d.weather_deduction,
    0
  );

  const daysWithCrashes = dailyLogs.filter(
    (d) => (d.current_spoons ?? d.starting_spoons) <= 2
  ).length;

  const avgSleep =
    dailyLogs.reduce((s, d) => s + d.sleep_score, 0) / totalDays;

  const avgPain =
    dailyLogs.reduce((s, d) => s + d.pain_score, 0) / totalDays;

  const totalCaregiverClaims = dailyLogs.reduce(
    (s, d) => s + (d.claimed_tasks?.length || 0),
    0
  );

  // Pacing adherence: % of days where ending spoons > 2
  const daysAboveMinimum = dailyLogs.filter(
    (d) => (d.current_spoons ?? d.starting_spoons) > 2
  ).length;
  const pacingAdherence = Math.round((daysAboveMinimum / totalDays) * 100);

  // Best/worst days
  const sorted = [...dailyLogs].sort(
    (a, b) =>
      (a.current_spoons ?? a.starting_spoons) -
      (b.current_spoons ?? b.starting_spoons)
  );
  const worstDay = sorted[0]?.date ?? null;
  const bestDay = sorted[sorted.length - 1]?.date ?? null;

  // Hourly risk heatmap (simplified: distribute crash risk across hours)
  const hourlyRisk = Array(24).fill(0);
  // Higher risk in the afternoon (12-18) based on typical chronic illness patterns
  for (let h = 0; h < 24; h++) {
    if (h >= 6 && h < 9) hourlyRisk[h] = Math.round(avgPain * 0.3);
    else if (h >= 9 && h < 12) hourlyRisk[h] = Math.round(avgPain * 0.5);
    else if (h >= 12 && h < 15) hourlyRisk[h] = Math.round(avgPain * 0.7);
    else if (h >= 15 && h < 18) hourlyRisk[h] = Math.round(avgPain * 0.9);
    else if (h >= 18 && h < 21) hourlyRisk[h] = Math.round(avgPain * 0.6);
    else hourlyRisk[h] = Math.round(avgPain * 0.2);
  }

  return {
    period: { start: startDate, end: endDate },
    daily_logs: dailyLogs,
    weather_logs: weatherLogs,
    user_notes: userNotes,
    stats: {
      avg_starting_spoons: Math.round(avgStarting * 10) / 10,
      avg_ending_spoons: Math.round(avgEnding * 10) / 10,
      total_weather_deductions: totalWeatherDeductions,
      days_with_crashes: daysWithCrashes,
      worst_day: worstDay,
      best_day: bestDay,
      avg_sleep: Math.round(avgSleep * 10) / 10,
      avg_pain: Math.round(avgPain * 10) / 10,
      total_caregiver_claims: totalCaregiverClaims,
      pacing_adherence: pacingAdherence,
    },
    hourly_risk: hourlyRisk,
  };
}
