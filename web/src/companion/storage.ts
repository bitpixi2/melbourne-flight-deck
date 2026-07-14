import type { CompanionCredentials, CompanionScene } from "@shared/index.js";

const DB_NAME = "brentons-ceiling-controls";
const STORE_NAME = "device";
const FALLBACK_PREFIX = "brentons-ceiling-controls:";

export const STORAGE_KEYS = {
  credentials: "credentials",
  pendingPairUrl: "pending-pair-url",
  calibration: "calibration",
  scene: "scene",
} as const;

export interface DeviceCalibration {
  lat: number;
  lon: number;
  rotationDeg: number;
  mirrorX: boolean;
  mirrorY: boolean;
  revision: number;
}

export interface StoredScene {
  scene: CompanionScene;
  selectedHex?: string;
  revision: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open companion storage"));
  });
}

function fallbackGet<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(`${FALLBACK_PREFIX}${key}`);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function fallbackSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${FALLBACK_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    /* Storage is optional; the live session still works. */
  }
}

export async function readDeviceValue<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return fallbackGet<T>(key);
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return fallbackGet<T>(key);
  }
}

export async function writeDeviceValue<T>(key: string, value: T): Promise<void> {
  fallbackSet(key, value);
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    /* localStorage fallback already has the value */
  }
}

export async function deleteDeviceValue(key: string): Promise<void> {
  try {
    localStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
  } catch {
    /* noop */
  }
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    /* noop */
  }
}

export async function clearCompanionStorage(): Promise<void> {
  await Promise.all(Object.values(STORAGE_KEYS).map((key) => deleteDeviceValue(key)));
}

export function readStoredCredentials(): Promise<CompanionCredentials | null> {
  return readDeviceValue<CompanionCredentials>(STORAGE_KEYS.credentials);
}
