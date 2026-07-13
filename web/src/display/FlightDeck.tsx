import { useEffect, useMemo, useState } from "react";
import {
  NM_PER_MILE,
  RIDDELLS_CREEK_VIEWPOINT,
  llToMeters,
  metersToMiles,
  rangeMeters,
  type Aircraft,
} from "@shared/index.js";
import type { StreamState } from "../lib/connection.js";
import { useWeather } from "./useWeather.js";

export type DeckView = "runway" | "sky";

const MELBOURNE_TIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const MELBOURNE_DATE = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
  day: "2-digit",
  month: "long",
});

const UTC_TIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

interface FlightDeckProps {
  state: StreamState;
  view: DeckView;
  autoSwitching: boolean;
  trafficRadiusNm: number;
  onToggleView?: () => void;
}

interface NearbyFlight {
  aircraft: Aircraft;
  distanceNm: number;
}

function weatherDescription(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Current conditions";
}

function windDirection(degrees: number): string {
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round((((degrees % 360) + 360) % 360) / 22.5) % points.length];
}

function flightName(aircraft: Aircraft): string {
  return aircraft.flight || aircraft.registration || aircraft.hex.toUpperCase();
}

function flightDetail(aircraft: Aircraft): string {
  const details: string[] = [];
  if (aircraft.typeCode) details.push(aircraft.typeCode);
  if (aircraft.onGround) details.push("GND");
  else {
    const altitude = aircraft.altBaro ?? aircraft.altGeom;
    if (altitude != null) details.push(`${(Math.round(altitude / 100) * 100).toLocaleString()} ft`);
  }
  if (aircraft.gs != null) details.push(`${Math.round(aircraft.gs)} kt`);
  return details.join(" · ") || "Position received";
}

export function FlightDeck({ state, view, autoSwitching, trafficRadiusNm, onToggleView }: FlightDeckProps) {
  const [clock, setClock] = useState(() => Date.now());
  const { weather, unavailable: weatherUnavailable } = useWeather();

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nearbyFlights = useMemo<NearbyFlight[]>(() => {
    return state.nearbyAircraft
      .filter((aircraft) => aircraft.lat != null && aircraft.lon != null)
      .map((aircraft) => {
        const local = llToMeters(
          aircraft.lat!,
          aircraft.lon!,
          RIDDELLS_CREEK_VIEWPOINT.lat,
          RIDDELLS_CREEK_VIEWPOINT.lon,
        );
        return {
          aircraft,
          distanceNm: metersToMiles(rangeMeters(local)) * NM_PER_MILE,
        };
      })
      .sort((a, b) => a.distanceNm - b.distanceNm)
      .slice(0, 5);
  }, [state.nearbyAircraft]);

  const airborneCount = state.nearbyAircraft.filter((aircraft) => !aircraft.onGround).length;
  const feedAgeSec = state.now ? Math.max(0, Math.round((clock - state.now) / 1000)) : null;
  const feedLive = state.connected && (state.status?.ok ?? true);
  const current = weather?.current;

  return (
    <aside className="flight-deck" aria-label="Brenton's Flight Deck live information">
      <header className="deck-header">
        <div className="deck-airport-row">
          <span>{view === "sky" ? "RIDDELLS CREEK" : "MEL / YMML"}</span>
          <span className={`deck-live ${feedLive ? "is-live" : "is-offline"}`}>
            <i aria-hidden="true" /> {feedLive ? `LIVE${feedAgeSec != null ? ` · ${feedAgeSec}s` : ""}` : "RECONNECTING"}
          </span>
        </div>
        <h1>Brenton's<br />Flight Deck</h1>
        <div className="deck-location-row">
          <p>{view === "sky" ? "Looking up · Riddells Creek" : "Runway view · Melbourne Airport"}</p>
          {onToggleView && (
            <button type="button" onClick={onToggleView} aria-label={`Switch to ${view === "sky" ? "runway" : "looking up"} view`}>
              {view === "sky" ? "Runway" : "Look up"} <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
        {autoSwitching && <span className="deck-auto">Auto-switching every 45 seconds</span>}
      </header>

      <section className="deck-clock" aria-label="Current time">
        <time dateTime={new Date(clock).toISOString()}>{MELBOURNE_TIME.format(clock)}</time>
        <div>
          <span>{MELBOURNE_DATE.format(clock)}</span>
          <span>{UTC_TIME.format(clock)} UTC</span>
        </div>
      </section>

      <section className="deck-section deck-weather" aria-label="Current Riddells Creek weather">
        <div className="deck-section-heading">
          <span>Riddells Creek weather</span>
          <span>WX · 15 MIN MODEL</span>
        </div>
        {current ? (
          <>
            <div className="weather-main">
              <strong>{Math.round(current.temperatureC)}°</strong>
              <div>
                <b>{weatherDescription(current.weatherCode)}</b>
                <span>Feels {Math.round(current.apparentC)}° · Cloud {Math.round(current.cloudPct)}%</span>
              </div>
            </div>
            <div className="weather-grid">
              <div><span>Wind</span><b>{windDirection(current.windDirectionDeg)} {Math.round(current.windKt)} kt</b></div>
              <div><span>Gusts</span><b>{Math.round(current.gustKt)} kt</b></div>
              <div><span>Humidity</span><b>{Math.round(current.humidityPct)}%</b></div>
              <div><span>Pressure</span><b>{Math.round(current.pressureHpa)} hPa</b></div>
            </div>
          </>
        ) : (
          <div className="deck-placeholder">{weatherUnavailable ? "Weather temporarily unavailable" : "Loading local weather…"}</div>
        )}
      </section>

      <section className="deck-section deck-traffic" aria-label="Live nearby aircraft">
        <div className="deck-section-heading">
          <span>Nearby traffic</span>
          <span>{state.nearbyAircraft.length} IN {Math.round(trafficRadiusNm)} NM · {airborneCount} AIRBORNE</span>
        </div>
        {nearbyFlights.length ? (
          <ol className="flight-list">
            {nearbyFlights.map(({ aircraft, distanceNm }) => (
              <li key={aircraft.hex}>
                <div>
                  <strong>{flightName(aircraft)}</strong>
                  <span>{flightDetail(aircraft)}</span>
                </div>
                <b>{distanceNm.toFixed(1)} <small>NM</small></b>
              </li>
            ))}
          </ol>
        ) : (
          <div className="deck-placeholder">Scanning local airspace…</div>
        )}
      </section>

      <footer>
        <span>PUBLIC ADS-B</span>
        <span>OPEN-METEO WX</span>
      </footer>
    </aside>
  );
}
