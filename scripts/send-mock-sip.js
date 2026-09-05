#!/usr/bin/env node

const dgram = require('dgram');

const args = process.argv.slice(2);
const ip = args[0] || '127.0.0.1'; // Use 127.0.0.1 for iOS simulator
const port = parseInt(args[1] || '5060', 10);
const callerNumber = args[2] || '+1234567890';
const callId = `mock-${Date.now()}@${ip}`;

const sipMessage = `INVITE sip:5060@${ip} SIP/2.0
Via: SIP/2.0/UDP 192.168.1.50:5060;branch=z9hG4bK1234
Max-Forwards: 70
From: "Test Caller" <sip:${callerNumber}@domain.com>;tag=5678
To: <sip:5060@${ip}>
Call-ID: ${callId}
CSeq: 1 INVITE
Contact: <sip:${callerNumber}@192.168.1.50:5060>
Content-Length: 0
`;

const client = dgram.createSocket('udp4');
const messageBuffer = Buffer.from(sipMessage);

client.send(messageBuffer, 0, messageBuffer.length, port, ip, (err) => {
  if (err) {
    console.error(`Error sending UDP packet: ${err}`);
  } else {
    console.log(`✅ Sent mock SIP INVITE to ${ip}:${port}`);
    console.log(`Caller Number: ${callerNumber}`);
    console.log(`Call-ID: ${callId}`);
  }
  client.close();
});
