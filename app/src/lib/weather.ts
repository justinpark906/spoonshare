/**
 * Weather Integration Service for SpoonShare
 *
 * Fetches barometric pressure & temperature from OpenWeatherMap,
 * compares against 12h-ago readings to compute spoon deductions.
 */

export interface WeatherData {
  pressure_hpa: number;
  temperature_c: number;
  humidity: number;
  weather_condition: string;
}

export interface WeatherDeductionResult {
  current: WeatherData;
  pressure_delta: number; // negative = drop
  weather_deduction: number;
  reasons: string[];
}

const OWM_BASE = "https://api.openweathermap.org/data/2.5/weather";

/**
 * Fetch current weather for a given lat/lon from OpenWeatherMap.
 */
export async function fetchCurrentWeather(
  lat: number,
  lon: number,
): Promise<WeatherData> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!apiKey || apiKey === "your_openweathermap_api_key_here") {
    // Return realistic demo data for hackathon/testing
    return {
      pressure_hpa: 1014,
      temperature_c: 20,
      humidity: 52,
      weather_condition: "partly cloudy",
    };
  }

  const url = `${OWM_BASE}?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30min

  if (!res.ok) {
    throw new Error(`OpenWeatherMap API error: ${res.status}`);
  }

  const data = await res.json();

  return {
    pressure_hpa: data.main.pressure,
    temperature_c: data.main.temp,
    humidity: data.main.humidity,
    weather_condition: data.weather?.[0]?.description ?? "unknown",
  };
}

/**
 * Calculate weather-based spoon deductions.
 *
 * Rules:
 * - Pressure drop > 5 hPa in 12h → deduct 3 spoons
 * - Temperature < 50°F (10°C) AND user has 'Chronic Pain' tag → deduct 2 spoons
 */
export function calculateWeatherDeductions(
  current: WeatherData,
  previousPressure: number | null,
  conditionTags: string[],
): WeatherDeductionResult {
  let weatherDeduction = 0;
  const reasons: string[] = [];

  // --- Barometric pressure delta check ---
  let pressureDelta = 0;
  if (previousPressure !== null) {
    pressureDelta = current.pressure_hpa - previousPressure;

    if (pressureDelta < -5) {
      weatherDeduction += 3;
      reasons.push(
        `Barometric pressure dropped ${Math.abs(pressureDelta).toFixed(1)} hPa in 12h (storm approaching)`,
      );
    }
  }

  // --- Cold + Chronic Pain check ---
  const hasChronicPain = conditionTags.some(
    (tag) =>
      tag.toLowerCase().includes("pain") ||
      tag.toLowerCase().includes("eds") ||
      tag.toLowerCase().includes("fibro"),
  );

  if (current.temperature_c < 10 && hasChronicPain) {
    weatherDeduction += 2;
    const temperatureF = (current.temperature_c * 9) / 5 + 32;
    reasons.push(
      `Cold temperature (${temperatureF.toFixed(1)}°F) with chronic pain profile`,
    );
  }

  return {
    current,
    pressure_delta: pressureDelta,
    weather_deduction: weatherDeduction,
    reasons,
  };
}
