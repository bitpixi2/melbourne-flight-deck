import { useCallback, useEffect, useRef, useState } from "react";
import {
  PAIRING_TTL_MS,
  buildControllerPairUrl,
  isNewerRevision,
  nextCompanionRevision,
  parseControllerPairFragment,
  randomBase64Url,
  sha256Base64Url,
  type CalibrationCommand,
  type CompanionCredentials,
  type CompanionPayload,
  type CompanionScene,
  type ProjectorAck,
  type SceneCommand,
} from "@shared/index.js";
import { CompanionClient, type CompanionConnectionState } from "./client.js";
import {
  STORAGE_KEYS,
  clearCompanionStorage,
  deleteDeviceValue,
  readDeviceValue,
  readStoredCredentials,
  writeDeviceValue,
  type DeviceCalibration,
  type StoredScene,
} from "./storage.js";

const EMPTY_CONNECTION: CompanionConnectionState = {
  connected: false,
  projector: false,
  controller: false,
  claimed: false,
  revoked: false,
  error: null,
};

const DEFAULT_SCENE: StoredScene = { scene: "auto", revision: 0 };

interface LiveCompanion {
  connection: CompanionConnectionState;
  latestPayload: CompanionPayload | null;
  send: (payload: CompanionPayload, persist: boolean) => Promise<boolean>;
  revoke: () => void;
}

function relayUrl(): string {
  const configured = String(import.meta.env.VITE_COMPANION_RELAY_URL ?? "").trim();
  return configured || (import.meta.env.DEV ? "http://localhost:8787" : "");
}

function appUrl(): string {
  const configured = String(import.meta.env.VITE_COMPANION_APP_URL ?? "").trim();
  return configured || (import.meta.env.DEV ? "http://localhost:5173" : "https://brentons-ceiling-controls.vercel.app");
}

function useLiveCompanion(credentials: CompanionCredentials | null): LiveCompanion {
  const clientRef = useRef<CompanionClient | null>(null);
  const [connection, setConnection] = useState(EMPTY_CONNECTION);
  const [latestPayload, setLatestPayload] = useState<CompanionPayload | null>(null);

  useEffect(() => {
    if (!credentials) {
      setConnection(EMPTY_CONNECTION);
      clientRef.current = null;
      return;
    }
    const client = new CompanionClient(credentials);
    clientRef.current = client;
    const offState = client.subscribeState(setConnection);
    const offPayload = client.subscribePayload(setLatestPayload);
    client.start();
    return () => {
      offState();
      offPayload();
      client.stop();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [credentials]);

  const send = useCallback(
    (payload: CompanionPayload, persist: boolean) => clientRef.current?.send(payload, persist) ?? Promise.resolve(false),
    [],
  );
  const revoke = useCallback(() => clientRef.current?.revoke(), []);
  return { connection, latestPayload, send, revoke };
}

interface ProjectorBootstrap {
  credentials: CompanionCredentials;
  pairUrl: string | null;
  scene: StoredScene;
  calibration: DeviceCalibration | null;
}

let projectorBootstrapPromise: Promise<ProjectorBootstrap> | null = null;

async function createProjectorPairing(): Promise<{ credentials: CompanionCredentials; pairUrl: string }> {
  const relay = relayUrl();
  if (!relay) throw new Error("Ceiling relay is not configured");
  const createdAt = Date.now();
  const sessionId = randomBase64Url(18);
  const projectorToken = randomBase64Url(32);
  const controllerToken = randomBase64Url(32);
  const keyMaterial = randomBase64Url(32);
  const response = await fetch(`${relay.replace(/\/$/, "")}/v1/pairs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      projectorTokenHash: await sha256Base64Url(projectorToken),
      controllerTokenHash: await sha256Base64Url(controllerToken),
      expiresAt: createdAt + PAIRING_TTL_MS,
    }),
  });
  if (!response.ok) throw new Error("Private pairing service is unavailable");

  const credentials: CompanionCredentials = {
    version: 1,
    sessionId,
    role: "projector",
    token: projectorToken,
    keyMaterial,
    relayUrl: relay,
    createdAt,
  };
  const pairUrl = buildControllerPairUrl(appUrl(), {
    ...credentials,
    role: "controller",
    token: controllerToken,
  });
  await Promise.all([
    writeDeviceValue(STORAGE_KEYS.credentials, credentials),
    writeDeviceValue(STORAGE_KEYS.pendingPairUrl, pairUrl),
  ]);
  return { credentials, pairUrl };
}

async function bootstrapProjector(): Promise<ProjectorBootstrap> {
  if (new URLSearchParams(location.search).get("pair") === "reset") {
    await clearCompanionStorage();
    const url = new URL(location.href);
    url.searchParams.delete("pair");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  let credentials = await readStoredCredentials();
  let pairUrl = await readDeviceValue<string>(STORAGE_KEYS.pendingPairUrl);
  // A pairing QR expires until it is claimed. Once claimed, pendingPairUrl is
  // removed and the same device credentials remain valid for reconnects.
  if (credentials?.role !== "projector" || (pairUrl && Date.now() - credentials.createdAt > PAIRING_TTL_MS)) {
    await clearCompanionStorage();
    credentials = null;
    pairUrl = null;
  }
  if (!credentials) {
    const created = await createProjectorPairing();
    credentials = created.credentials;
    pairUrl = created.pairUrl;
  }
  const scene = await readDeviceValue<StoredScene>(STORAGE_KEYS.scene) ?? DEFAULT_SCENE;
  const calibration = await readDeviceValue<DeviceCalibration>(STORAGE_KEYS.calibration);
  return { credentials, pairUrl, scene, calibration };
}

export interface ProjectorCompanionState {
  scene: CompanionScene;
  selectedHex?: string;
  revision: number;
  calibration: DeviceCalibration | null;
  pairUrl: string | null;
  connected: boolean;
  controllerConnected: boolean;
  claimed: boolean;
  error: string | null;
  fallbackToOverhead: (message: string) => void;
}

export function useProjectorCompanion(enabled: boolean): ProjectorCompanionState {
  const [credentials, setCredentials] = useState<CompanionCredentials | null>(null);
  const [pairUrl, setPairUrl] = useState<string | null>(null);
  const [scene, setScene] = useState<StoredScene>(DEFAULT_SCENE);
  const [calibration, setCalibration] = useState<DeviceCalibration | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const live = useLiveCompanion(credentials);

  useEffect(() => {
    if (!enabled) return;
    projectorBootstrapPromise ??= bootstrapProjector();
    let active = true;
    void projectorBootstrapPromise.then((result) => {
      if (!active) return;
      setCredentials(result.credentials);
      setPairUrl(result.pairUrl);
      setScene(result.scene);
      setCalibration(result.calibration);
    }).catch((error: unknown) => {
      if (active) setSetupError(error instanceof Error ? error.message : "Ceiling controls unavailable");
    });
    return () => { active = false; };
  }, [enabled]);

  useEffect(() => {
    if (!live.connection.claimed) return;
    setPairUrl(null);
    void deleteDeviceValue(STORAGE_KEYS.pendingPairUrl);
  }, [live.connection.claimed]);

  useEffect(() => {
    if (!live.connection.revoked || !enabled) return;
    void clearCompanionStorage().then(() => location.reload());
  }, [enabled, live.connection.revoked]);

  useEffect(() => {
    const payload = live.latestPayload;
    if (!payload) return;
    if (payload.type === "scene" && isNewerRevision(payload.revision, sceneRef.current.revision)) {
      const next: StoredScene = {
        scene: payload.scene,
        selectedHex: payload.selectedHex,
        revision: payload.revision,
      };
      setScene(next);
      void writeDeviceValue(STORAGE_KEYS.scene, next);
      const ack: ProjectorAck = {
        type: "ack",
        revision: payload.revision,
        scene: payload.scene,
        selectedHex: payload.selectedHex,
        appliedAt: Date.now(),
      };
      void live.send(ack, false);
    } else if (payload.type === "calibration" && (!calibration || isNewerRevision(payload.revision, calibration.revision))) {
      const next: DeviceCalibration = {
        lat: payload.lat,
        lon: payload.lon,
        rotationDeg: payload.rotationDeg,
        mirrorX: payload.mirrorX,
        mirrorY: payload.mirrorY,
        revision: payload.revision,
      };
      setCalibration(next);
      void writeDeviceValue(STORAGE_KEYS.calibration, next);
      const current = sceneRef.current;
      void live.send({
        type: "ack",
        revision: payload.revision,
        scene: current.scene,
        selectedHex: current.selectedHex,
        appliedAt: Date.now(),
        message: "Ceiling calibration updated",
      }, false);
    }
  }, [calibration, live.latestPayload, live.send]);

  const fallbackToOverhead = useCallback((message: string) => {
    const current = sceneRef.current;
    if (current.scene !== "follow") return;
    const next: StoredScene = { scene: "overhead", revision: current.revision };
    setScene(next);
    void writeDeviceValue(STORAGE_KEYS.scene, next);
    void live.send({
      type: "ack",
      revision: current.revision,
      scene: "overhead",
      appliedAt: Date.now(),
      message,
    }, false);
  }, [live.send]);

  return {
    scene: scene.scene,
    selectedHex: scene.selectedHex,
    revision: scene.revision,
    calibration,
    pairUrl: live.connection.claimed ? null : pairUrl,
    connected: live.connection.connected,
    controllerConnected: live.connection.controller,
    claimed: live.connection.claimed,
    error: setupError ?? live.connection.error,
    fallbackToOverhead,
  };
}

interface ControllerBootstrap {
  credentials: CompanionCredentials | null;
  scene: StoredScene;
  calibration: DeviceCalibration | null;
}

async function bootstrapController(): Promise<ControllerBootstrap> {
  const fromFragment = parseControllerPairFragment(location.hash);
  if (fromFragment) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    await writeDeviceValue(STORAGE_KEYS.credentials, fromFragment);
  }
  const stored = fromFragment ?? await readStoredCredentials();
  const credentials = stored?.role === "controller" ? stored : null;
  const scene = await readDeviceValue<StoredScene>(STORAGE_KEYS.scene) ?? DEFAULT_SCENE;
  const calibration = await readDeviceValue<DeviceCalibration>(STORAGE_KEYS.calibration);
  return { credentials, scene, calibration };
}

export interface ControllerCompanionState {
  ready: boolean;
  paired: boolean;
  connected: boolean;
  projectorConnected: boolean;
  scene: CompanionScene;
  selectedHex?: string;
  calibration: DeviceCalibration | null;
  acknowledgement: ProjectorAck | null;
  error: string | null;
  sendScene: (scene: CompanionScene, selectedHex?: string) => Promise<boolean>;
  sendCalibration: (calibration: Omit<DeviceCalibration, "revision">) => Promise<boolean>;
  resetPairing: () => Promise<void>;
}

export function useControllerCompanion(): ControllerCompanionState {
  const [ready, setReady] = useState(false);
  const [credentials, setCredentials] = useState<CompanionCredentials | null>(null);
  const [scene, setScene] = useState<StoredScene>(DEFAULT_SCENE);
  const [calibration, setCalibration] = useState<DeviceCalibration | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<ProjectorAck | null>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const live = useLiveCompanion(credentials);

  useEffect(() => {
    let active = true;
    void bootstrapController().then((result) => {
      if (!active) return;
      setCredentials(result.credentials);
      setScene(result.scene);
      setCalibration(result.calibration);
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const payload = live.latestPayload;
    if (payload?.type !== "ack") return;
    setAcknowledgement(payload);
    if (payload.revision >= sceneRef.current.revision) {
      const next: StoredScene = {
        scene: payload.scene,
        selectedHex: payload.selectedHex,
        revision: payload.revision,
      };
      setScene(next);
      void writeDeviceValue(STORAGE_KEYS.scene, next);
    }
  }, [live.latestPayload]);

  useEffect(() => {
    if (!live.connection.revoked) return;
    void clearCompanionStorage().then(() => {
      setCredentials(null);
      setScene(DEFAULT_SCENE);
      setCalibration(null);
    });
  }, [live.connection.revoked]);

  const sendScene = useCallback(async (requested: CompanionScene, selectedHex?: string) => {
    if (requested === "follow" && !selectedHex) return false;
    const revision = nextCompanionRevision(sceneRef.current.revision);
    const command: SceneCommand = {
      type: "scene",
      scene: requested,
      selectedHex: requested === "follow" ? selectedHex : undefined,
      revision,
      sentAt: Date.now(),
    };
    const next: StoredScene = { scene: requested, selectedHex: command.selectedHex, revision };
    setScene(next);
    sceneRef.current = next;
    await writeDeviceValue(STORAGE_KEYS.scene, next);
    return live.send(command, true);
  }, [live.send]);

  const sendCalibration = useCallback(async (requested: Omit<DeviceCalibration, "revision">) => {
    const revision = nextCompanionRevision(Math.max(sceneRef.current.revision, calibration?.revision ?? 0));
    const command: CalibrationCommand = {
      type: "calibration",
      ...requested,
      revision,
      sentAt: Date.now(),
    };
    const next: DeviceCalibration = { ...requested, revision };
    setCalibration(next);
    await writeDeviceValue(STORAGE_KEYS.calibration, next);
    return live.send(command, false);
  }, [calibration?.revision, live.send]);

  const resetPairing = useCallback(async () => {
    live.revoke();
    await new Promise((resolve) => setTimeout(resolve, 120));
    await clearCompanionStorage();
    setCredentials(null);
    setScene(DEFAULT_SCENE);
    setCalibration(null);
    setAcknowledgement(null);
  }, [live.revoke]);

  return {
    ready,
    paired: Boolean(credentials),
    connected: live.connection.connected,
    projectorConnected: live.connection.projector,
    scene: scene.scene,
    selectedHex: scene.selectedHex,
    calibration,
    acknowledgement,
    error: live.connection.error,
    sendScene,
    sendCalibration,
    resetPairing,
  };
}
