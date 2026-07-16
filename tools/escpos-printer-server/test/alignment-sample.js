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
    bold(true),
    text("ALIGNMENT SAMPLE\n"),
    bold(false),
    align(0),
    text("LEFT  : grilled pork banh mi\n"),
    align(1),
    text("CENTER: grilled pork banh mi\n"),
    align(2),
    text("RIGHT : grilled pork banh mi\n"),
    align(0),
    feed(3),
    cut(),
  ]);

  console.log(`Sent alignment sample to ${result.host}:${result.port}`);
}

main().catch((error) => {
  console.error("Failed to send alignment sample.");
  console.error(error);
  process.exitCode = 1;
});
