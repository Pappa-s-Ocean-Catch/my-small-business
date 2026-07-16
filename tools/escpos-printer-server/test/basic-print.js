import {
  align,
  bold,
  cut,
  feed,
  initialize,
  sendJob,
  text,
} from "./send-job.js";

async function main() {
  const result = await sendJob([
    initialize(),
    align(1),
    bold(true),
    text("SIMULATOR TEST\n"),
    bold(false),
    align(0),
    text("Hello from tools/escpos-printer-server\n"),
    text("This is a simple receipt sample.\n"),
    text("IP printer path looks healthy.\n"),
    feed(3),
    cut(),
  ]);

  console.log(`Sent basic print job to ${result.host}:${result.port}`);
}

main().catch((error) => {
  console.error("Failed to send basic print job.");
  console.error(error);
  process.exitCode = 1;
});
