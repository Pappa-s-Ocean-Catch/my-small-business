package expo.modules.calleridlistener

class CallSession(
    val callId: String,
    val callerNumber: String,
    private val ephemeralToken: String,
    private val fallbackNumber: String?,
    private val onAITranscript: (String, String, String) -> Unit,
    private val onAIToolCall: (String, String, String, String) -> Unit,
    private val onError: (String) -> Unit,
    private val onStatusChange: (String) -> Unit
) {
    var state = "INVITE_RECEIVED"
    
    private var rtpSession: RtpSession? = null
    private var realtimeClient: RealtimeClient? = null
    
    // Parsed from incoming SDP
    var remoteIp: String = ""
    var remotePort: Int = 0
    
    var initialInviteContent: String = ""
    var remoteSipIp: java.net.InetAddress? = null
    var remoteSipPort: Int = 0

    fun parseSdp(content: String) {
        val lines = content.split("\r\n", "\n")
        for (line in lines) {
            if (line.startsWith("c=IN IP4 ")) {
                remoteIp = line.substring("c=IN IP4 ".length).trim()
            } else if (line.startsWith("m=audio ")) {
                val parts = line.substring("m=audio ".length).trim().split(" ")
                if (parts.isNotEmpty()) {
                    remotePort = parts[0].toIntOrNull() ?: 0
                }
            }
        }
    }

    fun startRtpAndRealtime() {
        if (remoteIp.isEmpty() || remotePort == 0) return
        
        realtimeClient = RealtimeClient(ephemeralToken, fallbackNumber, onAudioDelta = { audioBytes ->
            // Audio from OpenAI -> send to phone
            rtpSession?.sendAudio(audioBytes)
        }, onTranscript = onAITranscript, onAIToolCall = onAIToolCall, onError = { msg -> onError("Call $callId: $msg") })
        
        rtpSession = RtpSession(remoteIp, remotePort) { audioBytes ->
            // Audio from phone -> send to OpenAI
            realtimeClient?.sendAudio(audioBytes)
        }
        
        rtpSession?.start()
        realtimeClient?.connect(callId)
        
        state = "ACTIVE"
        onStatusChange("ACTIVE")
    }

    fun getLocalRtpPort(): Int {
        return rtpSession?.localPort ?: 0
    }

    fun sendToolOutput(toolCallId: String, output: String) {
        realtimeClient?.sendToolOutput(toolCallId, output)
    }

    fun stop() {
        state = "TERMINATED"
        rtpSession?.stop()
        realtimeClient?.disconnect()
        onStatusChange("TERMINATED")
    }
}
