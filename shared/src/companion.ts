/** Encrypted phone-to-projector protocol for Brenton's Ceiling Controls. */

export const COMPANION_PROTOCOL = "brenton-ceiling-v1";
export const PAIRING_TTL_MS = 10 * 60 * 1000;

export type CompanionRole = "projector" | "controller";
export type CompanionScene = "auto" | "overhead" | "runway" | "follow";

export interface SceneCommand {
  type: "scene";
  scene: CompanionScene;
  selectedHex?: string;
  revision: number;
  sentAt: number;
}

export interface CalibrationCommand {
  type: "calibration";
  lat: number;
  lon: number;
  rotationDeg: number;
  mirrorX: boolean;
  mirrorY: boolean;
  revision: number;
  sentAt: number;
}

export interface ProjectorAck {
  type: "ack";
  revision: number;
  scene: CompanionScene;
  selectedHex?: string;
  appliedAt: number;
  message?: string;
}

export type CompanionPayload = SceneCommand | CalibrationCommand | ProjectorAck;

export interface SealedEnvelope {
  v: 1;
  kind: "sealed";
  id: string;
  iv: string;
  ciphertext: string;
  persist: boolean;
}

export interface PairingInit {
  sessionId: string;
  projectorTokenHash: string;
  controllerTokenHash: string;
  expiresAt: number;
}

export interface CompanionCredentials {
  version: 1;
  sessionId: string;
  role: CompanionRole;
  token: string;
  keyMaterial: string;
  relayUrl: string;
  createdAt: number;
}

export interface RelayPresence {
  type: "presence";
  projector: boolean;
  controller: boolean;
  claimed: boolean;
}

export interface RelayReady {
  type: "ready";
  role: CompanionRole;
  claimed: boolean;
}

export interface RelayRevoked {
  type: "revoked";
}

export type RelayPlainMessage = RelayPresence | RelayReady | RelayRevoked;

const SCENES = new Set<CompanionScene>(["auto", "overhead", "runway", "follow"]);
const SESSION_RE = /^[A-Za-z0-9_-]{20,64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const ENVELOPE_ID_RE = /^[A-Za-z0-9_-]{20,64}$/;
const IV_RE = /^[A-Za-z0-9_-]{16,32}$/;
const HASH_RE = /^[A-Za-z0-9_-]{40,64}$/;
const HEX_RE = /^[0-9a-f]{6}$/i;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isCompanionScene(value: unknown): value is CompanionScene {
  return typeof value === "string" && SCENES.has(value as CompanionScene);
}

export function isPendingPairingExpired(expiresAt: number, claimedAt?: number, now = Date.now()): boolean {
  return !claimedAt && Number.isFinite(expiresAt) && expiresAt <= now;
}

export function isRelayRevocation(value: unknown): value is { type: "revoke" } {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === "revoke" &&
    Object.keys(value).length === 1,
  );
}

export function isPairingInit(value: unknown): value is PairingInit {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PairingInit>;
  return (
    typeof candidate.sessionId === "string" && SESSION_RE.test(candidate.sessionId) &&
    typeof candidate.projectorTokenHash === "string" && HASH_RE.test(candidate.projectorTokenHash) &&
    typeof candidate.controllerTokenHash === "string" && HASH_RE.test(candidate.controllerTokenHash) &&
    finite(candidate.expiresAt) &&
    candidate.expiresAt > Date.now() - 60_000 &&
    candidate.expiresAt < Date.now() + PAIRING_TTL_MS + 60_000
  );
}

export function isSealedEnvelope(value: unknown): value is SealedEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SealedEnvelope>;
  return (
    candidate.v === 1 &&
    candidate.kind === "sealed" &&
    typeof candidate.id === "string" && ENVELOPE_ID_RE.test(candidate.id) &&
    typeof candidate.iv === "string" && IV_RE.test(candidate.iv) &&
    typeof candidate.ciphertext === "string" && candidate.ciphertext.length > 8 && candidate.ciphertext.length < 32_768 &&
    typeof candidate.persist === "boolean"
  );
}

export function isCompanionPayload(value: unknown): value is CompanionPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CompanionPayload> & Record<string, unknown>;
  if (!finite(candidate.revision) || candidate.revision < 0) return false;
  if (candidate.type === "scene") {
    return (
      isCompanionScene(candidate.scene) &&
      finite(candidate.sentAt) &&
      (candidate.selectedHex == null || (typeof candidate.selectedHex === "string" && HEX_RE.test(candidate.selectedHex))) &&
      (candidate.scene !== "follow" || typeof candidate.selectedHex === "string")
    );
  }
  if (candidate.type === "calibration") {
    return (
      finite(candidate.lat) && candidate.lat >= -90 && candidate.lat <= 90 &&
      finite(candidate.lon) && candidate.lon >= -180 && candidate.lon <= 180 &&
      finite(candidate.rotationDeg) && candidate.rotationDeg >= 0 && candidate.rotationDeg < 360 &&
      typeof candidate.mirrorX === "boolean" &&
      typeof candidate.mirrorY === "boolean" &&
      finite(candidate.sentAt)
    );
  }
  if (candidate.type === "ack") {
    return (
      isCompanionScene(candidate.scene) &&
      finite(candidate.appliedAt) &&
      (candidate.selectedHex == null || (typeof candidate.selectedHex === "string" && HEX_RE.test(candidate.selectedHex))) &&
      (candidate.message == null || (typeof candidate.message === "string" && candidate.message.length <= 180))
    );
  }
  return false;
}

export function isNewerRevision(incoming: number, current: number): boolean {
  return Number.isSafeInteger(incoming) && incoming > current;
}

export function nextCompanionRevision(current: number, now = Date.now()): number {
  return Math.max(current + 1, now);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function ownedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function randomBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function importCompanionKey(keyMaterial: string) {
  const raw = ownedBytes(base64UrlToBytes(keyMaterial));
  if (raw.byteLength !== 32) throw new Error("Invalid companion encryption key");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function sealCompanionPayload(
  keyMaterial: string,
  payload: CompanionPayload,
  persist: boolean,
): Promise<SealedEnvelope> {
  if (!isCompanionPayload(payload)) throw new Error("Invalid companion payload");
  const key = await importCompanionKey(keyMaterial);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    v: 1,
    kind: "sealed",
    id: randomBase64Url(18),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    persist,
  };
}

export async function openCompanionEnvelope(
  keyMaterial: string,
  envelope: SealedEnvelope,
): Promise<CompanionPayload> {
  if (!isSealedEnvelope(envelope)) throw new Error("Invalid sealed companion envelope");
  const key = await importCompanionKey(keyMaterial);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ownedBytes(base64UrlToBytes(envelope.iv)) },
    key,
    ownedBytes(base64UrlToBytes(envelope.ciphertext)),
  );
  const payload: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (!isCompanionPayload(payload)) throw new Error("Invalid decrypted companion payload");
  return payload;
}

export function buildControllerPairUrl(appUrl: string, credentials: CompanionCredentials): string {
  if (credentials.role !== "controller") throw new Error("Controller credentials required");
  const url = new URL(appUrl);
  const fragment = new URLSearchParams({
    v: "1",
    session: credentials.sessionId,
    token: credentials.token,
    key: credentials.keyMaterial,
    relay: credentials.relayUrl,
    created: String(credentials.createdAt),
  });
  url.hash = fragment.toString();
  return url.toString();
}

export function parseControllerPairFragment(hash: string): CompanionCredentials | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const sessionId = params.get("session") ?? "";
  const token = params.get("token") ?? "";
  const keyMaterial = params.get("key") ?? "";
  const relayUrl = params.get("relay") ?? "";
  const createdAt = Number(params.get("created") ?? Date.now());
  if (params.get("v") !== "1" || !SESSION_RE.test(sessionId) || !TOKEN_RE.test(token)) return null;
  if (base64UrlToBytes(keyMaterial).byteLength !== 32 || !finite(createdAt)) return null;
  try {
    const relay = new URL(relayUrl);
    if (relay.protocol !== "https:" && relay.hostname !== "localhost" && relay.hostname !== "127.0.0.1") return null;
  } catch {
    return null;
  }
  return { version: 1, sessionId, role: "controller", token, keyMaterial, relayUrl, createdAt };
}
