Technical implementation plan

Objective

Build an AI-powered telephone ordering system integrated directly into the existing React Native Android POS application.

The existing native SIP module already receives incoming SIP calls from the Grandstream HT813 FXO gateway. The goal is to extend this module so it can answer incoming calls, handle two-way RTP audio, and bridge the caller's audio to the OpenAI Realtime API over WebSocket.

The AI agent will conduct a natural real-time conversation with the customer, understand their order, ask clarification questions when necessary, interact with the existing menu and POS APIs, confirm the order and price, and submit the completed order into the POS system.

The intended end-to-end flow is:

Customer calls shop
        ↓
PSTN / NBN Phone Line
        ↓
Grandstream HT813 FXO
        ↓
SIP INVITE
        ↓
Android POS Native SIP Module
        ↓
Answer call + establish RTP
        ↓
RTP Audio ↔ OpenAI Realtime WebSocket
        ↓
AI talks naturally with customer
        ↓
AI uses Menu / Order tools
        ↓
Confirm items + modifiers + total
        ↓
Collect customer name
        ↓
Submit order to existing POS
        ↓
Confirm order with customer
        ↓
End call
Key technical goals
Reuse and extend the existing Kotlin SIP listener, rather than replacing the current telephony implementation.
Support complete SIP call lifecycle: INVITE, ACK, CANCEL, BYE, etc.
Support bidirectional RTP/G.711 telephone audio.
Bridge RTP audio directly between the native Android module and OpenAI Realtime.
Keep high-frequency audio processing entirely in native Kotlin; do not route RTP packets through the React Native JS bridge.
Allow customers to interrupt/barge in while the AI is speaking.
Expose only useful call state, transcript and order events to React Native.
Connect the AI to existing menu/POS functionality through controlled tools such as searchMenu, addItem, getOrderTotal, and submitOrder.
Never allow the AI to invent menu items, modifiers, availability or prices; the POS/menu API remains the source of truth.
Keep permanent API credentials out of the Android APK.
Cleanly terminate RTP, WebSocket and SIP resources when calls end or fail.

Architecture

PSTN
  ↓
HT813 FXO
  ↓ SIP + RTP
Android POS / React Native
  │
  ├─ Native Kotlin
  │    ├─ SIP Server
  │    ├─ SDP negotiation
  │    ├─ RTP Receiver/Sender
  │    └─ OpenAI Realtime WebSocket Bridge
  │
  ├──────── WSS ────────► OpenAI Realtime
  │                         ↓
  │                    Voice AI Agent
  │
  └─ React Native JS
       ├─ Call UI
       ├─ Transcript
       ├─ Menu/POS tools
       └─ Order creation

Phase 1 — Extend existing SIP module. Keep the current working INVITE handling and add proper call state management for INVITE → 200 OK → ACK → BYE/CANCEL. Parse incoming SDP to obtain the HT813 RTP IP, port, codec and payload type. Generate response SDP containing the Android device's RTP port. Initially support G.711 PCMU/8000, and add PCMA if required by the HT813.

Phase 2 — Implement RtpSession.kt. Open a UDP RTP port per active call. Receive RTP packets from the HT813, properly parse RTP headers, extract G.711 audio payloads, and maintain SSRC/sequence/timestamps for outgoing RTP. Implement the reverse direction so generated audio can be packetized and sent back to the HT813. Handle packet timing, call cleanup and socket shutdown.

Phase 3 — Implement RealtimeClient.kt. Establish an outbound secure WebSocket connection from Android to the OpenAI Realtime API. Configure the session for a voice ordering agent and the appropriate telephony audio format. Forward caller audio from RtpSession into Realtime and receive generated audio from Realtime for transmission back through RTP. Also handle interruption/barge-in so the AI stops speaking when the customer starts talking.

Phase 4 — Create CallSession.kt. One object should own the entire lifecycle:

CallSession
 ├─ callId
 ├─ callerNumber
 ├─ SIP dialog state
 ├─ remoteRtpAddress
 ├─ remoteRtpPort
 ├─ codec
 ├─ RtpSession
 ├─ RealtimeClient
 └─ conversation/order state

The lifecycle should be:

INVITE
 ↓
Create CallSession
 ↓
Parse SDP
 ↓
Start RTP socket
 ↓
Connect Realtime
 ↓
200 OK + SDP
 ↓
ACK
 ↓
Bridge RTP ↔ Realtime
 ↓
BYE/CANCEL
 ↓
Close RTP + Realtime + CallSession

Phase 5 — Expose only high-level events to React Native. Do not pass RTP/audio packets through the RN bridge. Native Kotlin handles all real-time media. RN should receive events such as:

onIncomingCall({ callId, phoneNumber })
onCallConnected({ callId })
onAIConnected({ callId })

onTranscript({
  callId,
  role: "customer",
  text: "Two flake packs please"
})

onAITranscript({
  callId,
  text: "Would you like chicken salt?"
})

onCallEnded({ callId, reason })
onError({ callId, error })

Phase 6 — Add ordering tools. Give the Realtime agent a small set of controlled functions rather than letting it invent menu/order information:

searchMenu(query)
getProduct(productId)
addItem(productId, quantity, modifiers)
updateItem(...)
removeItem(...)
getOrder()
getOrderTotal()
submitOrder(customerName, phone)

Your existing React Native/backend/POS logic remains the source of truth for products, modifiers and prices.

Phase 7 — Security. Do not hardcode the permanent OpenAI API key in the APK. Use your backend for authentication/session credential handling according to the current Realtime authentication flow.

Phase 8 — Testing milestones. Build incrementally: first INVITE → RTP received; then save incoming RTP/G.711 to verify caller audio; then RTP → Realtime and confirm transcription; then Realtime audio → RTP → caller; then full two-way conversation/barge-in; finally add menu tools and POS order submission.

The first acceptance test should simply be: call the shop → Android answers → say “hello” → AI replies through the physical phone line. Once that works reliably, build the ordering logic on top.