import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchCurrentWeather, calculateWeatherDeductions } from "@/lib/weather";
import { calculateMorningBudget, calculateHrvDeduction } from "@/lib/budget";

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse inputs
    const {
      sleep_score,
      pain_score,
      wearable_sleep_score,
      hrv_ms,
      resting_hr,
      biometric_source,
      lat,
      lon,
    } = await request.json();

    if (!sleep_score || !pain_score) {
      return NextResponse.json(
        { error: "Missing sleep_score or pain_score" },
        { status: 400 },
      );
    }

    // 3. Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 4. Fetch weather data
    const weatherLat = lat ?? 41.8268; // Default: Providence, RI (Brown University)
    const weatherLon = lon ?? -71.4029;

    const currentWeather = await fetchCurrentWeather(weatherLat, weatherLon);

    // 5. Get pressure from ~12h ago for delta comparison
    const twelveHoursAgo = new Date(
      Date.now() - 12 * 60 * 60 * 1000,
    ).toISOString();

    const { data: previousWeather } = await supabase
      .from("weather_logs")
      .select("pressure_hpa")
      .eq("user_id", user.id)
      .lt("recorded_at", twelveHoursAgo)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    const previousPressure = previousWeather?.pressure_hpa ?? null;

    // 6. Calculate weather deductions
    const conditionTags: string[] = profile.condition_tags ?? [];
    const weatherResult = calculateWeatherDeductions(
      currentWeather,
      previousPressure,
      conditionTags,
    );

    // 7. Store current weather reading for future delta checks
    await supabase.from("weather_logs").insert({
      user_id: user.id,
      pressure_hpa: currentWeather.pressure_hpa,
      temperature_c: currentWeather.temperature_c,
      humidity: currentWeather.humidity,
      weather_condition: currentWeather.weather_condition,
      location: `${weatherLat},${weatherLon}`,
    });

    // 8. If wearable sync provided, convert 0-100 → 1-10 scale
    const effectiveSleep = wearable_sleep_score
      ? Math.max(1, Math.round(wearable_sleep_score / 10))
      : sleep_score;

    // 8b. HRV deduction: compute baseline from last 14 days, then check today's HRV
    let hrvDeductionResult = {
      hrv_deduction: 0,
      reason: null as string | null,
    };
    const today = new Date().toISOString().split("T")[0];

    if (hrv_ms != null) {
      let hrvBaseline: number | null = profile.hrv_baseline ?? null;

      if (hrvBaseline === null) {
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        const { data: recentBiometrics } = await supabase
          .from("biometrics")
          .select("hrv_ms")
          .eq("user_id", user.id)
          .gte("date", fourteenDaysAgo)
          .not("hrv_ms", "is", null);

        if (recentBiometrics && recentBiometrics.length >= 3) {
          hrvBaseline =
            recentBiometrics.reduce(
              (sum: number, b: { hrv_ms: number }) => sum + b.hrv_ms,
              0,
            ) / recentBiometrics.length;

          await supabase
            .from("profiles")
            .update({ hrv_baseline: hrvBaseline })
            .eq("id", user.id);
        }
      }

      hrvDeductionResult = calculateHrvDeduction(hrv_ms, hrvBaseline);

      await supabase.from("biometrics").upsert(
        {
          user_id: user.id,
          date: today,
          hrv_ms: hrv_ms ?? null,
          resting_hr: resting_hr ?? null,
          sleep_score: wearable_sleep_score ?? null,
          source: biometric_source ?? "manual",
        },
        { onConflict: "user_id,date" },
      );
    }

    // 9. Run the master budget formula (now includes HRV deduction)
    const budgetResult = calculateMorningBudget(
      {
        baseline_spoons: profile.baseline_spoons,
        current_multiplier: profile.current_multiplier,
        sleep_score: effectiveSleep,
        pain_score,
        weather_deduction: weatherResult.weather_deduction,
        hrv_deduction: hrvDeductionResult.hrv_deduction,
      },
      [
        ...weatherResult.reasons,
        ...(hrvDeductionResult.reason ? [hrvDeductionResult.reason] : []),
      ],
    );

    // 10. Save to daily_logs (upsert for today)
    const { error: logError } = await supabase.from("daily_logs").upsert(
      {
        user_id: user.id,
        date: today,
        starting_spoons: budgetResult.starting_spoons,
        baseline_used: budgetResult.effective_baseline,
        sleep_score: effectiveSleep,
        pain_score,
        weather_deduction: budgetResult.weather_deduction,
        hrv_deduction: hrvDeductionResult.hrv_deduction,
        wearable_sleep_score: wearable_sleep_score ?? null,
        deduction_reasons: budgetResult.deduction_reasons,
        pressure_hpa: currentWeather.pressure_hpa,
        pressure_delta: weatherResult.pressure_delta,
        temperature_c: currentWeather.temperature_c,
      },
      { onConflict: "user_id,date" },
    );

    if (logError) {
      console.error("Daily log save error:", logError);
      return NextResponse.json(
        { error: "Failed to save daily log" },
        { status: 500 },
      );
    }

    // 11. Return the full result
    return NextResponse.json({
      success: true,
      budget: {
        starting_spoons: budgetResult.starting_spoons,
        effective_baseline: budgetResult.effective_baseline,
        sleep_factor: budgetResult.sleep_factor,
        pain_deduction: budgetResult.pain_deduction,
        weather_deduction: budgetResult.weather_deduction,
        hrv_deduction: budgetResult.hrv_deduction,
        deduction_reasons: budgetResult.deduction_reasons,
      },
      weather: {
        pressure_hpa: currentWeather.pressure_hpa,
        pressure_delta: weatherResult.pressure_delta,
        temperature_c: currentWeather.temperature_c,
        condition: currentWeather.weather_condition,
      },
    });
  } catch (err) {
    console.error("Morning audit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
