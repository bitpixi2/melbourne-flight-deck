import { useEffect, useState } from "react";

export interface WeatherSnapshot {
  now: number;
  current: {
    observedAt: string;
    temperatureC: number;
    apparentC: number;
    humidityPct: number;
    precipitationMm: number;
    weatherCode: number;
    cloudPct: number;
    pressureHpa: number;
    windKt: number;
    windDirectionDeg: number;
    gustKt: number;
  };
}

const DIRECT_WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=-37.4587733&longitude=144.6776503" +
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
  "&temperature_unit=celsius&wind_speed_unit=kn&precipitation_unit=mm" +
  "&timezone=Australia%2FMelbourne&forecast_days=1";

interface DirectWeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
}

function normalizeDirectWeather(body: DirectWeatherResponse): WeatherSnapshot {
  const current = body.current;
  return {
    now: Date.now(),
    current: {
      observedAt: current.time,
      temperatureC: current.temperature_2m,
      apparentC: current.apparent_temperature,
      humidityPct: current.relative_humidity_2m,
      precipitationMm: current.precipitation,
      weatherCode: current.weather_code,
      cloudPct: current.cloud_cover,
      pressureHpa: current.pressure_msl,
      windKt: current.wind_speed_10m,
      windDirectionDeg: current.wind_direction_10m,
      gustKt: current.wind_gusts_10m,
    },
  };
}

async function fetchWeather(signal: AbortSignal): Promise<WeatherSnapshot> {
  const hostedResponse = await fetch("/api/weather", { signal });
  if (hostedResponse.ok) return (await hostedResponse.json()) as WeatherSnapshot;

  // The full local appliance predates this stateless endpoint. Its browser can
  // still read the same public feed directly, while hosted TVs remain same-origin.
  const directResponse = await fetch(DIRECT_WEATHER_URL, { signal });
  if (!directResponse.ok) throw new Error(`weather returned HTTP ${directResponse.status}`);
  return normalizeDirectWeather((await directResponse.json()) as DirectWeatherResponse);
}

export function useWeather(): { weather: WeatherSnapshot | null; unavailable: boolean } {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setWeather(await fetchWeather(controller.signal));
        setUnavailable(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setUnavailable(true);
      }
    };

    void load();
    const timer = setInterval(() => void load(), 5 * 60 * 1000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return { weather, unavailable };
}
