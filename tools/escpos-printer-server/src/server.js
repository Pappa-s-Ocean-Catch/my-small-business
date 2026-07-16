import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EscPosSimulatorSession } from './escpos-simulator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.ESCPOS_SIM_HOST || '0.0.0.0';
const port = Number.parseInt(process.env.ESCPOS_SIM_PORT || '9100', 10);
const outputDir = path.resolve(process.env.ESCPOS_SIM_OUTPUT_DIR || path.join(__dirname, '..', 'output'));
const paperWidth = process.env.ESCPOS_SIM_PAPER_WIDTH || '80mm';

let connectionCounter = 0;

async function ensureOutputDir() {
  await fs.mkdir(outputDir, { recursive: true });
}

function log(message, details) {
  const stamp = new Date().toISOString();
  if (details) {
    console.log(`[escpos-printer-server] ${stamp} ${message}`, details);
    return;
  }
  console.log(`[escpos-printer-server] ${stamp} ${message}`);
}

async function start() {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid ESCPOS_SIM_PORT: ${process.env.ESCPOS_SIM_PORT}`);
  }
  if (!['58mm', '80mm'].includes(paperWidth)) {
    throw new Error(`Invalid ESCPOS_SIM_PAPER_WIDTH: ${paperWidth}. Use "58mm" or "80mm".`);
  }

  await ensureOutputDir();

  const server = net.createServer((socket) => {
    connectionCounter += 1;
    const connectionId = connectionCounter;
    const session = new EscPosSimulatorSession({ outputDir, connectionId, paperWidth });
    let processing = Promise.resolve();

    log(`Client connected`, {
      connectionId,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
    });

    socket.on('data', (chunk) => {
      processing = processing.then(() => session.processChunk(chunk)).catch((error) => {
        log(`Failed to process chunk`, { connectionId, error: error instanceof Error ? error.message : String(error) });
      });
    });

    socket.on('end', () => {
      void processing.then(() => session.finalizePendingOnDisconnect()).then(() => {
        log(`Client disconnected`, { connectionId });
      }).catch((error) => {
        log(`Failed to finalize session`, { connectionId, error: error instanceof Error ? error.message : String(error) });
      });
    });

    socket.on('error', (error) => {
      log(`Socket error`, { connectionId, error: error.message });
    });
  });

  server.on('error', (error) => {
    log(`Server error`, { error: error.message });
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    log(`ESC/POS simulator listening`, { host, port, outputDir, paperWidth });
  });
}

start().catch((error) => {
  log(`Startup failed`, { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
