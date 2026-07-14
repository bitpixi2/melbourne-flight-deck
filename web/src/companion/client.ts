import {
  COMPANION_PROTOCOL,
  isCompanionPayload,
  isSealedEnvelope,
  openCompanionEnvelope,
  sealCompanionPayload,
  type CompanionCredentials,
  type CompanionPayload,
  type RelayPlainMessage,
} from "@shared/index.js";

export interface CompanionConnectionState {
  connected: boolean;
  projector: boolean;
  controller: boolean;
  claimed: boolean;
  revoked: boolean;
  error: string | null;
}

type StateListener = (state: CompanionConnectionState) => void;
type PayloadListener = (payload: CompanionPayload) => void;

const INITIAL_STATE: CompanionConnectionState = {
  connected: false,
  projector: false,
  controller: false,
  claimed: false,
  revoked: false,
  error: null,
};

export class CompanionClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 700;
  private stopped = false;
  private state = { ...INITIAL_STATE };
  private stateListeners = new Set<StateListener>();
  private payloadListeners = new Set<PayloadListener>();
  private seenEnvelopes = new Set<string>();

  constructor(private readonly credentials: CompanionCredentials) {}

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  subscribePayload(listener: PayloadListener): () => void {
    this.payloadListeners.add(listener);
    return () => this.payloadListeners.delete(listener);
  }

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, "client stopped");
    this.socket = null;
  }

  async send(payload: CompanionPayload, persist: boolean): Promise<boolean> {
    if (!isCompanionPayload(payload) || this.socket?.readyState !== WebSocket.OPEN) return false;
    const envelope = await sealCompanionPayload(this.credentials.keyMaterial, payload, persist);
    this.socket.send(JSON.stringify(envelope));
    return true;
  }

  revoke(): void {
    if (this.credentials.role !== "controller") return;
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "revoke" }));
  }

  private open(): void {
    if (this.stopped) return;
    const relay = new URL(this.credentials.relayUrl);
    relay.protocol = relay.protocol === "https:" ? "wss:" : "ws:";
    relay.pathname = `/v1/sessions/${this.credentials.sessionId}/socket`;
    relay.search = "";
    relay.hash = "";
    try {
      this.socket = new WebSocket(relay, [
        COMPANION_PROTOCOL,
        `role.${this.credentials.role}`,
        `token.${this.credentials.token}`,
      ]);
    } catch {
      this.update({ connected: false, error: "Unable to open the private ceiling link" });
      return this.scheduleReconnect();
    }
    this.socket.onopen = () => {
      this.reconnectDelay = 700;
      this.update({ connected: true, error: null });
    };
    this.socket.onmessage = (event) => void this.onMessage(String(event.data));
    this.socket.onerror = () => this.update({ error: "Private ceiling link interrupted" });
    this.socket.onclose = (event) => {
      this.socket = null;
      this.update({ connected: false });
      if (event.code === 4002) this.update({ revoked: true });
      if (!this.stopped && event.code !== 4002) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.7, 10_000);
  }

  private async onMessage(raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (isSealedEnvelope(parsed)) {
      if (this.seenEnvelopes.has(parsed.id)) return;
      this.seenEnvelopes.add(parsed.id);
      if (this.seenEnvelopes.size > 200) {
        const first = this.seenEnvelopes.values().next().value as string | undefined;
        if (first) this.seenEnvelopes.delete(first);
      }
      try {
        const payload = await openCompanionEnvelope(this.credentials.keyMaterial, parsed);
        for (const listener of this.payloadListeners) listener(payload);
      } catch {
        this.update({ error: "A ceiling command could not be verified" });
      }
      return;
    }
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return;
    const message = parsed as RelayPlainMessage;
    if (message.type === "ready") {
      this.update({ connected: true, claimed: message.claimed });
    } else if (message.type === "presence") {
      this.update({
        projector: message.projector,
        controller: message.controller,
        claimed: message.claimed,
      });
    } else if (message.type === "revoked") {
      this.update({ revoked: true, connected: false });
    }
  }

  private update(patch: Partial<CompanionConnectionState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.stateListeners) listener(this.state);
  }
}
