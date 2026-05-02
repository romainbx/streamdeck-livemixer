export function toBase64(s: string): string {
  return Buffer.from(s, "binary").toString("base64");
}

export const ARC = "M6.76478 28.4005C5.76753 27.9141 5.34975 26.709 5.8766 25.7326C9.91293 18.2516 15.8325 11.9383 23.0641 7.42685C30.8646 2.56039 39.8769 -0.0132653 49.071 5.1417e-05C58.265 0.0133681 67.2699 2.61311 75.0563 7.50215C82.2747 12.0346 88.176 18.365 92.1906 25.8576C92.7147 26.8356 92.2934 28.0394 91.2947 28.5229C90.2961 29.0064 89.0985 28.5863 88.5709 27.6102C84.8872 20.7953 79.4995 15.0365 72.9197 10.905C65.7717 6.41684 57.5053 4.03027 49.0652 4.01805C40.625 4.00582 32.3517 6.36844 25.1908 10.8358C18.599 14.9482 13.1946 20.6915 9.49122 27.4957C8.96079 28.4702 7.76203 28.8869 6.76478 28.4005Z";

export function vuSVG(vu: number, level: number, adjusting: boolean, muted: boolean): string {
  const vol = Math.min(1, Math.max(0, level));
  const shown = adjusting || muted ? vol : Math.min(vol, Math.max(0, vu));
  const rotation = 130 * (1 - shown);
  const fill = adjusting || muted ? "white" : "url(#g)";
  const defs = adjusting || muted ? "" : `<defs><linearGradient id="g" x1="5" y1="49" x2="98" y2="49" gradientUnits="userSpaceOnUse"><stop stop-color="#3BB455"/><stop offset="60%" stop-color="#3BB455"/><stop offset="80%" stop-color="#FBDB00"/><stop offset="95%" stop-color="#FF3C4E"/></linearGradient></defs>`;
  return `data:image/svg+xml;base64,${toBase64(`<svg width="98" height="98" viewBox="0 0 98 40" xmlns="http://www.w3.org/2000/svg"><mask id="m"><path transform="rotate(${-rotation} 49 49)" fill="white" d="${ARC}"/></mask><path mask="url(#m)" d="${ARC}" fill="${fill}"/>${defs}</svg>`)}`;
}

export function indicatorSVG(level: number): string {
  const u = level * 120 - 60;
  return `data:image/svg+xml;base64,${toBase64(`<svg width="72" height="27" viewBox="0 0 72 27" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(${u}, 36, 36)"><rect x="35" y="2" width="2" height="10" rx="1" fill="white"/></g></svg>`)}`;
}

export function pctToDb(pct: number): number {
  return (Math.max(0, Math.min(100, pct)) / 100) * 60 - 60;
}

export function dbToPct(db: number): number {
  return Math.round(((db + 60) / 60) * 100);
}

export function pctToLevel(pct: number): number {
  return Math.max(0, Math.min(1, pct / 100));
}

export function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

export function smoothVu(current: number, next: number): number {
  const vu = Math.max(0, Math.min(1, next));
  if (vu >= current) return vu;
  if (vu < 0.005 && current < 0.02) return 0;
  return current * 0.82 + vu * 0.18;
}
