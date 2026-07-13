// Current conditions for the Melbourne Airport flight-deck sidebar. Open-Meteo
// exposes current model conditions without an API key; the CDN absorbs repeat
// TV refreshes between model updates.

const CENTER_LAT = -37.4587733;
const CENTER_LON = 144.6776503;
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

const UPSTREAM = new URL("https://api.open-meteo.com/v1/forecast");
UPSTREAM.searchParams.set("latitude", String(CENTER_LAT));
UPSTREAM.searchParams.set("longitude", String(CENTER_LON));
UPSTREAM.searchParams.set("current", CURRENT_FIELDS);
UPSTREAM.searchParams.set("temperature_unit", "celsius");
UPSTREAM.searchParams.set("wind_speed_unit", "kn");
UPSTREAM.searchParams.set("precipitation_unit", "mm");
UPSTREAM.searchParams.set("timezone", "Australia/Melbourne");
UPSTREAM.searchParams.set("forecast_days", "1");

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "method not allowed" });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { "User-Agent": "brentons-flight-deck/0.1" },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error(`weather source returned HTTP ${upstream.status}`);
    const body = await upstream.json();
    const current = body.current;
    if (!current) throw new Error("weather source returned no current conditions");

    response.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=900, stale-if-error=3600",
    );
    return response.status(200).json({
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
    });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(502).json({
      error: error instanceof Error ? error.message : "weather source unavailable",
    });
  }
}
