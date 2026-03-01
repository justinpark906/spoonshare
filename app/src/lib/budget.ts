/**
 * Master Budget Formula for SpoonShare
 *
 * StartingSpoons = (Baseline × (SleepScore / 10)) - WeatherDeduction - (PainScore / 2)
 * Constraint: Never lower than 3 spoons (maintain hope/agency)
 */

export interface BudgetInput {
  baseline_spoons: number;
  current_multiplier: number;
  sleep_score: number; // 1-10
  pain_score: number; // 1-10
  weather_deduction: number;
  hrv_deduction?: number;
}

export interface BudgetResult {
  starting_spoons: number;
  effective_baseline: number;
  sleep_factor: number;
  pain_deduction: number;
  weather_deduction: number;
  hrv_deduction: number;
  deduction_reasons: string[];
}

export interface HrvDeductionResult {
  hrv_deduction: number;
  reason: string | null;
}

const MAX_DAILY_SPOONS = 20;

/**
 * Calculate spoon deduction based on HRV deviation from baseline.
 * - 20%+ below baseline → -3 spoons (significant autonomic stress)
 * - 10-20% below baseline → -1 spoon (mild stress signal)
 */
export function calculateHrvDeduction(
  hrv_ms: number | null,
  hrv_baseline: number | null,
): HrvDeductionResult {
  if (hrv_ms === null || hrv_baseline === null || hrv_baseline <= 0) {
    return { hrv_deduction: 0, reason: null };
  }

  const dropPercent = ((hrv_baseline - hrv_ms) / hrv_baseline) * 100;

  if (dropPercent >= 20) {
    return {
      hrv_deduction: 3,
      reason: `HRV dropped ${Math.round(dropPercent)}% below baseline (${hrv_ms}ms vs ${Math.round(hrv_baseline)}ms avg) — significant autonomic stress`,
    };
  }

  if (dropPercent >= 10) {
    return {
      hrv_deduction: 1,
      reason: `HRV ${Math.round(dropPercent)}% below baseline (${hrv_ms}ms vs ${Math.round(hrv_baseline)}ms avg) — mild stress signal`,
    };
  }

  return { hrv_deduction: 0, reason: null };
}

export function calculateMorningBudget(
  input: BudgetInput,
  weatherReasons: string[],
): BudgetResult {
  // Fixed daily max capacity
  const effectiveBaseline = MAX_DAILY_SPOONS;

  // Sleep factor: scales the baseline
  const sleepFactor = input.sleep_score / 10;
  const afterSleep = effectiveBaseline * sleepFactor;

  // Pain deduction: halved pain score
  const painDeduction = input.pain_score / 2;

  // HRV deduction (0 if not provided)
  const hrvDeduction = input.hrv_deduction ?? 0;

  // Raw calculation
  const raw =
    afterSleep - input.weather_deduction - painDeduction - hrvDeduction;

  // Constraint: never below 3 spoons
  const startingSpoons = Math.max(3, Math.round(raw));

  // Build deduction explanation
  const deductionReasons: string[] = [];

  if (sleepFactor < 0.7) {
    deductionReasons.push(
      `Poor sleep (${input.sleep_score}/10) reduced baseline by ${Math.round((1 - sleepFactor) * 100)}%`,
    );
  }

  if (input.weather_deduction > 0) {
    deductionReasons.push(...weatherReasons);
  }

  if (painDeduction >= 3) {
    deductionReasons.push(
      `High pain level (${input.pain_score}/10) cost ${painDeduction.toFixed(1)} spoons`,
    );
  }

  if (startingSpoons === 3 && raw < 3) {
    deductionReasons.push(
      "Budget floored at 3 spoons — minimum for basic self-care",
    );
  }

  return {
    starting_spoons: startingSpoons,
    effective_baseline: effectiveBaseline,
    sleep_factor: sleepFactor,
    pain_deduction: painDeduction,
    weather_deduction: input.weather_deduction,
    hrv_deduction: hrvDeduction,
    deduction_reasons: deductionReasons,
  };
}
