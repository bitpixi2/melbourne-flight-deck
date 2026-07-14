import {
  COMPANION_PROTOCOL,
  isPendingPairingExpired,
  isPairingInit,
  isRelayRevocation,
  isSealedEnvelope,
  sha256Base64Url,
  type CompanionRole,
  type PairingInit,
  type RelayPresence,
} from "@shared/companion.js";

interface Env {
  PAIRING_ROOMS: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
}

interface SocketAttachment {
  role: CompanionRole;
}

interface StoredPair extends PairingInit {
  claimedAt?: number;
}

const SESSION_RE = /^[A-Za-z0-9_-]{20,64}$/;
const MAX_MESSAGE_BYTES = 32_768;

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean));
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

export function parseSocketProtocols(header: string | null): { role: CompanionRole; token: string } | null {
  const protocols = (header ?? "").split(",").map((part) => part.trim());
  if (!protocols.includes(COMPANION_PROTOCOL)) return null;
  const roleEntry = protocols.find((part) => part === "role.projector" || part === "role.controller");
  const tokenEntry = protocols.find((part) => part.startsWith("token."));
  if (!roleEntry || !tokenEntry || tokenEntry.length < 39) return null;
  return {
    role: roleEntry === "role.projector" ? "projector" : "controller",
    token: tokenEntry.slice("token.".length),
  };
}

export class PairingRoom {
  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/initialize") {
      return this.initialize(request);
    }
    if (request.method === "GET" && url.pathname === "/socket") {
      return this.connect(request);
    }
    return json({ error: "not found" }, 404);
  }

  private async initialize(request: Request): Promise<Response> {
    const body: unknown = await request.json().catch(() => null);
    if (!isPairingInit(body)) return json({ error: "invalid pairing request" }, 400);
    const existing = await this.ctx.storage.get<StoredPair>("pair");
    if (existing) return json({ error: "pairing already exists" }, 409);
    await this.ctx.storage.put("pair", body);
    await this.ctx.storage.setAlarm(body.expiresAt);
    return json({ ok: true }, 201);
  }

  private async connect(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "websocket upgrade required" }, 426);
    }
    const auth = parseSocketProtocols(request.headers.get("sec-websocket-protocol"));
    if (!auth) return json({ error: "invalid websocket credentials" }, 401);

    const pair = await this.ctx.storage.get<StoredPair>("pair");
    if (!pair) return json({ error: "pairing not found" }, 404);
    const expectedHash = auth.role === "projector" ? pair.projectorTokenHash : pair.controllerTokenHash;
    if ((await sha256Base64Url(auth.token)) !== expectedHash) {
      return json({ error: "invalid websocket credentials" }, 401);
    }

    if (auth.role === "controller" && !pair.claimedAt) {
      if (isPendingPairingExpired(pair.expiresAt, pair.claimedAt)) return json({ error: "pairing code expired" }, 410);
      pair.claimedAt = Date.now();
      await this.ctx.storage.put("pair", pair);
      await this.ctx.storage.deleteAlarm();
    }

    const sockets = new WebSocketPair();
    const client = sockets[0];
    const server = sockets[1];
    server.serializeAttachment({ role: auth.role } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server, [`role:${auth.role}`]);

    server.send(JSON.stringify({ type: "ready", role: auth.role, claimed: Boolean(pair.claimedAt) }));
    const latest = await this.ctx.storage.get<string>("latestCommand");
    if (latest && auth.role === "projector") server.send(latest);
    this.broadcastPresence(pair);

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "sec-websocket-protocol": COMPANION_PROTOCOL },
    } as ResponseInit & { webSocket: WebSocket });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) return socket.close(1008, "missing role");
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    if (raw.length > MAX_MESSAGE_BYTES) return socket.close(1009, "message too large");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return socket.close(1007, "invalid json");
    }

    if (attachment.role === "controller" && isRelayRevocation(parsed)) {
      await this.revoke();
      return;
    }
    if (!isSealedEnvelope(parsed)) return socket.close(1008, "invalid envelope");
    if (attachment.role === "projector" && parsed.persist) return socket.close(1008, "projector cannot persist commands");
    if (attachment.role === "controller" && parsed.persist) {
      await this.ctx.storage.put("latestCommand", raw);
    }
    const targetTag = attachment.role === "controller" ? "role:projector" : "role:controller";
    for (const target of this.ctx.getWebSockets(targetTag)) target.send(raw);
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    // The runtime invokes this after the socket has already closed. Calling
    // close() or send() on it again throws in workerd.
    void socket;
    void code;
    void reason;
    void wasClean;
    const pair = await this.ctx.storage.get<StoredPair>("pair");
    if (pair) this.broadcastPresence(pair);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    socket.close(1011, "relay error");
    const pair = await this.ctx.storage.get<StoredPair>("pair");
    if (pair) this.broadcastPresence(pair);
  }

  async alarm(): Promise<void> {
    const pair = await this.ctx.storage.get<StoredPair>("pair");
    if (pair && isPendingPairingExpired(pair.expiresAt, pair.claimedAt)) {
      await this.ctx.storage.deleteAll();
      for (const socket of this.ctx.getWebSockets()) socket.close(4001, "pairing expired");
    }
  }

  private broadcastPresence(pair: StoredPair): void {
    const openSockets = (tag: string) => this.ctx.getWebSockets(tag)
      .filter((socket) => socket.readyState === WebSocket.OPEN).length;
    const presence: RelayPresence = {
      type: "presence",
      projector: openSockets("role:projector") > 0,
      controller: openSockets("role:controller") > 0,
      claimed: Boolean(pair.claimedAt),
    };
    const raw = JSON.stringify(presence);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(raw);
    }
  }

  private async revoke(): Promise<void> {
    const raw = JSON.stringify({ type: "revoked" });
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(raw);
      socket.close(4002, "pairing revoked");
    }
    await this.ctx.storage.deleteAll();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") ?? "";
    const originAllowed = allowedOrigins(env).has(origin);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "brentons-ceiling-relay" });
    }
    if (!originAllowed) return json({ error: "origin not allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

    if (request.method === "POST" && url.pathname === "/v1/pairs") {
      const body: unknown = await request.json().catch(() => null);
      if (!isPairingInit(body)) return json({ error: "invalid pairing request" }, 400, corsHeaders(origin));
      const id = env.PAIRING_ROOMS.idFromName(body.sessionId);
      const response = await env.PAIRING_ROOMS.get(id).fetch("https://room/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
      return new Response(response.body, { status: response.status, headers });
    }

    const match = /^\/v1\/sessions\/([A-Za-z0-9_-]{20,64})\/socket$/.exec(url.pathname);
    if (request.method === "GET" && match && SESSION_RE.test(match[1])) {
      const id = env.PAIRING_ROOMS.idFromName(match[1]);
      return env.PAIRING_ROOMS.get(id).fetch("https://room/socket", {
        method: "GET",
        headers: request.headers,
      });
    }
    return json({ error: "not found" }, 404, corsHeaders(origin));
  },
};
