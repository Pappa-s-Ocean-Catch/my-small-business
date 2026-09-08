const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const PORT = 5060;

// You can change this array to test different combinations!
// Examples: 
// const SIP_RESPONSES = []; // Send nothing
// const SIP_RESPONSES = ["100 Trying"];
// const SIP_RESPONSES = ["486 Busy Here"];
// const SIP_RESPONSES = ["480 Temporarily Unavailable"];
const SIP_RESPONSES = ["100 Trying"];

// Delay in milliseconds before sending the response (e.g. 30000 for 30s)
const DELAY_MS = 0;

server.on('error', (err) => {
  console.log(`Server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  const content = msg.toString('utf8');
  const now = new Date().toLocaleTimeString();
  console.log(`\n\n======================================================`);
  console.log(`--- [${now}] RECEIVED FROM ${rinfo.address}:${rinfo.port} ---`);
  console.log(content);

  if (content.trim().startsWith('INVITE')) {
    console.log(`\n>>> [${now}] It's an INVITE. Will send configured responses after ${DELAY_MS}ms:`, SIP_RESPONSES);

    if (SIP_RESPONSES.length > 0) {
      setTimeout(() => {
        for (const statusCode of SIP_RESPONSES) {
          const response = buildResponse(statusCode, content);
          if (response) {
            console.log(`\n--- [${new Date().toLocaleTimeString()}] SENDING RESPONSE (${statusCode}) to ${rinfo.address}:${rinfo.port} ---`);
            console.log(response);
            server.send(response, rinfo.port, rinfo.address, (err) => {
              if (err) console.error(`Error sending response:`, err);
            });
          }
        }
      }, DELAY_MS);
    } else {
      console.log("\n>>> No SIP responses configured. Staying silent.");
    }
  }
});

server.on('listening', () => {
  const address = server.address();
  console.log(`======================================================`);
  console.log(`SIP Server listening on ${address.address}:${address.port}`);
  console.log(`Current SIP Responses to send:`, SIP_RESPONSES);
  console.log(`======================================================\n`);
});

function buildResponse(statusCode, requestContent) {
  const lines = requestContent.split(/\r?\n/);
  if (lines.length === 0) return null;

  const vias = [];
  let from = "";
  let to = "";
  let callId = "";
  let cseq = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const lower = line.toLowerCase();

    if (lower.startsWith("via:")) vias.push(line);
    else if (lower.startsWith("from:") && !from) from = line;
    else if (lower.startsWith("to:") && !to) to = line;
    else if (lower.startsWith("call-id:") && !callId) callId = line;
    else if (lower.startsWith("cseq:") && !cseq) cseq = line;
  }

  if (vias.length === 0 || !from || !to || !callId || !cseq) {
    return null;
  }

  if (!statusCode.startsWith("100") && !to.toLowerCase().includes("tag=")) {
    to += ";tag=pos-listener-test";
  }

  let response = `SIP/2.0 ${statusCode}\r\n`;
  for (const via of vias) {
    response += `${via}\r\n`;
  }
  response += `${from}\r\n`;
  response += `${to}\r\n`;
  response += `${callId}\r\n`;
  response += `${cseq}\r\n`;
  response += `Contact: <sip:pos-listener@127.0.0.1:${PORT}>\r\n`;
  response += `Content-Length: 0\r\n\r\n`;

  return response;
}

server.bind(PORT);
