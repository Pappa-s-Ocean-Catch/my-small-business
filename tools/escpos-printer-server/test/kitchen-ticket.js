import {
  align,
  bold,
  cut,
  feed,
  font,
  initialize,
  scale,
  sendJob,
  text,
} from "./send-job.js";

async function main() {
  const result = await sendJob([
    initialize(),
    align(1),
    bold(true),
    scale(1, 1),
    text("KITCHEN ORDER\n"),
    scale(0, 0),
    bold(false),
    text("Table 12  |  Delivery\n"),
    text("--------------------------------\n"),
    align(0),
    bold(true),
    text("2 x Pho Special\n"),
    bold(false),
    text("   - No onion\n"),
    text("   - Extra basil\n"),
    bold(true),
    text("1 x Spring Rolls\n"),
    bold(false),
    text("   - Peanut sauce\n"),
    text("--------------------------------\n"),
    font(1),
    text("Notes:\n"),
    font(0),
    text("Customer updated address by phone.\n"),
    text("Driver should call on arrival.\n"),
    feed(4),
    cut(),
  ]);

  console.log(`Sent kitchen ticket job to ${result.host}:${result.port}`);
}

main().catch((error) => {
  console.error("Failed to send kitchen ticket job.");
  console.error(error);
  process.exitCode = 1;
});
