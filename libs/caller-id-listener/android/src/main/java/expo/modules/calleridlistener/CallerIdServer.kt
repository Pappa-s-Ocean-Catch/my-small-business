package expo.modules.calleridlistener

import kotlinx.coroutines.*
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.util.concurrent.ConcurrentHashMap

class CallerIdServer(
    private val onIncomingCall: (String, String) -> Unit,
    private val onStatusChange: (String, Int?, String?) -> Unit
) {
    private var job: Job? = null
    private var socket: DatagramSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // Call-ID cache for deduplication. Value is expiration timestamp.
    private val callIdCache = ConcurrentHashMap<String, Long>()
    private val TTL_MS = 5 * 60 * 1000L // 5 minutes
    private val MAX_CACHE_SIZE = 1000

    @Synchronized
    fun start(port: Int) {
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
                    handleDatagram(content)
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
    }

    private fun handleDatagram(content: String) {
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
