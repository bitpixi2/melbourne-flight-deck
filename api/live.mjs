// Serverless Melbourne aircraft snapshot for the hosted TV preview. The full
// local appliance still uses its long-running WebSocket server; this endpoint
// gives browser-only displays a small polling fallback on Vercel.

// Approximate Riddells Creek suburb centre: close enough for a true look-up
// sky plot without publishing a household or street-level position.
const CENTER_LAT = -37.4587733;
const CENTER_LON = 144.6776503;
const API_RADIUS_NM = 25;
const UPSTREAM = `https://api.airplanes.live/v2/point/${CENTER_LAT}/${CENTER_LON}/${API_RADIUS_NM}`;

function distanceMiles(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(raw, now) {
  if (!raw.hex || raw.lat == null || raw.lon == null) return null;
  const onGround = raw.alt_baro === "ground";
  return {
    hex: raw.hex,
    flight: raw.flight?.trim() || undefined,
    lat: raw.lat,
    lon: raw.lon,
    altBaro: onGround ? null : raw.alt_baro ?? null,
    altGeom: raw.alt_geom ?? null,
    gs: raw.gs,
    track: raw.track,
    baroRate: raw.baro_rate ?? null,
    squawk: raw.squawk,
    category: raw.category,
    onGround,
    registration: raw.r,
    typeCode: raw.t,
    typeName: raw.desc,
    seen: raw.seen,
    rssi: raw.rssi,
    ts: now,
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "method not allowed" });
  }

  const now = Date.now();
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { "User-Agent": "skylight-melbourne-tv/0.1" },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error(`aircraft source returned HTTP ${upstream.status}`);
    const body = await upstream.json();
    const nearbyAircraft = (body.ac ?? body.aircraft ?? [])
      .map((raw) => normalize(raw, now))
      .filter(Boolean)
      .sort(
        (a, b) =>
          distanceMiles(CENTER_LAT, CENTER_LON, a.lat, a.lon) -
          distanceMiles(CENTER_LAT, CENTER_LON, b.lat, b.lon),
      );
    // Return the full area feed. The canvas applies the active view's own
    // centre/radius filter: tight around MEL in runway mode, wide in sky mode.
    const aircraft = nearbyAircraft;

    response.setHeader(
      "Cache-Control",
      "public, s-maxage=2, stale-while-revalidate=10, stale-if-error=60",
    );
    return response.status(200).json({
      now,
      aircraft,
      nearbyAircraft,
      nearbyRadiusNm: API_RADIUS_NM,
      status: { source: "api", ok: true, count: aircraft.length, lastOk: now },
    });
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(502).json({
      now,
      status: {
        source: "api",
        ok: false,
        count: 0,
        lastOk: null,
        message: error instanceof Error ? error.message : "aircraft source unavailable",
      },
    });
  }
}
