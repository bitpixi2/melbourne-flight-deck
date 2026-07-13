import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  MI_TO_KM,
  RIDDELLS_CREEK_VIEWPOINT,
  llToMeters,
  metersToMiles,
  rangeMeters,
  type Aircraft,
} from "@shared/index.js";
import type { StreamState } from "../lib/connection.js";
import { AirlineLogo, airlineFromCallsign } from "./AirlineLogo.js";
import { useNextIssPass } from "./useNextIssPass.js";
import { useWeather } from "./useWeather.js";
import { WeatherGlyph, weatherCondition } from "./WeatherGlyph.js";

export type DeckView = "runway" | "sky";

const MELBOURNE_TIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

const MELBOURNE_DATE = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const ISS_TIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface FlightDeckProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  state: StreamState;
  view: DeckView;
  autoSwitching: boolean;
  fullscreenActive: boolean;
  onToggleFullscreen: () => void;
  onSelectView?: (view: DeckView) => void;
}

interface NearbyFlight {
  aircraft: Aircraft;
  distanceKm: number;
}

function windDirection(degrees: number): string {
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round((((degrees % 360) + 360) % 360) / 22.5) % points.length];
}

function flightName(aircraft: Aircraft): string {
  return aircraft.flight || aircraft.registration || aircraft.hex.toUpperCase();
}

function aircraftName(aircraft: Aircraft): string {
  return aircraft.typeName || aircraft.typeCode || "Aircraft";
}

function altitudeText(aircraft: Aircraft): string | null {
  const altitude = aircraft.altBaro ?? aircraft.altGeom;
  return altitude == null ? null : `${(Math.round(altitude / 100) * 100).toLocaleString()} ft`;
}

function verticalText(rate: number): string {
  const rounded = Math.round(rate / 10) * 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()} ft/min`;
}

function movementText(aircraft: Aircraft): string {
  const rate = aircraft.baroRate ?? 0;
  if (rate > 250) return "Climbing";
  if (rate < -250) return "Descending";
  return "Level";
}

function trackText(track: number): string {
  return `${Math.round(track).toString().padStart(3, "0")}° ${windDirection(track)}`;
}

function directionArrow(track: number | undefined): string {
  if (track == null) return "·";
  return ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][Math.round(track / 45) % 8];
}

function observedTime(observedAt: string): string {
  return observedAt.split("T")[1]?.slice(0, 5) ?? "now";
}

export function FlightDeck({
  canvasRef,
  state,
  view,
  autoSwitching,
  fullscreenActive,
  onToggleFullscreen,
  onSelectView,
}: FlightDeckProps) {
  const [clock, setClock] = useState(() => Date.now());
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const { weather, unavailable: weatherUnavailable } = useWeather();
  const nextIssPass = useNextIssPass();

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
          distanceKm: metersToMiles(rangeMeters(local)) * MI_TO_KM,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [state.nearbyAircraft]);

  const airborneFlights = nearbyFlights.filter(({ aircraft }) => !aircraft.onGround);
  const closest = airborneFlights[0] ?? null;
  const nextFive = airborneFlights.slice(1, 6);
  const selectedFlight = selectedHex
    ? airborneFlights.find(({ aircraft }) => aircraft.hex === selectedHex) ?? closest
    : closest;
  const isSelected = selectedHex != null && selectedFlight?.aircraft.hex === selectedHex;
  const feedLive = state.connected && (state.status?.ok ?? true);
  const currentWeather = weather?.current;
  const condition = currentWeather
    ? weatherCondition(currentWeather.weatherCode, currentWeather.isDay)
    : null;
  const selectedAircraft = selectedFlight?.aircraft;
  const selectedAirline = airlineFromCallsign(selectedAircraft?.flight);
  const verifiedRoute = selectedAircraft?.origin && selectedAircraft?.destination
    ? { origin: selectedAircraft.origin, destination: selectedAircraft.destination }
    : null;

  return (
    <>
      <header className="deck-topbar">
        <div className="deck-brand">
          <h1>Brenton's Flight Deck</h1>
          <p>
            Melbourne airspace
            <span className={`deck-live ${feedLive ? "is-live" : "is-offline"}`}>
              <i aria-hidden="true" /> {feedLive ? "Live" : "Reconnecting"}
            </span>
          </p>
        </div>
        <div className="deck-status">
          <div className="deck-time">
            <time dateTime={new Date(clock).toISOString()}>{MELBOURNE_TIME.format(clock)}</time>
            <span>{MELBOURNE_DATE.format(clock)}</span>
          </div>
        </div>
      </header>

      <main className="deck-main-grid">
        <section className="radar-panel" aria-label={view === "sky" ? "Looking-up sky view" : "Home-centred airspace view"}>
          <canvas ref={canvasRef} className="display-canvas" />
          <div className="radar-heading">
            <div>
              <strong>{view === "sky" ? "Looking up · Local sky" : "Home-centred airspace · 70 km"}</strong>
              <span>{view === "sky" ? "Live sky positions and elevation" : "Live positions · refreshed every 3 seconds"}</span>
            </div>
            <div className="radar-controls">
              {onSelectView && (
                <div className="view-control">
                  <div className="view-switch" role="group" aria-label="Display view">
                    <button
                      type="button"
                      className={view === "runway" ? "is-active" : ""}
                      aria-pressed={view === "runway"}
                      onClick={() => onSelectView("runway")}
                    >
                      <i aria-hidden="true">◎</i> Airspace
                    </button>
                    <button
                      type="button"
                      className={view === "sky" ? "is-active" : ""}
                      aria-pressed={view === "sky"}
                      onClick={() => onSelectView("sky")}
                    >
                      <i aria-hidden="true">⌃</i> Look up
                    </button>
                  </div>
                  {autoSwitching && <small>Auto-switches every 45s</small>}
                </div>
              )}
              <button
                type="button"
                className={`expand-button ${fullscreenActive ? "is-active" : ""}`}
                aria-label={fullscreenActive ? "Exit full screen" : "Expand flight deck to full screen"}
                aria-pressed={fullscreenActive}
                onClick={onToggleFullscreen}
                title={fullscreenActive ? "Exit full screen (f)" : "Expand to full screen and keep the display awake (f)"}
              >
                <i aria-hidden="true">{fullscreenActive ? "↙" : "↗"}</i>
                {fullscreenActive ? "Exit" : "Expand"}
              </button>
            </div>
          </div>
          <div className="radar-badges" aria-label="Current map context">
            {currentWeather && (
              <span>Home wind · {windDirection(currentWeather.windDirectionDeg)} {Math.round(currentWeather.windKt)} kt</span>
            )}
            <span>{view === "sky" ? "Look-up dome" : "YMML runway context"}</span>
            <span>{airborneFlights.length} aircraft in view</span>
          </div>
        </section>

        <aside className="right-rail" aria-label="Live aircraft and weather">
          <section className="weather-card" aria-label="Live local weather in Victoria">
            <div className="weather-heading">
              <div>
                <span>Home weather</span>
                <small>{currentWeather ? `Updated ${observedTime(currentWeather.observedAt)}` : "Live conditions"}</small>
              </div>
              <b className={weatherUnavailable ? "is-offline" : "is-live"}>
                <i aria-hidden="true" /> {weatherUnavailable ? "Unavailable" : "Live"}
              </b>
            </div>
            {currentWeather && condition ? (
              <>
                <div className="weather-now">
                  <WeatherGlyph kind={condition.kind} />
                  <div>
                    <strong>{Math.round(currentWeather.temperatureC)}°</strong>
                    <span>{condition.label}</span>
                    <small>Feels {Math.round(currentWeather.apparentC)}° · {Math.round(currentWeather.cloudPct)}% cloud</small>
                  </div>
                </div>
                <dl className="weather-metrics">
                  <div><dt>Wind</dt><dd>{windDirection(currentWeather.windDirectionDeg)} {Math.round(currentWeather.windKt)} <small>kt</small></dd></div>
                  <div><dt>Humidity</dt><dd>{Math.round(currentWeather.humidityPct)}<small>%</small></dd></div>
                  <div><dt>Rain</dt><dd>{currentWeather.precipitationMm.toFixed(1)} <small>mm</small></dd></div>
                  <div><dt>Pressure</dt><dd>{Math.round(currentWeather.pressureHpa)} <small>hPa</small></dd></div>
                </dl>
              </>
            ) : (
              <div className="weather-loading">{weatherUnavailable ? "Weather feed unavailable" : "Loading live weather…"}</div>
            )}
          </section>

          <section className="closest-card" aria-label={isSelected ? "Selected live aircraft" : "Closest live aircraft"}>
            {selectedFlight && selectedAircraft ? (
              <>
                <div className="closest-heading">
                  <span>{isSelected ? "Selected aircraft" : "Closest aircraft"}</span>
                  <div className="closest-actions">
                    <b>{selectedFlight.distanceKm.toFixed(1)} km</b>
                    {isSelected && (
                      <button type="button" onClick={() => setSelectedHex(null)}>Show nearest</button>
                    )}
                  </div>
                </div>
                <div className="aircraft-title">
                  <div>
                    <h2>{flightName(selectedAircraft)}</h2>
                    {(selectedAirline || selectedAircraft.airline) && (
                      <p className="closest-airline">{selectedAirline?.name ?? selectedAircraft.airline}</p>
                    )}
                  </div>
                  {selectedAirline && (
                    <AirlineLogo
                      key={selectedAirline.icao}
                      airline={selectedAirline}
                      variant="icon"
                      className="airline-logo-featured"
                    />
                  )}
                </div>

                <dl className="aircraft-identity">
                  <div><dt>Aircraft</dt><dd>{aircraftName(selectedAircraft)}</dd></div>
                  {selectedAircraft.typeCode && <div><dt>Type</dt><dd>{selectedAircraft.typeCode}</dd></div>}
                  {selectedAircraft.registration && <div><dt>Registration</dt><dd>{selectedAircraft.registration}</dd></div>}
                  {selectedAircraft.track != null && <div><dt>Track</dt><dd>{trackText(selectedAircraft.track)}</dd></div>}
                </dl>

                <dl className="aircraft-metrics">
                  {altitudeText(selectedAircraft) && <div><dt>Altitude</dt><dd>{altitudeText(selectedAircraft)}</dd></div>}
                  {selectedAircraft.gs != null && <div><dt>Ground speed</dt><dd>{Math.round(selectedAircraft.gs)} kt</dd></div>}
                  <div><dt>Distance</dt><dd>{selectedFlight.distanceKm.toFixed(1)} km</dd></div>
                  {selectedAircraft.baroRate != null && <div><dt>Vertical</dt><dd>{verticalText(selectedAircraft.baroRate)}</dd></div>}
                </dl>

                {verifiedRoute && (
                  <div className="verified-route">
                    <span>Verified route</span>
                    <div><b>{verifiedRoute.origin}</b><i aria-hidden="true" /><b>{verifiedRoute.destination}</b></div>
                  </div>
                )}
              </>
            ) : (
              <div className="sky-idle">
                <span>Sky watch</span>
                <h2>Airspace quiet</h2>
                <p>Stars, Moon, planets and satellites remain live in the looking-up view.</p>
                <div>
                  <small>Next ISS pass</small>
                  <strong>{nextIssPass ? ISS_TIME.format(nextIssPass) : "Calculating…"}</strong>
                </div>
              </div>
            )}
          </section>

        </aside>
      </main>

      <section className="next-strip" aria-label="Next five nearby aircraft">
        <div className="strip-intro">
          <strong>Next five</strong>
          <span>Tap any flight to inspect it in the right rail</span>
        </div>
        <div className="strip-flights">
          {nextFive.length ? nextFive.map(({ aircraft, distanceKm }) => {
            const airline = airlineFromCallsign(aircraft.flight);
            return (
              <button
                type="button"
                className={`strip-flight ${selectedHex === aircraft.hex ? "is-selected" : ""}`}
                key={aircraft.hex}
                aria-pressed={selectedHex === aircraft.hex}
                aria-label={`Show details for ${flightName(aircraft)}`}
                onClick={() => setSelectedHex(aircraft.hex)}
              >
                <span className="strip-flight-heading">
                  {airline && <AirlineLogo airline={airline} variant="icon" />}
                  <strong>{flightName(aircraft)}</strong>
                  <b aria-hidden="true">{directionArrow(aircraft.track)}</b>
                </span>
                <span className="strip-flight-type">{aircraftName(aircraft)}</span>
                <span className="strip-flight-footer">
                  <strong>{distanceKm.toFixed(1)} <small>km</small></strong>
                  <span>{altitudeText(aircraft) ?? "Altitude unavailable"}<br />{movementText(aircraft)}</span>
                </span>
              </button>
            );
          }) : (
            <div className="strip-idle">Aircraft tiles will appear here when traffic enters the 70 km view.</div>
          )}
        </div>
      </section>
    </>
  );
}
