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
}

export interface BudgetResult {
  starting_spoons: number;
  effective_baseline: number;
  sleep_factor: number;
  pain_deduction: number;
  weather_deduction: number;
  deduction_reasons: string[];
}

export function calculateMorningBudget(
  input: BudgetInput,
  weatherReasons: string[]
): BudgetResult {
  // Effective baseline after multiplier
  const effectiveBaseline = Math.round(
    input.baseline_spoons / input.current_multiplier
  );

  // Sleep factor: scales the baseline
  const sleepFactor = input.sleep_score / 10;
  const afterSleep = effectiveBaseline * sleepFactor;

  // Pain deduction: halved pain score
  const painDeduction = input.pain_score / 2;

  // Raw calculation
  const raw = afterSleep - input.weather_deduction - painDeduction;

  // Constraint: never below 3 spoons
  const startingSpoons = Math.max(3, Math.round(raw));

  // Build deduction explanation
  const deductionReasons: string[] = [];

  if (sleepFactor < 0.7) {
    deductionReasons.push(
      `Poor sleep (${input.sleep_score}/10) reduced baseline by ${Math.round((1 - sleepFactor) * 100)}%`
    );
  }

  if (input.weather_deduction > 0) {
    deductionReasons.push(...weatherReasons);
  }

  if (painDeduction >= 3) {
    deductionReasons.push(
      `High pain level (${input.pain_score}/10) cost ${painDeduction.toFixed(1)} spoons`
    );
  }

  if (startingSpoons === 3 && raw < 3) {
    deductionReasons.push(
      "Budget floored at 3 spoons — minimum for basic self-care"
    );
  }

  return {
    starting_spoons: startingSpoons,
    effective_baseline: effectiveBaseline,
    sleep_factor: sleepFactor,
    pain_deduction: painDeduction,
    weather_deduction: input.weather_deduction,
    deduction_reasons: deductionReasons,
  };
}
