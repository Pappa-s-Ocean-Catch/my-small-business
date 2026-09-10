package expo.modules.calleridlistener

import kotlinx.coroutines.*
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import kotlin.random.Random

class RtpSession(
    private val remoteIp: String,
    private val remotePort: Int,
    private val onAudioReceived: (ByteArray) -> Unit
) {
    private var socket: DatagramSocket? = null
    private var job: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    val localPort: Int
    
    private val ssrc = Random.nextInt()
    private val sequenceNumber = AtomicInteger(Random.nextInt(0, 65535))
    private val timestamp = AtomicLong(Random.nextLong(0, 0xFFFFFFFF))
    
    init {
        // Bind to any available port
        socket = DatagramSocket(null).apply {
            reuseAddress = true
            bind(InetSocketAddress("0.0.0.0", 0))
        }
        localPort = socket?.localPort ?: 0
    }
    
    fun start() {
        job = scope.launch {
            try {
                val buffer = ByteArray(2048)
                while (isActive) {
                    val packet = DatagramPacket(buffer, buffer.size)
                    try {
                        socket?.receive(packet)
                    } catch (e: Exception) {
                        if (isActive) throw e
                        break
                    }
                    
                    val length = packet.length
                    if (length > 12) {
                        // Extract basic RTP Header
                        // Byte 0: V(2), P(1), X(1), CC(4)
                        val v = (buffer[0].toInt() ushr 6) and 0x03
                        if (v != 2) continue
                        
                        val cc = buffer[0].toInt() and 0x0F
                        
                        // Byte 1: M(1), PT(7)
                        val pt = buffer[1].toInt() and 0x7F
                        
                        // We expect PCMU (Payload Type 0)
                        if (pt == 0) {
                            val headerLength = 12 + (cc * 4)
                            if (length > headerLength) {
                                val payloadLength = length - headerLength
                                val payload = ByteArray(payloadLength)
                                System.arraycopy(buffer, headerLength, payload, 0, payloadLength)
                                onAudioReceived(payload)
                            }
                        }
                    }
                }
            } catch (e: CancellationException) {
                // Ignore
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
    
    fun sendAudio(pcmuBytes: ByteArray) {
        if (socket == null || job?.isActive != true) return
        
        // Break into 160-byte chunks (20ms at 8000Hz) if large, but we assume
        // Realtime API might send arbitrary chunks. Let's send whatever we get
        // or chunk it. 160 bytes is standard for G711.
        
        var offset = 0
        while (offset < pcmuBytes.size) {
            val chunkSize = minOf(160, pcmuBytes.size - offset)
            val packetData = ByteArray(12 + chunkSize)
            
            // Header
            packetData[0] = 0x80.toByte() // V=2, P=0, X=0, CC=0
            packetData[1] = 0x00.toByte() // M=0, PT=0 (PCMU)
            
            val seq = sequenceNumber.getAndIncrement()
            packetData[2] = (seq ushr 8).toByte()
            packetData[3] = seq.toByte()
            
            val ts = timestamp.getAndAdd(chunkSize.toLong())
            packetData[4] = (ts ushr 24).toByte()
            packetData[5] = (ts ushr 16).toByte()
            packetData[6] = (ts ushr 8).toByte()
            packetData[7] = ts.toByte()
            
            packetData[8] = (ssrc ushr 24).toByte()
            packetData[9] = (ssrc ushr 16).toByte()
            packetData[10] = (ssrc ushr 8).toByte()
            packetData[11] = ssrc.toByte()
            
            // Payload
            System.arraycopy(pcmuBytes, offset, packetData, 12, chunkSize)
            
            val packet = DatagramPacket(packetData, packetData.size, InetSocketAddress(remoteIp, remotePort))
            try {
                socket?.send(packet)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            
            offset += chunkSize
        }
    }
    
    fun stop() {
        job?.cancel()
        try {
            socket?.close()
        } catch (e: Exception) {}
        socket = null
    }
}
