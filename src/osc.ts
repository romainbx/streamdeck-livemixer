function padTo4(n: number): number {
  return Math.ceil(n / 4) * 4;
}

function readString(buf: Buffer, offset: number): { str: string; next: number } {
  const end = buf.indexOf(0, offset);
  const str = buf.toString("utf8", offset, end);
  return { str, next: offset + padTo4(end - offset + 1) };
}

function decodeMessage(buf: Buffer, offset = 0): { path: string; value: number } | null {
  try {
    const { str: path, next: o1 } = readString(buf, offset);
    if (!path.startsWith("/")) return null;
    const { str: typeTag, next: o2 } = readString(buf, o1);
    if (typeTag === ",f" || typeTag === ",f\0") return { path, value: buf.readFloatBE(o2) };
    if (typeTag === ",i" || typeTag === ",i\0") return { path, value: buf.readInt32BE(o2) };
    if (typeTag === ",T") return { path, value: 1 };
    if (typeTag === ",F") return { path, value: 0 };
    return null;
  } catch {
    return null;
  }
}

const OSC_BUNDLE_PREFIX = Buffer.from("#bundle\0");

export function decodeOSC(buf: Buffer): { path: string; value: number }[] {
  const results: { path: string; value: number }[] = [];
  if (buf.slice(0, 8).equals(OSC_BUNDLE_PREFIX)) {
    let offset = 16;
    while (offset < buf.length) {
      const size = buf.readInt32BE(offset);
      offset += 4;
      if (size > 0 && offset + size <= buf.length) results.push(...decodeOSC(buf.slice(offset, offset + size)));
      offset += size;
    }
    return results;
  }
  const msg = decodeMessage(buf);
  if (msg) results.push(msg);
  return results;
}

export function encodeOSCFloat(path: string, value: number): Buffer {
  const pathBytes = Buffer.alloc(padTo4(path.length + 1));
  pathBytes.write(path);
  const typeBytes = Buffer.alloc(padTo4(3));
  typeBytes.write(",f");
  const valBytes = Buffer.alloc(4);
  valBytes.writeFloatBE(value, 0);
  return Buffer.concat([pathBytes, typeBytes, valBytes]);
}

export function encodeOSCBang(path: string): Buffer {
  const pathBytes = Buffer.alloc(padTo4(path.length + 1));
  pathBytes.write(path);
  const typeBytes = Buffer.alloc(padTo4(2));
  typeBytes.write(",");
  return Buffer.concat([pathBytes, typeBytes]);
}
