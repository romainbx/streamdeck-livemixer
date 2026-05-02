import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import * as dgram from "node:dgram";
import { decodeOSC, encodeOSCBang, encodeOSCFloat } from "../osc.js";

type FxSettings = {
  trackNumber: number;
  fxList: string;
  reaperHost: string;
  reaperPort: number;
  listenPort: number;
};

let fxSocket: dgram.Socket | null = null;
let fxListenPort: number | null = null;
const states = new Map<string, boolean>();
const actions = new Map<string, any>();

function parsePort(value: unknown, fallback: number): number {
  const port = parseInt(String(value ?? fallback));
  return port >= 1 && port <= 65535 ? port : fallback;
}

function getFxSettings(raw: any): FxSettings {
  return {
    trackNumber: parseInt(raw?.trackNumber ?? "1") || 1,
    fxList: raw?.fxList ?? "1",
    reaperHost: String(raw?.reaperHost || "127.0.0.1"),
    reaperPort: parsePort(raw?.reaperPort, 8000),
    listenPort: parsePort(raw?.listenPort, 9003),
  };
}

function parseFxList(str: string): number[] {
  return (str ?? "1").split(/[,;\s]+/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n >= 1);
}

function initSocket(settings: FxSettings): void {
  if (fxSocket && fxListenPort === settings.listenPort) return;
  if (fxSocket) {
    try { fxSocket.close(); } catch {}
    fxSocket = null;
  }
  fxSocket = dgram.createSocket("udp4");
  fxListenPort = settings.listenPort;
  fxSocket.on("error", err => streamDeck.logger.error(`FX OSC socket error: ${err}`));
  fxSocket.bind(settings.listenPort, () => streamDeck.logger.info(`FX OSC on ${settings.listenPort}`));
  fxSocket.on("message", async (msg: Buffer) => {
    for (const osc of decodeOSC(msg)) {
      const m = osc.path.match(/^\/track\/(\d+)\/fx\/(\d+)\/bypass$/);
      if (!m) continue;
      const track = parseInt(m[1]);
      const fx = parseInt(m[2]);
      const active = osc.value < 0.5;
      for (const [ctx, act] of actions) {
        try {
          const s = getFxSettings(await act.getSettings());
          if (s.trackNumber !== track) continue;
          if (!parseFxList(s.fxList).includes(fx)) continue;
          states.set(ctx, active);
          await act.setState(active ? 0 : 1);
        } catch {}
      }
    }
  });
}

function send(msg: Buffer, settings: FxSettings): void {
  initSocket(settings);
  fxSocket?.send(msg, settings.reaperPort, settings.reaperHost);
}

@action({ UUID: "com.romain.live.fx-toggle" })
export class FxToggle extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    if (!ev.action.isKey()) return;
    const s = getFxSettings(ev.payload.settings);
    initSocket(s);
    const ctx = ev.action.id;
    actions.set(ctx, ev.action);
    states.set(ctx, true);
    for (const fx of parseFxList(s.fxList)) send(encodeOSCBang(`/track/${s.trackNumber}/fx/${fx}/bypass`), s);
    await ev.action.setState(0);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    actions.delete(ev.action.id);
    states.delete(ev.action.id);
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    if (!ev.action.isKey()) return;
    initSocket(getFxSettings(ev.payload.settings));
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const ctx = ev.action.id;
    const s = getFxSettings(ev.payload.settings);
    initSocket(s);
    const currentlyActive = states.get(ctx) ?? true;
    const newActive = !currentlyActive;
    states.set(ctx, newActive);
    await ev.action.setState(newActive ? 0 : 1);
    for (const fx of parseFxList(s.fxList)) {
      send(encodeOSCFloat(`/track/${s.trackNumber}/fx/${fx}/bypass`, newActive ? 0 : 1), s);
    }
  }
}
