import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Config, Theme } from "@shared/index.js";
import {
  DEFAULT_CONFIG,
  MI_TO_KM,
  RIDDELLS_CREEK_VIEWPOINT,
  formatDistance,
} from "@shared/index.js";
import { useStream } from "../lib/useStream.js";
import { kioskRequested, projectorRequested, useAmbientMode } from "../lib/useAmbientMode.js";
import { FlightDeck, type DeckView, type WideDeckView } from "./FlightDeck.js";
import { Renderer } from "./renderer.js";
import { ProjectorPairing } from "../companion/ProjectorPairing.js";
import { useProjectorCompanion } from "../companion/useCompanion.js";

const THEMES: Theme[] = ["ambient", "telemetry", "focus"];
const VIEW_SECONDS = 45;
const HOME_RADIUS_MILES = 70 / MI_TO_KM;
const FOLLOW_RADIUS_MILES = 18 / MI_TO_KM;
const RIDDELLS_AIRSPACE_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  centerLat: RIDDELLS_CREEK_VIEWPOINT.lat,
  centerLon: RIDDELLS_CREEK_VIEWPOINT.lon,
  locationName: RIDDELLS_CREEK_VIEWPOINT.name,
  radiusMiles: HOME_RADIUS_MILES,
  projectionMode: "map",
  mirrorX: false,
  showAirport: true,
  showStars: false,
  showSun: false,
  showMoon: false,
  showSatellites: false,
  showPlanets: false,
};
const RIDDELLS_SKY_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  centerLat: RIDDELLS_CREEK_VIEWPOINT.lat,
  centerLon: RIDDELLS_CREEK_VIEWPOINT.lon,
  locationName: RIDDELLS_CREEK_VIEWPOINT.name,
  radiusMiles: HOME_RADIUS_MILES,
  projectionMode: "sky",
  showAirport: false,
};
const PROJECTOR_SKY_CONFIG: Config = {
  ...RIDDELLS_SKY_CONFIG,
  mirrorX: true,
  showAirport: false,
  rangeRings: false,
  compass: false,
  showStars: true,
  showSun: true,
  showMoon: true,
  showSatellites: true,
  showPlanets: true,
  showDestArc: false,
  showRouteDetail: false,
  glyphSizePx: 28,
  trailSeconds: 75,
  trailOpacity: 0.72,
  labelDensity: "nearestOnly",
  nearestN: 1,
  showFields: {
    name: true,
    type: true,
    altitude: true,
    speed: true,
    verticalRate: false,
    destination: false,
    registration: false,
  },
};
const PROJECTOR_RUNWAY_CONFIG: Config = {
  ...PROJECTOR_SKY_CONFIG,
  projectionMode: "map",
  mirrorX: false,
  showAirport: true,
  rangeRings: true,
  compass: true,
  showStars: false,
  showSun: false,
  showMoon: false,
  showSatellites: false,
  showPlanets: false,
  labelDensity: "nearestN",
  nearestN: 3,
};
function requestedDeckView(): WideDeckView {
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested === "sky" || requested === "overhead" ? "overhead" : "runway";
}

export function Display() {
  const { state, conn } = useStream("display");
  const ambient = useAmbientMode();
  const projectorMode = projectorRequested();
  const companion = useProjectorCompanion(projectorMode);
  const [deckView, setDeckView] = useState<DeckView>(requestedDeckView);
  const [projectorAutoView, setProjectorAutoView] = useState<WideDeckView>("overhead");
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const lastWideViewRef = useRef<WideDeckView>(requestedDeckView());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const aircraftRef = useRef(state.aircraft);
  aircraftRef.current = state.aircraft;

  const forcedView = new URLSearchParams(window.location.search).has("view");
  const interactiveKiosk = kioskRequested() && !projectorMode;
  const personalDeck = state.hosted || forcedView || interactiveKiosk;
  const autoSwitchViews = (state.hosted || interactiveKiosk) && !forcedView;
  const followedAircraft = selectedHex
    ? state.aircraft.find((aircraft) => aircraft.hex === selectedHex)
      ?? state.nearbyAircraft.find((aircraft) => aircraft.hex === selectedHex)
    : undefined;
  const followConfig: Config | null = deckView === "focus"
    && followedAircraft?.lat != null
    && followedAircraft.lon != null
    ? {
        ...RIDDELLS_AIRSPACE_CONFIG,
        centerLat: followedAircraft.lat,
        centerLon: followedAircraft.lon,
        locationName: "Following aircraft",
        radiusMiles: FOLLOW_RADIUS_MILES,
        showAirport: false,
        showDestArc: false,
        labelDensity: "all",
        nearestN: 5,
      }
    : null;
  const projectorView: WideDeckView = companion.scene === "auto"
    ? projectorAutoView
    : companion.scene === "runway"
      ? "runway"
      : "overhead";
  const projectorBaseConfig = projectorView === "runway" ? PROJECTOR_RUNWAY_CONFIG : PROJECTOR_SKY_CONFIG;
  const calibratedProjectorConfig = companion.calibration
    ? {
        ...projectorBaseConfig,
        centerLat: companion.calibration.lat,
        centerLon: companion.calibration.lon,
        rotationDeg: companion.calibration.rotationDeg,
        mirrorX: companion.calibration.mirrorX,
        mirrorY: companion.calibration.mirrorY,
      }
    : projectorBaseConfig;
  const displayConfig = projectorMode
    ? calibratedProjectorConfig
    : personalDeck
      ? followConfig ?? (deckView === "overhead" ? RIDDELLS_SKY_CONFIG : RIDDELLS_AIRSPACE_CONFIG)
      : (state.config ?? DEFAULT_CONFIG);

  // Keep the latest config in a ref so the RAF loop always reads fresh values.
  const configRef = useRef<Config>(displayConfig);
  configRef.current = displayConfig;

  // Latest ambient toggle in a ref so the keydown listener stays subscribed once.
  const ambientToggleRef = useRef(ambient.toggle);
  ambientToggleRef.current = ambient.toggle;

  // Hosted TVs alternate between the airport plan and the observer's true
  // look-up sky. Following an aircraft pauses this until a wide view is chosen.
  useEffect(() => {
    if (!autoSwitchViews || projectorMode || deckView === "focus") return;
    const timer = setTimeout(
      () => setDeckView((current) => {
        const next = current === "runway" ? "overhead" : "runway";
        lastWideViewRef.current = next;
        return next;
      }),
      VIEW_SECONDS * 1000,
    );
    return () => clearTimeout(timer);
  }, [autoSwitchViews, deckView, projectorMode]);

  useEffect(() => {
    if (!projectorMode || companion.scene !== "auto") return;
    const timer = setTimeout(
      () => setProjectorAutoView((current) => current === "runway" ? "overhead" : "runway"),
      VIEW_SECONDS * 1000,
    );
    return () => clearTimeout(timer);
  }, [companion.scene, projectorAutoView, projectorMode]);

  // If a followed aircraft leaves the feed, return to the last wide view.
  useEffect(() => {
    if (deckView !== "focus") return;
    if (followedAircraft?.lat != null && followedAircraft.lon != null) return;
    setSelectedHex(null);
    setDeckView(lastWideViewRef.current);
  }, [deckView, followedAircraft]);

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

  useEffect(() => {
    rendererRef.current?.setSelectedAircraft(
      projectorMode && companion.scene === "follow" ? companion.selectedHex ?? null : null,
    );
  }, [companion.scene, companion.selectedHex, projectorMode]);

  const missingFollowSnapshots = useRef(0);
  useEffect(() => {
    if (!projectorMode || companion.scene !== "follow" || !companion.selectedHex || !state.now) {
      missingFollowSnapshots.current = 0;
      return;
    }
    const present = state.aircraft.some((aircraft) => aircraft.hex === companion.selectedHex)
      || state.nearbyAircraft.some((aircraft) => aircraft.hex === companion.selectedHex);
    missingFollowSnapshots.current = present ? 0 : missingFollowSnapshots.current + 1;
    if (missingFollowSnapshots.current >= 2) {
      missingFollowSnapshots.current = 0;
      companion.fallbackToOverhead("Selected aircraft left the live area");
    }
  }, [
    companion.fallbackToOverhead,
    companion.scene,
    companion.selectedHex,
    projectorMode,
    state.aircraft,
    state.nearbyAircraft,
    state.now,
  ]);

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

  const selectWideView = (view: WideDeckView) => {
    lastWideViewRef.current = view;
    setSelectedHex(null);
    setDeckView(view);
  };

  const followAircraft = (hex: string) => {
    if (deckView !== "focus") lastWideViewRef.current = deckView;
    setSelectedHex(hex);
    setDeckView("focus");
  };

  const stopFollowing = () => {
    setSelectedHex(null);
    setDeckView(lastWideViewRef.current);
  };

  const pickCanvasAircraft = (event: MouseEvent<HTMLCanvasElement>) => {
    const hex = rendererRef.current?.pickAircraft(event.clientX, event.clientY);
    if (hex) followAircraft(hex);
  };

  const cfg = displayConfig;
  return (
    <div className={`display-root${projectorMode ? " projector-mode" : ""}`}>
      {projectorMode ? (
        <>
          <canvas
            ref={canvasRef}
            className="display-canvas projector-canvas"
            aria-label="Live overhead aircraft projector view"
          />
          <ProjectorPairing
            pairUrl={companion.pairUrl}
            connected={companion.connected}
            controllerConnected={companion.controllerConnected}
            error={companion.error}
          />
        </>
      ) : (
        <FlightDeck
          canvasRef={canvasRef}
          state={state}
          view={personalDeck ? deckView : cfg.projectionMode === "sky" ? "overhead" : "runway"}
          selectedHex={selectedHex}
          autoSwitching={autoSwitchViews && deckView !== "focus"}
          fullscreenActive={ambient.fullscreen}
          onToggleFullscreen={ambient.toggle}
          onSelectView={personalDeck
            ? selectWideView
            : undefined}
          onSelectAircraft={personalDeck ? followAircraft : undefined}
          onClearSelection={stopFollowing}
          onCanvasClick={personalDeck ? pickCanvasAircraft : undefined}
        />
      )}
      {!projectorMode && cfg.showHud && (
        <div className="hud">
          <div className={`hud-dot ${state.connected ? "ok" : "bad"}`} />
          <span>
            {state.status?.source ?? "—"} · {state.aircraft.length} ac ·{" "}
            rot {cfg.rotationDeg}° · mirror {cfg.mirrorX ? "X" : "–"}
            {cfg.mirrorY ? "Y" : ""} · r {formatDistance(cfg.radiusMiles, cfg.distanceUnit)} · {cfg.projectionMode} · {cfg.theme}
          </span>
        </div>
      )}
      {!projectorMode && !state.connected && <div className="reconnect">connecting…</div>}
    </div>
  );
}
