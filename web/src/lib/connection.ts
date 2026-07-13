// Shared browser connection: WebSocket locally, HTTP polling when hosted.

import {
  DEFAULT_CONFIG,
  NM_PER_MILE,
  type Aircraft,
  type ClientMessage,
  type Config,
  type ServerMessage,
  type SourceStatus,
} from "@shared/index.js";

interface HostedSnapshot {
  now: number;
  aircraft?: Aircraft[];
  nearbyAircraft?: Aircraft[];
  nearbyRadiusNm?: number;
  status: SourceStatus;
}

export interface StreamState {
  connected: boolean;
  hosted: boolean;
  config: Config | null;
  now: number;
  aircraft: Aircraft[];
  nearbyAircraft: Aircraft[];
  nearbyRadiusNm: number;
  status: SourceStatus | null;
}

type Listener = (state: StreamState) => void;

export class Connection {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private hostedPollTimer: ReturnType<typeof setInterval> | null = null;
  private usingHostedPolling = false;
  private closed = false;

  state: StreamState = {
    connected: false,
    hosted: false,
    config: null,
    now: 0,
    aircraft: [],
    nearbyAircraft: [],
    nearbyRadiusNm: DEFAULT_CONFIG.radiusMiles * NM_PER_MILE,
    status: null,
  };

  constructor(private role: "display" | "control") {}

  connect(): void {
    this.closed = false;
    this.open();
  }

  private url(): string {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/ws`;
  }

  private open(): void {
    try {
      this.ws = new WebSocket(this.url());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.stopHostedPolling();
      this.send({ type: "hello", role: this.role });
      this.update({ connected: true, hosted: false });
    };
    this.ws.onclose = () => {
      this.update({ connected: false });
      this.startHostedPolling();
      this.scheduleReconnect();
    };
    this.ws.onerror = () => this.ws?.close();
    this.ws.onmessage = (ev) => this.onMessage(ev.data as string);
  }

  private scheduleReconnect(): void {
    if (this.closed || this.usingHostedPolling || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closed && !this.usingHostedPolling) this.open();
    }, 1500);
  }

  private startHostedPolling(): void {
    if (this.closed || this.hostedPollTimer) return;
    void this.pollHostedSnapshot();
    this.hostedPollTimer = setInterval(() => void this.pollHostedSnapshot(), 3000);
  }

  private stopHostedPolling(): void {
    if (this.hostedPollTimer) clearInterval(this.hostedPollTimer);
    this.hostedPollTimer = null;
    this.usingHostedPolling = false;
  }

  private async pollHostedSnapshot(): Promise<void> {
    try {
      const response = await fetch("/api/live");
      const snapshot = (await response.json()) as HostedSnapshot;
      if (!response.ok) {
        this.update({ connected: true, hosted: true, config: DEFAULT_CONFIG, status: snapshot.status });
        return;
      }
      this.usingHostedPolling = true;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.update({
        connected: true,
        hosted: true,
        config: DEFAULT_CONFIG,
        now: snapshot.now,
        aircraft: snapshot.aircraft ?? [],
        nearbyAircraft: snapshot.nearbyAircraft ?? snapshot.aircraft ?? [],
        nearbyRadiusNm: snapshot.nearbyRadiusNm ?? DEFAULT_CONFIG.radiusMiles * NM_PER_MILE,
        status: snapshot.status,
      });
    } catch {
      // Keep trying both the hosted endpoint and the appliance WebSocket.
    }
  }

  private onMessage(raw: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "config":
        this.update({
          config: msg.config,
          nearbyRadiusNm: this.usingHostedPolling
            ? this.state.nearbyRadiusNm
            : msg.config.radiusMiles * NM_PER_MILE,
        });
        break;
      case "aircraft":
        this.update({ now: msg.now, aircraft: msg.aircraft, nearbyAircraft: msg.aircraft });
        break;
      case "status":
        this.update({ status: msg.status });
        break;
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  patchConfig(patch: Partial<Config>): void {
    this.send({ type: "patchConfig", patch });
  }
  resetConfig(): void {
    this.send({ type: "resetConfig" });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private update(partial: Partial<StreamState>): void {
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) fn(this.state);
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHostedPolling();
    this.ws?.close();
  }
}
