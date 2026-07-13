import { useEffect, useRef, useState } from "react";
import type { Config, Theme } from "@shared/index.js";
import {
  DEFAULT_CONFIG,
  NM_PER_MILE,
  RIDDELLS_CREEK_VIEWPOINT,
  formatDistance,
} from "@shared/index.js";
import { useStream } from "../lib/useStream.js";
import { useAmbientMode, kioskRequested } from "../lib/useAmbientMode.js";
import { FlightDeck, type DeckView } from "./FlightDeck.js";
import { Renderer } from "./renderer.js";

const THEMES: Theme[] = ["ambient", "telemetry", "focus"];
const VIEW_SECONDS = 45;
const RIDDELLS_SKY_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  centerLat: RIDDELLS_CREEK_VIEWPOINT.lat,
  centerLon: RIDDELLS_CREEK_VIEWPOINT.lon,
  locationName: RIDDELLS_CREEK_VIEWPOINT.name,
  radiusMiles: 25 / NM_PER_MILE,
  projectionMode: "sky",
  showAirport: false,
};

function requestedDeckView(): DeckView {
  return new URLSearchParams(window.location.search).get("view") === "sky" ? "sky" : "runway";
}

export function Display() {
  const { state, conn } = useStream("display");
  const ambient = useAmbientMode();
  const isKiosk = kioskRequested();
  const [deckView, setDeckView] = useState<DeckView>(requestedDeckView);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const aircraftRef = useRef(state.aircraft);
  aircraftRef.current = state.aircraft;

  const forcedView = new URLSearchParams(window.location.search).has("view");
  const personalDeck = state.hosted || forcedView;
  const displayConfig = personalDeck && deckView === "sky"
    ? RIDDELLS_SKY_CONFIG
    : (state.config ?? DEFAULT_CONFIG);

  // Keep the latest config in a ref so the RAF loop always reads fresh values.
  const configRef = useRef<Config>(displayConfig);
  configRef.current = displayConfig;

  // Latest ambient toggle in a ref so the keydown listener stays subscribed once.
  const ambientToggleRef = useRef(ambient.toggle);
  ambientToggleRef.current = ambient.toggle;

  // Hosted TVs alternate between the airport plan and the observer's true
  // look-up sky. Changing the view manually restarts the 45-second dwell.
  useEffect(() => {
    if (!state.hosted) return;
    const timer = setTimeout(
      () => setDeckView((current) => current === "runway" ? "sky" : "runway"),
      VIEW_SECONDS * 1000,
    );
    return () => clearTimeout(timer);
  }, [deckView, state.hosted]);

  // Create renderer once.
  useEffect(() => {
    if (!canvasRef.current) return;
    const r = new Renderer(canvasRef.current, () => configRef.current);
    rendererRef.current = r;
    r.start();
    const onResize = () => r.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      r.stop();
      rendererRef.current = null;
    };
  }, []);

  // Feed snapshots.
  useEffect(() => {
    rendererRef.current?.update(state.aircraft);
  }, [state.now, state.aircraft]);

  // Track histories are local coordinates, so changing viewpoint needs a
  // clean re-projection rather than carrying Melbourne-relative samples home.
  useEffect(() => {
    rendererRef.current?.resetTracks();
    rendererRef.current?.update(aircraftRef.current);
  }, [displayConfig.centerLat, displayConfig.centerLon, displayConfig.projectionMode]);

  // Source health: during an outage the renderer holds planes instead of
  // staling them out. A dropped WebSocket counts as an outage too.
  useEffect(() => {
    rendererRef.current?.setSourceOk(state.connected && (state.status?.ok ?? true));
  }, [state.connected, state.status]);

  // Keyboard calibration (handy when a keyboard is plugged into the Pi).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = configRef.current;
      switch (e.key) {
        case "r":
          conn.patchConfig({ rotationDeg: (c.rotationDeg + 5) % 360 });
          break;
        case "R":
          conn.patchConfig({ rotationDeg: (c.rotationDeg - 5 + 360) % 360 });
          break;
        case "m":
          conn.patchConfig({ mirrorX: !c.mirrorX });
          break;
        case "M":
          conn.patchConfig({ mirrorY: !c.mirrorY });
          break;
        case "t": {
          const next = THEMES[(THEMES.indexOf(c.theme) + 1) % THEMES.length];
          conn.patchConfig({ theme: next });
          break;
        }
        case "[":
          conn.patchConfig({ radiusMiles: Math.max(0.5, c.radiusMiles - 0.5) });
          break;
        case "]":
          conn.patchConfig({ radiusMiles: c.radiusMiles + 0.5 });
          break;
        case "h":
          conn.patchConfig({ showHud: !c.showHud });
          break;
        case "f":
          ambientToggleRef.current();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [conn]);

  const cfg = displayConfig;
  return (
    <div className="display-root">
      <canvas ref={canvasRef} className="display-canvas" />
      <FlightDeck
        state={state}
        view={personalDeck ? deckView : cfg.projectionMode === "sky" ? "sky" : "runway"}
        autoSwitching={state.hosted}
        trafficRadiusNm={personalDeck ? 25 : state.nearbyRadiusNm}
        onToggleView={personalDeck
          ? () => setDeckView((current) => current === "runway" ? "sky" : "runway")
          : undefined}
      />
      {cfg.showHud && (
        <div className="hud">
          <div className={`hud-dot ${state.connected ? "ok" : "bad"}`} />
          <span>
            {state.status?.source ?? "—"} · {state.aircraft.length} ac ·{" "}
            rot {cfg.rotationDeg}° · mirror {cfg.mirrorX ? "X" : "–"}
            {cfg.mirrorY ? "Y" : ""} · r {formatDistance(cfg.radiusMiles, cfg.distanceUnit)} · {cfg.projectionMode} · {cfg.theme}
          </span>
        </div>
      )}
      {!state.connected && <div className="reconnect">connecting…</div>}
      {!isKiosk && (
        <button
          type="button"
          className={`ambient-toggle ${ambient.active ? "on" : ""}`}
          onClick={() => ambient.toggle()}
          title={
            ambient.active
              ? "Exit ambient mode (fullscreen + keep awake) — press f"
              : "Ambient mode: fullscreen + keep screen awake — press f"
          }
          aria-label="Toggle ambient fullscreen mode"
        >
          {ambient.active ? "◱ exit ambient" : "◳ ambient"}
          {ambient.active && !ambient.wakeLocked && <span className="ambient-warn"> · no wake-lock</span>}
        </button>
      )}
    </div>
  );
}
