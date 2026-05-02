import streamDeck, { action, SingletonAction, DialDownEvent, DialRotateEvent, TouchTapEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { VM, vmInit } from "../voicemeeter.js";
import { clampPct, dbToPct, indicatorSVG, pctToDb, pctToLevel, smoothVu, vuSVG } from "../dial-base.js";
import { OFF_ICON } from "../icons.js";
import { gainParam, getVmSettings, level, muteParam, VmSettings } from "../vm-settings.js";

type DialState = {
  action: any;
  settings: VmSettings;
  currentPct: number;
  currentVU: number;
  isMuted: boolean;
  isAdjusting: boolean;
  adjustTimer: ReturnType<typeof setTimeout> | null;
  lastVUTimestamp: number;
  vuInterval: ReturnType<typeof setInterval> | null;
};

const states = new Map<string, DialState>();

async function render(st: DialState): Promise<void> {
  const knobLevel = pctToLevel(st.currentPct);
  await st.action.setFeedback({
    title: st.settings.label,
    value: st.isMuted ? "" : String(st.currentPct),
    unit: st.isMuted ? "" : "%",
    levelmeter: vuSVG(st.currentVU, knobLevel, st.isAdjusting, st.isMuted),
    mainIndicator: indicatorSVG(knobLevel),
    muteOverlay: { enabled: st.isMuted },
    micMutedIcon: { value: OFF_ICON, enabled: st.isMuted },
    icon: { value: st.settings.icon },
  });
}

async function renderVU(st: DialState): Promise<void> {
  const knobLevel = pctToLevel(st.currentPct);
  await st.action.setFeedback({
    levelmeter: vuSVG(st.currentVU, knobLevel, false, st.isMuted),
    mainIndicator: indicatorSVG(knobLevel),
  });
}

function syncFromVM(st: DialState): void {
  const db = VM.getGain(gainParam(st.settings));
  st.currentPct = dbToPct(db);
  st.isMuted = VM.getMute(muteParam(st.settings));
}

function startAdjusting(st: DialState): void {
  st.isAdjusting = true;
  if (st.adjustTimer) clearTimeout(st.adjustTimer);
  st.adjustTimer = setTimeout(() => {
    st.isAdjusting = false;
    st.adjustTimer = null;
    render(st);
  }, 1500);
}

function startVU(st: DialState): void {
  if (st.vuInterval) return;
  st.vuInterval = setInterval(async () => {
    if (!st.action || st.isAdjusting) return;
    const vu = level(st.settings);
    if (vu > 0.005) {
      st.lastVUTimestamp = Date.now();
    }
    st.currentVU = smoothVu(st.currentVU, Date.now() - st.lastVUTimestamp > 300 ? 0 : vu);
    await renderVU(st);
  }, 100);
}

function stopVU(st: DialState): void {
  if (st.vuInterval) clearInterval(st.vuInterval);
  if (st.adjustTimer) clearTimeout(st.adjustTimer);
}

@action({ UUID: "com.romain.live.vm-dial" })
export class GenericVmDial extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    if (!ev.action.isDial()) return;
    vmInit();
    const st: DialState = {
      action: ev.action,
      settings: getVmSettings(ev.payload.settings),
      currentPct: 80,
      currentVU: 0,
      isMuted: false,
      isAdjusting: false,
      adjustTimer: null,
      lastVUTimestamp: 0,
      vuInterval: null,
    };
    syncFromVM(st);
    states.set(ev.action.id, st);
    await ev.action.setFeedbackLayout("layouts/vu-meter.json");
    startVU(st);
    await render(st);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    const st = states.get(ev.action.id);
    if (!st) return;
    stopVU(st);
    states.delete(ev.action.id);
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    const st = states.get(ev.action.id);
    if (!st) return;
    st.settings = getVmSettings(ev.payload.settings);
    syncFromVM(st);
    await render(st);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    const st = states.get(ev.action.id);
    if (!st) return;
    st.settings = getVmSettings(ev.payload.settings);
    st.currentPct = clampPct(st.currentPct + ev.payload.ticks * st.settings.stepSize);
    startAdjusting(st);
    VM.setGain(gainParam(st.settings), pctToDb(st.currentPct));
    await render(st);
  }

  override async onDialDown(ev: DialDownEvent): Promise<void> {
    const st = states.get(ev.action.id);
    if (!st) return;
    st.isMuted = !st.isMuted;
    VM.setMute(muteParam(st.settings), st.isMuted);
    await render(st);
  }

  override async onTouchTap(ev: TouchTapEvent): Promise<void> {
    const st = states.get(ev.action.id);
    if (!st) return;
    st.settings = getVmSettings(ev.payload.settings);
    if (st.settings.touchAction !== "toggleMute") return;
    st.isMuted = !st.isMuted;
    VM.setMute(muteParam(st.settings), st.isMuted);
    await render(st);
  }
}
