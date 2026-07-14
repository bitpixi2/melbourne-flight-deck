import { useEffect, useMemo, useRef, useState } from "react";
import {
  MI_TO_KM,
  RIDDELLS_CREEK_VIEWPOINT,
  llToMeters,
  metersToMiles,
  rangeMeters,
  type Aircraft,
  type CompanionScene,
  type Config,
} from "@shared/index.js";
import { useStream } from "../lib/useStream.js";
import { Renderer } from "../display/renderer.js";
import { PROJECTOR_RUNWAY_CONFIG, PROJECTOR_SKY_CONFIG } from "../display/projectorConfig.js";

interface DemoFlight {
  aircraft: Aircraft;
  distanceKm: number;
}

const VIEW_SECONDS = 45;
const SCENES: { scene: CompanionScene; icon: string; title: string; description: string }[] = [
  { scene: "auto", icon: "◎", title: "Automatic", description: "Switches every 45 seconds" },
  { scene: "overhead", icon: "⌃", title: "Overhead", description: "Aircraft in the live sky" },
  { scene: "runway", icon: "⌁", title: "Runway", description: "Melbourne airspace radar" },
  { scene: "follow", icon: "⌖", title: "Follow", description: "Highlight the chosen flight" },
];

const REPRESENTATIVE_AIRCRAFT: Aircraft[] = [
  { hex: "7c4a11", flight: "QFA476", registration: "VH-VYH", typeCode: "B738", typeName: "Boeing 737-800", airline: "Qantas", origin: "MEL", destination: "SYD", lat: -37.35, lon: 144.76, altBaro: 11800, gs: 356, track: 18, baroRate: 1280 },
  { hex: "7c6b22", flight: "JST503", registration: "VH-VFJ", typeCode: "A320", typeName: "Airbus A320", airline: "Jetstar", origin: "SYD", destination: "MEL", lat: -37.51, lon: 144.81, altBaro: 8400, gs: 301, track: 214, baroRate: -960 },
  { hex: "7c7c33", flight: "VOZ812", registration: "VH-YFR", typeCode: "B738", typeName: "Boeing 737-800", airline: "Virgin Australia", lat: -37.42, lon: 144.53, altBaro: 18400, gs: 408, track: 101, baroRate: 0 },
  { hex: "7c8d44", flight: "RFD221", registration: "VH-8KH", typeCode: "B350", typeName: "King Air 350", lat: -37.57, lon: 144.66, altBaro: 6200, gs: 224, track: 338, baroRate: 420 },
];

function flightName(aircraft: Aircraft): string {
  return aircraft.flight || aircraft.registration || aircraft.hex.toUpperCase();
}

function aircraftName(aircraft: Aircraft): string {
  return aircraft.typeName || aircraft.typeCode || "Aircraft";
}

function altitudeText(aircraft: Aircraft): string {
  if (aircraft.onGround) return "Ground";
  const altitude = aircraft.altBaro ?? aircraft.altGeom;
  return altitude == null ? "—" : `${(Math.round(altitude / 100) * 100).toLocaleString()} ft`;
}

function directionArrow(track: number | undefined): string {
  if (track == null) return "·";
  return ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][Math.round(track / 45) % 8];
}

function distanceKm(aircraft: Aircraft): number {
  if (aircraft.lat == null || aircraft.lon == null) return Number.POSITIVE_INFINITY;
  const local = llToMeters(
    aircraft.lat,
    aircraft.lon,
    RIDDELLS_CREEK_VIEWPOINT.lat,
    RIDDELLS_CREEK_VIEWPOINT.lon,
  );
  return metersToMiles(rangeMeters(local)) * MI_TO_KM;
}

export function CeilingControlsDemo() {
  const { state } = useStream("display");
  const [scene, setScene] = useState<CompanionScene>("auto");
  const [autoView, setAutoView] = useState<"overhead" | "runway">("overhead");
  const [selectedHex, setSelectedHex] = useState(REPRESENTATIVE_AIRCRAFT[0].hex);
  const [sampleTick, setSampleTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  const liveAircraft = state.aircraft.filter((aircraft) => aircraft.lat != null && aircraft.lon != null);
  const usingSampleData = liveAircraft.length === 0;
  const aircraft = usingSampleData ? REPRESENTATIVE_AIRCRAFT : liveAircraft;
  const flights = useMemo<DemoFlight[]>(() => aircraft
    .filter((item) => !item.onGround && item.lat != null && item.lon != null)
    .map((item) => ({ aircraft: item, distanceKm: distanceKm(item) }))
    .sort((a, b) => a.distanceKm - b.distanceKm), [aircraft]);

  const selected = flights.find((flight) => flight.aircraft.hex === selectedHex) ?? flights[0] ?? null;
  const visibleView = scene === "auto" ? autoView : scene === "runway" ? "runway" : "overhead";
  const config: Config = visibleView === "runway" ? PROJECTOR_RUNWAY_CONFIG : PROJECTOR_SKY_CONFIG;
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (scene !== "auto") return;
    const timer = setTimeout(
      () => setAutoView((current) => current === "overhead" ? "runway" : "overhead"),
      VIEW_SECONDS * 1000,
    );
    return () => clearTimeout(timer);
  }, [autoView, scene]);

  useEffect(() => {
    if (!usingSampleData) return;
    const timer = setInterval(() => setSampleTick((current) => current + 1), 3000);
    return () => clearInterval(timer);
  }, [usingSampleData]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new Renderer(canvasRef.current, () => configRef.current);
    rendererRef.current = renderer;
    renderer.start();
    const resize = () => renderer.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      renderer.stop();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.resetTracks();
    rendererRef.current?.update(aircraft);
  }, [config.projectionMode]);

  useEffect(() => {
    rendererRef.current?.update(aircraft);
  }, [aircraft, sampleTick, state.now]);

  useEffect(() => {
    rendererRef.current?.setSelectedAircraft(scene === "follow" ? selected?.aircraft.hex ?? null : null);
  }, [scene, selected?.aircraft.hex]);

  const chooseScene = (next: CompanionScene) => {
    if (next === "follow" && !selected) return;
    setScene(next);
    navigator.vibrate?.(12);
  };

  const chooseAircraft = (flight: DemoFlight) => {
    setSelectedHex(flight.aircraft.hex);
    setScene("follow");
    navigator.vibrate?.(18);
  };

  return (
    <main className="ceiling-demo">
      <header className="demo-header">
        <div>
          <p className="eyebrow">No pairing required</p>
          <h1>Ceiling Controls Demo</h1>
          <p>Try the phone controls here. The preview is the projector, so nothing connects to a real ceiling.</p>
        </div>
        <a href="/">Open real controls</a>
      </header>

      <section className="demo-projector" aria-label="Simulated ceiling projection">
        <canvas ref={canvasRef} aria-label="Live aircraft ceiling simulation" />
        <div className="demo-projector-label">
          <span><i />Projector simulation</span>
          <strong>{scene === "auto" ? `Automatic · ${autoView}` : scene}</strong>
        </div>
        {scene === "follow" && selected && (
          <div className="demo-follow-label">Following <strong>{flightName(selected.aircraft)}</strong></div>
        )}
      </section>

      <div className="demo-layout">
        <section className="demo-panel scene-section" aria-labelledby="demo-scenes">
          <div className="section-heading">
            <div><p className="eyebrow">Projection scene</p><h2 id="demo-scenes">What should appear above?</h2></div>
            <span>Changes are instant</span>
          </div>
          <div className="scene-grid">
            {SCENES.map((item) => (
              <button
                key={item.scene}
                type="button"
                className={scene === item.scene ? "active" : ""}
                disabled={item.scene === "follow" && !selected}
                aria-pressed={scene === item.scene}
                onClick={() => chooseScene(item.scene)}
              >
                <i aria-hidden="true">{item.icon}</i>
                <span><strong>{item.title}</strong><small>{item.description}</small></span>
              </button>
            ))}
          </div>
        </section>

        <section className="demo-panel nearby-section" aria-labelledby="demo-flights">
          <div className="section-heading">
            <div><p className="eyebrow">{usingSampleData ? "Representative traffic" : "Live traffic"}</p><h2 id="demo-flights">Tap a flight to follow</h2></div>
            <span>{usingSampleData ? "Sample mode" : `${flights.length} in view`}</span>
          </div>
          <div className="flight-list">
            {flights.slice(0, 6).map((flight) => (
              <button
                type="button"
                key={flight.aircraft.hex}
                className={scene === "follow" && selected?.aircraft.hex === flight.aircraft.hex ? "selected" : ""}
                onClick={() => chooseAircraft(flight)}
              >
                <span className="flight-list-logo">{directionArrow(flight.aircraft.track)}</span>
                <span className="flight-list-name"><strong>{flightName(flight.aircraft)}</strong><small>{aircraftName(flight.aircraft)}</small></span>
                <span className="flight-list-alt"><strong>{altitudeText(flight.aircraft)}</strong><small>{flight.aircraft.airline ?? "Live aircraft"}</small></span>
                <span className="flight-list-distance"><strong>{flight.distanceKm.toFixed(1)}</strong><small>km</small></span>
                <span className="flight-list-arrow">{directionArrow(flight.aircraft.track)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <p className="demo-note">Demo mode creates no pairing, saves no controller credentials and sends no projector commands.</p>
    </main>
  );
}
