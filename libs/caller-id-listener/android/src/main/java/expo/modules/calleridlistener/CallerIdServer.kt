package expo.modules.calleridlistener

import kotlinx.coroutines.*
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.util.concurrent.ConcurrentHashMap

class CallerIdServer(
    private val onIncomingCall: (String, String) -> Unit,
    private val onStatusChange: (String, Int?, String?) -> Unit,
    private val onRawPacket: (String) -> Unit,
    private val onAITranscript: (String, String, String) -> Unit,
    private val onAIToolCall: (String, String, String, String) -> Unit,
    private val onError: (String) -> Unit
) {
    private var job: Job? = null
    private var socket: DatagramSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // Call-ID cache for deduplication. Value is expiration timestamp.
    private val callIdCache = ConcurrentHashMap<String, Long>()
    private val TTL_MS = 5 * 60 * 1000L // 5 minutes
    private val MAX_CACHE_SIZE = 1000

    private var currentSipResponses: List<String> = emptyList()
    private var aiCallAssistantEnabled: Boolean = false
    private var ephemeralToken: String? = null
    private var fallbackNumber: String? = null
    private val activeSessions = ConcurrentHashMap<String, CallSession>()

    @Synchronized
    fun start(port: Int, sipResponses: List<String> = emptyList(), aiCallAssistantEnabled: Boolean = false, ephemeralToken: String? = null, fallbackNumber: String? = null) {
        currentSipResponses = sipResponses
        this.aiCallAssistantEnabled = aiCallAssistantEnabled
        this.ephemeralToken = ephemeralToken
        this.fallbackNumber = fallbackNumber
        if (job?.isActive == true && socket?.localPort == port) {
            return // Already running on this port
        }
        stop()

        job = scope.launch {
            try {
                onStatusChange("starting", port, null)
                socket = DatagramSocket(null).apply {
                    reuseAddress = true
                    bind(InetSocketAddress("0.0.0.0", port))
                }
                
                onStatusChange("listening", port, null)
                
                val buffer = ByteArray(4096)
                while (isActive) {
                    val packet = DatagramPacket(buffer, buffer.size)
                    try {
                        socket?.receive(packet)
                    } catch (e: Exception) {
                        if (isActive) throw e
                        break // Stopped
                    }
                    
                    val content = String(packet.data, 0, packet.length, Charsets.UTF_8)
                    handleDatagram(content, packet)
                }
            } catch (e: CancellationException) {
                // Job cancelled, ignore
            } catch (e: Exception) {
                onStatusChange("error", port, e.message ?: "Unknown socket error")
                closeSocket()
            }
        }
    }

    @Synchronized
    fun stop() {
        job?.cancel()
        job = null
        closeSocket()
        onStatusChange("stopped", null, null)
    }

    private fun closeSocket() {
        try {
            socket?.close()
        } catch (e: Exception) {
            // Ignore close errors
        } finally {
            socket = null
        }
        activeSessions.values.forEach { it.stop() }
        activeSessions.clear()
    }

    private fun handleDatagram(content: String, packet: DatagramPacket) {
        onRawPacket(content)
        val isInvite = content.trim().startsWith("INVITE")
        val isCancel = content.trim().startsWith("CANCEL")
        val isBye = content.trim().startsWith("BYE")
        val isAck = content.trim().startsWith("ACK")
        
        if (aiCallAssistantEnabled && ephemeralToken != null) {
            val parseResult = SipParser.parse(content) ?: return
            val callId = parseResult.callId
            val callerNumber = parseResult.callerNumber
            
            val session = activeSessions.getOrPut(callId) {
                CallSession(callId, callerNumber, ephemeralToken!!, fallbackNumber, onAITranscript, onAIToolCall, onError) { state ->
                    if (state == "TERMINATED") activeSessions.remove(callId)
                }
            }

            if (isInvite) {
                session.initialInviteContent = content
                session.remoteSipIp = packet.address
                session.remoteSipPort = packet.port
                
                session.parseSdp(content)
                session.startRtpAndRealtime()
                
                val localPort = session.getLocalRtpPort()
                // Provide simple SDP for G.711 PCMU
                val sdp = "v=0\r\n" +
                          "o=- 0 0 IN IP4 0.0.0.0\r\n" +
                          "s=session\r\n" +
                          "c=IN IP4 0.0.0.0\r\n" +
                          "t=0 0\r\n" +
                          "m=audio $localPort RTP/AVP 0\r\n" +
                          "a=rtpmap:0 PCMU/8000\r\n"
                          
                val okResponse = SipParser.build200OkWithSdp(content, sdp)
                if (okResponse != null) {
                    val data = okResponse.toByteArray(Charsets.UTF_8)
                    try { socket?.send(DatagramPacket(data, data.size, packet.address, packet.port)) } catch (e: Exception) {}
                }
            } else if (isCancel || isBye) {
                session.stop()
                val okResponse = SipParser.buildResponse("200 OK", content)
                if (okResponse != null) {
                    val data = okResponse.toByteArray(Charsets.UTF_8)
                    try { socket?.send(DatagramPacket(data, data.size, packet.address, packet.port)) } catch (e: Exception) {}
                }
            } else if (isAck) {
                // Connection established
            }
            
            // Still invoke onIncomingCall so RN knows about it
            if (isInvite) {
                onIncomingCall(callerNumber, callId)
            }
            return
        }

        // Send the configured SIP responses (Non-AI fallback behavior)
        if (isInvite && currentSipResponses.isNotEmpty()) {
            for (responseString in currentSipResponses) {
                val sipResponse = SipParser.buildResponse(responseString, content)
                if (sipResponse != null) {
                    val data = sipResponse.toByteArray(Charsets.UTF_8)
                    val outPacket = DatagramPacket(data, data.size, packet.address, packet.port)
                    try { socket?.send(outPacket) } catch (e: Exception) {}
                }
            }
        } else if (isCancel) {
            val sipResponse = SipParser.buildResponse("200 OK", content)
            if (sipResponse != null) {
                val data = sipResponse.toByteArray(Charsets.UTF_8)
                val outPacket = DatagramPacket(data, data.size, packet.address, packet.port)
                try { socket?.send(outPacket) } catch (e: Exception) {}
            }
        }

        val result = SipParser.parse(content) ?: return
        
        val now = System.currentTimeMillis()
        pruneCache(now)

        val callId = result.callId
        if (callId.isNotEmpty()) {
            if (callIdCache.containsKey(callId)) {
                // Deduplicate
                return
            }
            if (callIdCache.size >= MAX_CACHE_SIZE) {
                // Prevent boundless growth, remove oldest
                val oldest = callIdCache.minByOrNull { it.value }
                if (oldest != null) {
                    callIdCache.remove(oldest.key)
                }
            }
            callIdCache[callId] = now + TTL_MS
        }
        
        onIncomingCall(result.callerNumber, callId)
    }

    fun sendToolOutput(callId: String, toolCallId: String, output: String) {
        activeSessions[callId]?.sendToolOutput(toolCallId, output)
    }
    
    fun endCall(callId: String) {
        val session = activeSessions[callId] ?: return
        val inviteContent = session.initialInviteContent
        val remoteIp = session.remoteSipIp
        val remotePort = session.remoteSipPort
        
        if (inviteContent.isNotEmpty() && remoteIp != null) {
            val byeRequest = SipParser.buildBye(inviteContent)
            if (byeRequest != null) {
                val data = byeRequest.toByteArray(Charsets.UTF_8)
                try { socket?.send(DatagramPacket(data, data.size, remoteIp, remotePort)) } catch (e: Exception) {}
            }
        }
        
        session.stop()
        activeSessions.remove(callId)
    }
    
    private fun pruneCache(now: Long) {
        val iter = callIdCache.entries.iterator()
        while (iter.hasNext()) {
            val entry = iter.next()
            if (entry.value < now) {
                iter.remove()
            }
        }
    }
}
