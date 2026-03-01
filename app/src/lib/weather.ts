/**
 * Weather Integration Service for SpoonShare
 *
 * Fetches barometric pressure & temperature from OpenWeatherMap
 * or an Open-Meteo URL provided via WEATHER_API_KEY,
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

function weatherCodeToDescription(code: number): string {
  if (code === 0) return "clear sky";
  if ([1, 2].includes(code)) return "partly cloudy";
  if (code === 3) return "overcast";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunderstorm";
  return "unknown";
}

/**
 * Fetch current weather for a given lat/lon from OpenWeatherMap.
 */
export async function fetchCurrentWeather(
  lat: number,
  lon: number,
): Promise<WeatherData> {
  const weatherApiOverride = process.env.WEATHER_API_KEY?.trim();
  if (weatherApiOverride?.startsWith("http")) {
    const res = await fetch(weatherApiOverride, { next: { revalidate: 1800 } });

    if (!res.ok) {
      throw new Error(`Open-Meteo API error: ${res.status}`);
    }

    const data = await res.json();
    const currentWeather = data?.current_weather;

    const rawTemp = Number(currentWeather?.temperature);
    const usesFahrenheit = /temperature_unit=fahrenheit/i.test(weatherApiOverride);
    const temperatureC = usesFahrenheit
      ? ((rawTemp - 32) * 5) / 9
      : rawTemp;

    const surfacePressure = Number(data?.current?.surface_pressure);
    const humidity = Number(data?.current?.relative_humidity_2m);
    const weatherCode = Number(currentWeather?.weathercode);

    return {
      pressure_hpa: Number.isFinite(surfacePressure) ? surfacePressure : 1013,
      temperature_c: Number.isFinite(temperatureC) ? temperatureC : 20,
      humidity: Number.isFinite(humidity) ? humidity : 50,
      weather_condition: weatherCodeToDescription(weatherCode),
    };
  }

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
