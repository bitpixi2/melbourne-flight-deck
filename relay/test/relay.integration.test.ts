import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COMPANION_PROTOCOL,
  openCompanionEnvelope,
  randomBase64Url,
  sealCompanionPayload,
  sha256Base64Url,
} from "../../shared/src/companion.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELAY_DIR = resolve(HERE, "..");
const PORT = 8799;
const HTTP_URL = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}`;
const ORIGIN = "http://localhost:4173";

interface SocketHarness {
  socket: WebSocket;
  messages: unknown[];
}

async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`${HTTP_URL}/health`);
      if (response.ok) return;
    } catch {
      /* worker is still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("local relay did not start");
}

async function openSocket(sessionId: string, role: "controller" | "projector", token: string): Promise<SocketHarness> {
  const socket = new WebSocket(`${WS_URL}/v1/sessions/${sessionId}/socket`, [
    COMPANION_PROTOCOL,
    `role.${role}`,
    `token.${token}`,
  ], { origin: ORIGIN });
  const messages: unknown[] = [];
  socket.on("message", (data) => {
    try { messages.push(JSON.parse(data.toString())); } catch { /* test ignores malformed data */ }
  });
  await new Promise<void>((resolveOpen, reject) => {
    socket.once("open", () => resolveOpen());
    socket.once("error", reject);
  });
  return { socket, messages };
}

async function waitForMessage(harness: SocketHarness, predicate: (message: any) => boolean): Promise<any> {
  for (let attempt = 0; attempt < 80; attempt++) {
    const index = harness.messages.findIndex(predicate);
    if (index >= 0) return harness.messages.splice(index, 1)[0];
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("expected relay message did not arrive");
}

describe("paired controller and projector relay", () => {
  let worker: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    worker = spawn("corepack", ["pnpm", "exec", "wrangler", "dev", "--port", String(PORT), "--local", "--persist-to", ".wrangler-test"], {
      cwd: RELAY_DIR,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: "pipe",
    });
    await waitForHealth();
  }, 30_000);

  afterAll(() => {
    worker?.kill("SIGTERM");
  });

  it("persists an encrypted scene, delivers it to the projector, returns an acknowledgement, and revokes", async () => {
    const sessionId = randomBase64Url(18);
    const projectorToken = randomBase64Url(32);
    const controllerToken = randomBase64Url(32);
    const key = randomBase64Url(32);
    const create = await fetch(`${HTTP_URL}/v1/pairs`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        projectorTokenHash: await sha256Base64Url(projectorToken),
        controllerTokenHash: await sha256Base64Url(controllerToken),
        expiresAt: Date.now() + 10 * 60 * 1000,
      }),
    });
    expect(create.status).toBe(201);

    const projector = await openSocket(sessionId, "projector", projectorToken);
    const controller = await openSocket(sessionId, "controller", controllerToken);
    await waitForMessage(controller, (message) => message.type === "presence" && message.projector && message.controller);

    const command = { type: "scene" as const, scene: "follow" as const, selectedHex: "7c6b2a", revision: 10, sentAt: Date.now() };
    controller.socket.send(JSON.stringify(await sealCompanionPayload(key, command, true)));
    const received = await waitForMessage(projector, (message) => message.kind === "sealed");
    await expect(openCompanionEnvelope(key, received)).resolves.toEqual(command);

    const acknowledgement = { type: "ack" as const, revision: 10, scene: "follow" as const, selectedHex: "7c6b2a", appliedAt: Date.now() };
    projector.socket.send(JSON.stringify(await sealCompanionPayload(key, acknowledgement, false)));
    const returned = await waitForMessage(controller, (message) => message.kind === "sealed");
    await expect(openCompanionEnvelope(key, returned)).resolves.toEqual(acknowledgement);

    controller.socket.send(JSON.stringify({ type: "revoke" }));
    await waitForMessage(projector, (message) => message.type === "revoked");
    projector.socket.close();
    controller.socket.close();
  }, 20_000);
});
