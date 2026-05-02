import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { VM, vmInit } from "../voicemeeter.js";
import { OFF_ICON } from "../icons.js";
import { getVmSettings, muteParam, VmSettings } from "../vm-settings.js";

function svgFileToDataUrl(iconPath: string): string {
  try {
    const normalized = iconPath.replace(/^\.\//, "");
    const svg = readFileSync(join(cwd(), normalized)).toString();
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  } catch {
    return iconPath;
  }
}

async function render(actionInstance: any, settings: VmSettings, isMuted: boolean): Promise<void> {
  await actionInstance.setTitle(settings.label);
  await actionInstance.setImage(svgFileToDataUrl(isMuted ? OFF_ICON : settings.icon));
  await actionInstance.setState(isMuted ? 1 : 0);
}

@action({ UUID: "com.romain.live.vm-mute" })
export class GenericVmMute extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    if (!ev.action.isKey()) return;
    vmInit();
    const settings = getVmSettings(ev.payload.settings);
    await render(ev.action, settings, VM.getMute(muteParam(settings)));
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = getVmSettings(ev.payload.settings);
    await render(ev.action, settings, VM.getMute(muteParam(settings)));
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const settings = getVmSettings(ev.payload.settings);
    const nextMuted = !VM.getMute(muteParam(settings));
    VM.setMute(muteParam(settings), nextMuted);
    await render(ev.action, settings, nextMuted);
  }
}
