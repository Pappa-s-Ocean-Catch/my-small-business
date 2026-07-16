import net from "node:net";

const DEFAULT_HOST = process.env.ESCPOS_SIM_HOST || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.ESCPOS_SIM_PORT || 9100);

export function openConnection(host = DEFAULT_HOST, port = DEFAULT_PORT) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => resolve(socket));
    socket.on("error", reject);
  });
}

export async function sendJob(buffers, options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = Number(options.port || DEFAULT_PORT);
  const socket = await openConnection(host, port);

  return new Promise((resolve, reject) => {
    socket.on("error", reject);
    for (const buffer of buffers) {
      socket.write(buffer);
    }
    socket.end(() => resolve({ host, port }));
  });
}

export const ESC = 0x1b;
export const GS = 0x1d;

export function text(value) {
  return Buffer.from(value, "utf8");
}

export function initialize() {
  return Buffer.from([ESC, 0x40]);
}

export function align(mode) {
  return Buffer.from([ESC, 0x61, mode]);
}

export function bold(enabled) {
  return Buffer.from([ESC, 0x45, enabled ? 1 : 0]);
}

export function font(mode) {
  return Buffer.from([ESC, 0x4d, mode]);
}

export function feed(lines = 1) {
  return Buffer.from([ESC, 0x64, lines]);
}

export function scale(widthMultiplier = 0, heightMultiplier = 0) {
  return Buffer.from([
    GS,
    0x21,
    ((widthMultiplier & 0x0f) << 4) | (heightMultiplier & 0x0f),
  ]);
}

export function cut() {
  return Buffer.from([GS, 0x56, 0x00]);
}
