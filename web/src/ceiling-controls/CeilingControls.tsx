import { useEffect, useMemo, useState } from "react";
import {
  MI_TO_KM,
  RIDDELLS_CREEK_VIEWPOINT,
  llToMeters,
  metersToMiles,
  rangeMeters,
  type Aircraft,
  type CompanionScene,
} from "@shared/index.js";
import { AirlineLogo, airlineFromCallsign } from "../display/AirlineLogo.js";
import { useControllerCompanion } from "../companion/useCompanion.js";
import { geoAvailability, geoErrorMessage } from "../lib/geolocation.js";
import { useStream } from "../lib/useStream.js";

interface NearbyFlight {
  aircraft: Aircraft;
  distanceKm: number;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SCENES: { scene: CompanionScene; icon: string; title: string; description: string }[] = [
  { scene: "auto", icon: "◎", title: "Automatic", description: "Switches every 45 seconds" },
  { scene: "overhead", icon: "⌃", title: "Overhead", description: "Aircraft in the live sky" },
  { scene: "runway", icon: "⌁", title: "Runway", description: "Melbourne airspace radar" },
  { scene: "follow", icon: "⌖", title: "Follow", description: "Highlight the chosen flight" },
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

function movementText(aircraft: Aircraft): string {
  const rate = aircraft.baroRate ?? 0;
  if (rate > 250) return `Climbing +${Math.round(rate / 10) * 10} ft/min`;
  if (rate < -250) return `Descending ${Math.round(rate / 10) * 10} ft/min`;
  return "Level flight";
}

function directionArrow(track: number | undefined): string {
  if (track == null) return "·";
  return ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][Math.round(track / 45) % 8];
}

export function CeilingControls() {
  const controls = useControllerCompanion();
  const { state } = useStream("display");
  const [selectedHex, setSelectedHex] = useState<string | null>(controls.selectedHex ?? null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [rotationDeg, setRotationDeg] = useState(controls.calibration?.rotationDeg ?? 0);
  const [mirrorX, setMirrorX] = useState(controls.calibration?.mirrorX ?? true);
  const [mirrorY, setMirrorY] = useState(controls.calibration?.mirrorY ?? false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!controls.selectedHex) return;
    setSelectedHex(controls.selectedHex);
  }, [controls.selectedHex]);

  useEffect(() => {
    if (!controls.calibration) return;
    setRotationDeg(controls.calibration.rotationDeg);
    setMirrorX(controls.calibration.mirrorX);
    setMirrorY(controls.calibration.mirrorY);
  }, [controls.calibration]);

  const viewpoint = controls.calibration ?? {
    lat: RIDDELLS_CREEK_VIEWPOINT.lat,
    lon: RIDDELLS_CREEK_VIEWPOINT.lon,
  };
  const nearbyFlights = useMemo<NearbyFlight[]>(() => state.nearbyAircraft
    .filter((aircraft) => !aircraft.onGround && aircraft.lat != null && aircraft.lon != null)
    .map((aircraft) => {
      const local = llToMeters(aircraft.lat!, aircraft.lon!, viewpoint.lat, viewpoint.lon);
      return { aircraft, distanceKm: metersToMiles(rangeMeters(local)) * MI_TO_KM };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm), [state.nearbyAircraft, viewpoint.lat, viewpoint.lon]);

  const selected = nearbyFlights.find(({ aircraft }) => aircraft.hex === selectedHex) ?? nearbyFlights[0] ?? null;
  const feedLive = state.connected && (state.status?.ok ?? true);
  const selectedAirline = selected ? airlineFromCallsign(selected.aircraft.flight) : null;

  const chooseAircraft = async (flight: NearbyFlight) => {
    setSelectedHex(flight.aircraft.hex);
    await controls.sendScene("follow", flight.aircraft.hex);
    navigator.vibrate?.(18);
  };

  const chooseScene = async (scene: CompanionScene) => {
    await controls.sendScene(scene, scene === "follow" ? selected?.aircraft.hex : undefined);
    navigator.vibrate?.(12);
  };

  const usePhoneLocation = () => {
    const availability = geoAvailability({
      hasGeolocation: Boolean(navigator.geolocation),
      isSecureContext: window.isSecureContext,
      hostname: window.location.hostname,
    });
    if (!availability.ok) return setLocationStatus(availability.message);
    setLocationStatus("Finding this phone…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void controls.sendCalibration({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          rotationDeg,
          mirrorX,
          mirrorY,
        }).then((sent) => setLocationStatus(sent ? "Private ceiling viewpoint updated" : "Saved here; waiting for projector"));
      },
      (error) => setLocationStatus(geoErrorMessage(error.code, !window.isSecureContext)),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const saveOrientation = () => {
    if (!controls.calibration) return setLocationStatus("Use this phone’s location first");
    void controls.sendCalibration({
      lat: controls.calibration.lat,
      lon: controls.calibration.lon,
      rotationDeg,
      mirrorX,
      mirrorY,
    }).then((sent) => setLocationStatus(sent ? "Ceiling orientation updated" : "Saved here; waiting for projector"));
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  if (!controls.ready) {
    return <main className="controls-loading"><div className="controls-loader" /><p>Opening Brenton's controls…</p></main>;
  }

  if (!controls.paired) {
    return (
      <main className="controls-onboarding">
        <div className="onboarding-orbit" aria-hidden="true"><span>✈</span></div>
        <p className="eyebrow">Private ceiling link</p>
        <h1>Brenton's<br />Ceiling Controls</h1>
        <p className="onboarding-lead">Scan the QR code shown by Brenton’s Overhead projector to pair this phone.</p>
        <ol>
          <li><span>1</span>Open the overhead display on the projector.</li>
          <li><span>2</span>Scan its private QR code with this phone.</li>
          <li><span>3</span>Choose what appears on the ceiling.</li>
        </ol>
        <small>No account · one private controller · no screen mirroring</small>
      </main>
    );
  }

  return (
    <main className="ceiling-controls">
      <header className="controls-header">
        <div>
          <p className="eyebrow">Melbourne airspace</p>
          <h1>Brenton's Ceiling Controls</h1>
        </div>
        <div className="status-stack" aria-label="Connection status">
          <span className={feedLive ? "live" : "offline"}><i />{feedLive ? "Flights live" : "Flights reconnecting"}</span>
          <span className={controls.projectorConnected ? "live" : "offline"}><i />{controls.projectorConnected ? "Ceiling online" : "Ceiling offline"}</span>
        </div>
      </header>

      <section className={`selected-flight${selected ? " has-flight" : ""}`} aria-live="polite">
        {selected ? (
          <>
            <div className="selected-topline">
              <span>{controls.scene === "follow" ? "Showing above" : "Closest aircraft"}</span>
              <b>{selected.distanceKm.toFixed(1)} km</b>
            </div>
            <div className="selected-identity">
              <div>
                <h2>{flightName(selected.aircraft)}</h2>
                <p>{selectedAirline?.name ?? selected.aircraft.airline ?? aircraftName(selected.aircraft)}</p>
              </div>
              {selectedAirline && <AirlineLogo airline={selectedAirline} variant="icon" className="controls-airline-logo" />}
            </div>
            <div className="selected-route">
              {selected.aircraft.origin && selected.aircraft.destination
                ? <><strong>{selected.aircraft.origin}</strong><i /><strong>{selected.aircraft.destination}</strong></>
                : <span>Route appears only when verified by the live feed</span>}
            </div>
            <dl>
              <div><dt>Aircraft</dt><dd>{aircraftName(selected.aircraft)}</dd></div>
              <div><dt>Altitude</dt><dd>{altitudeText(selected.aircraft)}</dd></div>
              <div><dt>Speed</dt><dd>{selected.aircraft.gs == null ? "—" : `${Math.round(selected.aircraft.gs)} kt`}</dd></div>
              <div><dt>Vertical</dt><dd>{movementText(selected.aircraft)}</dd></div>
            </dl>
          </>
        ) : (
          <div className="quiet-flight"><span>✦</span><h2>Airspace quiet</h2><p>The live sky remains on the ceiling.</p></div>
        )}
      </section>

      <section className="scene-section" aria-labelledby="scene-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Projection scene</p><h2 id="scene-heading">What should appear above?</h2></div>
          <span>{controls.acknowledgement?.message ?? (controls.connected ? "Private link ready" : "Reconnecting link")}</span>
        </div>
        <div className="scene-grid">
          {SCENES.map((item) => (
            <button
              key={item.scene}
              type="button"
              className={controls.scene === item.scene ? "active" : ""}
              disabled={item.scene === "follow" && !selected}
              aria-pressed={controls.scene === item.scene}
              onClick={() => void chooseScene(item.scene)}
            >
              <i aria-hidden="true">{item.icon}</i>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="nearby-section" aria-labelledby="nearby-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Live traffic</p><h2 id="nearby-heading">Nearby aircraft</h2></div>
          <span>{nearbyFlights.length} in view</span>
        </div>
        <div className="flight-list">
          {nearbyFlights.slice(0, 12).map((flight) => {
            const airline = airlineFromCallsign(flight.aircraft.flight);
            return (
              <button
                type="button"
                key={flight.aircraft.hex}
                className={selected?.aircraft.hex === flight.aircraft.hex ? "selected" : ""}
                onClick={() => void chooseAircraft(flight)}
              >
                <span className="flight-list-logo">{airline ? <AirlineLogo airline={airline} variant="icon" /> : directionArrow(flight.aircraft.track)}</span>
                <span className="flight-list-name"><strong>{flightName(flight.aircraft)}</strong><small>{aircraftName(flight.aircraft)}</small></span>
                <span className="flight-list-alt"><strong>{altitudeText(flight.aircraft)}</strong><small>{movementText(flight.aircraft).split(" ")[0]}</small></span>
                <span className="flight-list-distance"><strong>{flight.distanceKm.toFixed(1)}</strong><small>km</small></span>
                <span className="flight-list-arrow">{directionArrow(flight.aircraft.track)}</span>
              </button>
            );
          })}
          {!nearbyFlights.length && <div className="flight-list-empty">Flights will appear here when traffic enters the local view.</div>}
        </div>
      </section>

      <details className="device-settings">
        <summary><span><i>⚙</i><strong>Projector setup</strong></span><small>Private device-only calibration</small></summary>
        <div className="settings-body">
          <button type="button" className="primary-setting" onClick={usePhoneLocation}>Use this phone’s location</button>
          <p>Exact coordinates are encrypted in transit and stored only in the paired browsers.</p>
          <label>Ceiling rotation <output>{rotationDeg}°</output><input type="range" min="0" max="355" step="5" value={rotationDeg} onChange={(event) => setRotationDeg(Number(event.target.value))} /></label>
          <label className="toggle-setting"><span>Mirror horizontally</span><input type="checkbox" checked={mirrorX} onChange={(event) => setMirrorX(event.target.checked)} /></label>
          <label className="toggle-setting"><span>Mirror vertically</span><input type="checkbox" checked={mirrorY} onChange={(event) => setMirrorY(event.target.checked)} /></label>
          <button type="button" className="secondary-setting" onClick={saveOrientation}>Save ceiling orientation</button>
          {locationStatus && <p className="setting-status">{locationStatus}</p>}
          {installPrompt ? <button type="button" className="secondary-setting" onClick={() => void install()}>Install Brenton's Ceiling Controls</button> : <p className="install-note">On iPhone, use Share → Add to Home Screen to install these controls.</p>}
          <button type="button" className="danger-setting" onClick={() => void controls.resetPairing()}>Reset private pairing</button>
        </div>
      </details>

      {controls.error && <div className="controls-error">{controls.error}</div>}
      <footer>Brenton's Flight Deck · private ceiling link</footer>
    </main>
  );
}
