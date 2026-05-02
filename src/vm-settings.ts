import { VM } from "./voicemeeter.js";
import { clampPct } from "./dial-base.js";
import { ICONS } from "./icons.js";

export type VmTargetType = "Strip" | "Bus";

export type VmSettings = {
  targetType: VmTargetType;
  targetIndex: number;
  vuMode: "same" | "custom";
  vuType: VmTargetType;
  vuIndex: number;
  label: string;
  icon: string;
  stepSize: number;
  defaultPct: number;
};

function parseIndex(value: unknown, fallback: number): number {
  return Math.max(0, Math.min(7, parseInt(String(value ?? fallback)) || 0));
}

export function getVmSettings(raw: any): VmSettings {
  const targetType: VmTargetType = raw?.targetType === "Bus" ? "Bus" : "Strip";
  const targetIndex = parseIndex(raw?.targetIndex, 3);
  return {
    targetType,
    targetIndex,
    vuMode: raw?.vuMode === "custom" ? "custom" : "same",
    vuType: raw?.vuType === "Bus" ? "Bus" : "Strip",
    vuIndex: parseIndex(raw?.vuIndex, targetIndex),
    label: String(raw?.label || `${targetType} ${targetIndex}`),
    icon: ICONS[raw?.icon] ?? ICONS.mic,
    stepSize: Math.max(1, parseInt(raw?.stepSize ?? "2") || 2),
    defaultPct: clampPct(parseInt(raw?.defaultPct ?? "80") || 80),
  };
}

export function gainParam(s: VmSettings): string {
  return `${s.targetType}[${s.targetIndex}].Gain`;
}

export function muteParam(s: VmSettings): string {
  return `${s.targetType}[${s.targetIndex}].Mute`;
}

export function level(s: VmSettings): number {
  const type = s.vuMode === "custom" ? s.vuType : s.targetType;
  const index = s.vuMode === "custom" ? s.vuIndex : s.targetIndex;
  return type === "Bus" ? VM.getLevelBus(index) : VM.getLevelStrip(index);
}
