import { describe, expect, it } from "vitest";
import {
  buildControllerPairUrl,
  isCompanionPayload,
  isNewerRevision,
  isPendingPairingExpired,
  isRelayRevocation,
  nextCompanionRevision,
  openCompanionEnvelope,
  parseControllerPairFragment,
  randomBase64Url,
  sealCompanionPayload,
  type CompanionCredentials,
} from "../src/companion.js";

describe("ceiling companion protocol", () => {
  it("encrypts calibration without exposing coordinates in the relay envelope", async () => {
    const key = randomBase64Url(32);
    const payload = {
      type: "calibration" as const,
      lat: -37.4587123,
      lon: 144.6776123,
      rotationDeg: 45,
      mirrorX: true,
      mirrorY: false,
      revision: 100,
      sentAt: 200,
    };
    const envelope = await sealCompanionPayload(key, payload, false);
    expect(JSON.stringify(envelope)).not.toContain(String(payload.lat));
    expect(JSON.stringify(envelope)).not.toContain(String(payload.lon));
    await expect(openCompanionEnvelope(key, envelope)).resolves.toEqual(payload);
  });

  it("rejects follow commands without an aircraft and accepts verified hex IDs", () => {
    expect(isCompanionPayload({ type: "scene", scene: "follow", revision: 1, sentAt: 1 })).toBe(false);
    expect(isCompanionPayload({
      type: "scene",
      scene: "follow",
      selectedHex: "7c6b2a",
      revision: 2,
      sentAt: 2,
    })).toBe(true);
  });

  it("round-trips pairing secrets through a URL fragment", () => {
    const credentials: CompanionCredentials = {
      version: 1,
      sessionId: randomBase64Url(18),
      role: "controller",
      token: randomBase64Url(32),
      keyMaterial: randomBase64Url(32),
      relayUrl: "https://relay.example.workers.dev",
      createdAt: 1234,
    };
    const url = buildControllerPairUrl("https://brentons-ceiling-controls.vercel.app", credentials);
    expect(new URL(url).pathname).toBe("/");
    expect(new URL(url).search).toBe("");
    expect(parseControllerPairFragment(new URL(url).hash)).toEqual(credentials);
  });

  it("orders reconnect-safe revisions monotonically", () => {
    expect(isNewerRevision(20, 19)).toBe(true);
    expect(isNewerRevision(20, 20)).toBe(false);
    expect(nextCompanionRevision(25, 20)).toBe(26);
  });

  it("expires only unclaimed pairing codes", () => {
    expect(isPendingPairingExpired(999, undefined, 1000)).toBe(true);
    expect(isPendingPairingExpired(999, 500, 1000)).toBe(false);
    expect(isPendingPairingExpired(1001, undefined, 1000)).toBe(false);
  });

  it("accepts only the explicit controller revocation message", () => {
    expect(isRelayRevocation({ type: "revoke" })).toBe(true);
    expect(isRelayRevocation({ type: "revoked" })).toBe(false);
    expect(isRelayRevocation({ type: "revoke", coordinates: [-37, 144] })).toBe(false);
  });
});
