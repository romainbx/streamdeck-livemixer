import * as path from "node:path";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import streamDeck from "@elgato/streamdeck";

const __dirname_ts = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);
const koffi = _require(path.join(__dirname_ts, "node_modules/koffi/index.js"));

function findDll(): string {
  const candidates = [
    path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "VB\\Voicemeeter\\VoicemeeterRemote64.dll"),
    path.join(process.env["ProgramFiles"] ?? "C:\\Program Files", "VB\\Voicemeeter\\VoicemeeterRemote64.dll"),
    "C:\\Program Files (x86)\\VB\\Voicemeeter\\VoicemeeterRemote64.dll",
    "C:\\Program Files\\VB\\Voicemeeter\\VoicemeeterRemote64.dll",
  ];
  for (const p of candidates) {
    try { fs.accessSync(p); streamDeck.logger.info(`DLL found: ${p}`); return p; } catch {}
  }
  streamDeck.logger.error(`DLL not found, tried: ${candidates.join(", ")}`);
  return candidates[0];
}

const DLL_PATH = findDll();

function addVmToPath(dllPath: string): void {
  const dir = path.dirname(dllPath);
  if (!process.env.PATH?.includes(dir)) {
    process.env.PATH = dir + ";" + (process.env.PATH ?? "");
    streamDeck.logger.info(`Added to PATH: ${dir}`);
  }
}

type VmDll = {
  Login: () => number;
  Logout: () => number;
  GetParameterFloat: (param: string, out: Float32Array) => number;
  SetParameterFloat: (param: string, value: number) => number;
  GetLevel: (type: number, channel: number, out: Float32Array) => number;
};

let dll: VmDll | null = null;
let loginOk = false;

export function vmInit(): boolean {
  if (loginOk) return true;
  try {
    addVmToPath(DLL_PATH);
    const lib = koffi.load(DLL_PATH);
    dll = {
      Login: lib.func("VBVMR_Login", "int", []),
      Logout: lib.func("VBVMR_Logout", "int", []),
      GetParameterFloat: lib.func("VBVMR_GetParameterFloat", "int", ["str", koffi.out(koffi.pointer("float"))]),
      SetParameterFloat: lib.func("VBVMR_SetParameterFloat", "int", ["str", "float"]),
      GetLevel: lib.func("VBVMR_GetLevel", "int", ["int", "int", koffi.out(koffi.pointer("float"))]),
    };
    const r = dll.Login();
    if (r >= 0) {
      loginOk = true;
      streamDeck.logger.info(`Voicemeeter DLL loaded, login=${r}`);
      return true;
    }
    streamDeck.logger.error(`Voicemeeter login failed: ${r}`);
  } catch (e) {
    streamDeck.logger.error(`Voicemeeter DLL error: ${e}`);
  }
  return false;
}

export function vmGetFloat(param: string): number {
  if (!dll || !loginOk) return 0;
  try {
    const out = new Float32Array(1);
    dll.GetParameterFloat(param, out);
    return out[0];
  } catch { return 0; }
}

export function vmSetFloat(param: string, value: number): void {
  if (!dll || !loginOk) return;
  try { dll.SetParameterFloat(param, value); } catch {}
}

export function vmGetLevel(type: number, channel: number): number {
  if (!dll || !loginOk) return 0;
  try {
    const out = new Float32Array(1);
    dll.GetLevel(type, channel, out);
    return Math.max(0, Math.min(1, out[0]));
  } catch { return 0; }
}

function maxLevel(type: number, startChannel: number, count: number): number {
  let peak = 0;
  for (let i = 0; i < count; i++) {
    peak = Math.max(peak, vmGetLevel(type, startChannel + i));
  }
  return peak;
}

export const VM = {
  getLevelStrip: (strip: number): number => maxLevel(0, strip * 2, 2),
  getLevelBus: (bus: number): number => maxLevel(3, bus * 8, 8),
  getGain: (param: string) => vmGetFloat(param),
  setGain: (param: string, db: number) => vmSetFloat(param, db),
  getMute: (param: string) => vmGetFloat(param) > 0.5,
  setMute: (param: string, muted: boolean) => vmSetFloat(param, muted ? 1 : 0),
};
