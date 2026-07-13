// Current Melbourne Airport conditions for the display sidebar. This mirrors
// the hosted serverless route so the full local appliance has the same UI.

const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");

const WEATHER_URL = new URL("https://api.open-meteo.com/v1/forecast");
WEATHER_URL.searchParams.set("latitude", "-37.4587733");
WEATHER_URL.searchParams.set("longitude", "144.6776503");
WEATHER_URL.searchParams.set("current", CURRENT_FIELDS);
WEATHER_URL.searchParams.set("temperature_unit", "celsius");
WEATHER_URL.searchParams.set("wind_speed_unit", "kn");
WEATHER_URL.searchParams.set("precipitation_unit", "mm");
WEATHER_URL.searchParams.set("timezone", "Australia/Melbourne");
WEATHER_URL.searchParams.set("forecast_days", "1");

interface OpenMeteoResponse {
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

export async function fetchAirportWeather(): Promise<object> {
  const response = await fetch(WEATHER_URL, {
    headers: { "User-Agent": "brentons-flight-deck/0.1" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`weather source returned HTTP ${response.status}`);
  const body = (await response.json()) as OpenMeteoResponse;
  const current = body.current;
  if (!current) throw new Error("weather source returned no current conditions");

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
