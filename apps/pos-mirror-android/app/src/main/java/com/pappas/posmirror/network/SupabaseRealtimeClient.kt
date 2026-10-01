package com.pappas.posmirror.network

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.pappas.posmirror.data.model.MirrorOrderSnapshot
import com.pappas.posmirror.util.Constants
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class SupabaseRealtimeClient(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build(),
    private val gson: Gson = Gson()
) {
    companion object {
        private const val TAG = "RealtimeClient"
        private const val HEARTBEAT_INTERVAL_MS = 30000L
    }

    interface Listener {
        fun onOrderSnapshot(snapshot: MirrorOrderSnapshot)
        fun onQueueSyncUpdated()
        fun onConnectionStatusChanged(status: String, warning: String?)
    }

    var listener: Listener? = null

    private var webSocket: WebSocket? = null
    private val refCounter = AtomicInteger(1)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var isConnected = false
    private var isClosing = false

    private var currentToken: String = ""
    private var currentRegisterId: String = ""
    private var listenToQueue: Boolean = false

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            sendHeartbeat()
            mainHandler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
        }
    }

    private val reconnectRunnable = Runnable {
        if (!isClosing && !isConnected) {
            connectInternal()
        }
    }

    fun start(accessToken: String, registerId: String, queueMode: Boolean) {
        isClosing = false
        currentToken = accessToken
        currentRegisterId = registerId.trim()
        listenToQueue = queueMode
        connectInternal()
    }

    fun stop() {
        isClosing = true
        mainHandler.removeCallbacks(heartbeatRunnable)
        mainHandler.removeCallbacks(reconnectRunnable)
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        isConnected = false
    }

    private fun connectInternal() {
        mainHandler.removeCallbacks(reconnectRunnable)
        val wsUrl = Constants.REALTIME_WS_URL
        val request = Request.Builder().url(wsUrl).build()

        notifyStatus("loading", null)

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket onOpen")
                isConnected = true
                mainHandler.post(heartbeatRunnable)
                notifyStatus("connected", null)

                // Join mirror state topic
                if (currentRegisterId.isNotEmpty()) {
                    joinMirrorTopic(ws, currentRegisterId)
                }

                // Join order sync topic if queue mode
                if (listenToQueue) {
                    joinOrderSyncTopic(ws)
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.w(TAG, "WebSocket failure: ${t.message}")
                isConnected = false
                mainHandler.removeCallbacks(heartbeatRunnable)
                notifyStatus("reconnecting", "Connection interrupted. Reconnecting...")
                scheduleReconnect()
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: $code $reason")
                isConnected = false
                mainHandler.removeCallbacks(heartbeatRunnable)
                if (!isClosing) {
                    notifyStatus("reconnecting", "Connection lost. Reconnecting...")
                    scheduleReconnect()
                }
            }
        })
    }

    private fun scheduleReconnect() {
        if (isClosing) return
        mainHandler.postDelayed(reconnectRunnable, 3000)
    }

    private fun sendHeartbeat() {
        val ref = refCounter.getAndIncrement().toString()
        val msg = JsonObject().apply {
            addProperty("topic", "phoenix")
            addProperty("event", "heartbeat")
            add("payload", JsonObject())
            addProperty("ref", ref)
        }
        webSocket?.send(msg.toString())
    }

    private fun joinMirrorTopic(ws: WebSocket, registerId: String) {
        val topic = "realtime:pos-mirror-state:$registerId"
        val ref = refCounter.getAndIncrement().toString()

        val filter = JsonObject().apply {
            addProperty("event", "*")
            addProperty("schema", "public")
            addProperty("table", "pos_mirror_state")
            addProperty("filter", "register_id=eq.$registerId")
        }

        val pgChanges = JsonArray().apply { add(filter) }

        val config = JsonObject().apply {
            add("broadcast", JsonObject().apply {
                addProperty("ack", false)
                addProperty("self", false)
            })
            add("presence", JsonObject().apply {
                addProperty("key", "")
            })
            add("postgres_changes", pgChanges)
        }

        val payload = JsonObject().apply {
            add("config", config)
            if (currentToken.isNotEmpty()) {
                addProperty("access_token", currentToken)
            }
        }

        val msg = JsonObject().apply {
            addProperty("topic", topic)
            addProperty("event", "phx_join")
            add("payload", payload)
            addProperty("ref", ref)
        }

        ws.send(msg.toString())
    }

    private fun joinOrderSyncTopic(ws: WebSocket) {
        val topic = "realtime:pos-mirror-order-sync"
        val ref = refCounter.getAndIncrement().toString()

        val filter = JsonObject().apply {
            addProperty("event", "UPDATE")
            addProperty("schema", "public")
            addProperty("table", "order_sync_state")
        }

        val pgChanges = JsonArray().apply { add(filter) }

        val config = JsonObject().apply {
            add("broadcast", JsonObject().apply {
                addProperty("ack", false)
                addProperty("self", false)
            })
            add("presence", JsonObject().apply {
                addProperty("key", "")
            })
            add("postgres_changes", pgChanges)
        }

        val payload = JsonObject().apply {
            add("config", config)
            if (currentToken.isNotEmpty()) {
                addProperty("access_token", currentToken)
            }
        }

        val msg = JsonObject().apply {
            addProperty("topic", topic)
            addProperty("event", "phx_join")
            add("payload", payload)
            addProperty("ref", ref)
        }

        ws.send(msg.toString())
    }

    private fun handleIncomingMessage(text: String) {
        try {
            val json = JsonParser.parseString(text).asJsonObject
            val topic = json.get("topic")?.asString ?: ""
            val event = json.get("event")?.asString ?: ""
            val payload = json.get("payload")

            if (event == "postgres_changes" && payload != null && payload.isJsonObject) {
                val data = payload.asJsonObject.getAsJsonObject("data")
                if (data != null) {
                    val table = data.get("table")?.asString ?: ""
                    if (table == "pos_mirror_state") {
                        val record = data.getAsJsonObject("record")
                        val currentOrderElem = record?.get("current_order")
                        if (currentOrderElem != null) {
                            val snapshot = if (currentOrderElem.isJsonObject) {
                                gson.fromJson(currentOrderElem, MirrorOrderSnapshot::class.java)
                            } else if (currentOrderElem.isJsonPrimitive) {
                                gson.fromJson(currentOrderElem.asString, MirrorOrderSnapshot::class.java)
                            } else {
                                MirrorOrderSnapshot()
                            }
                            mainHandler.post {
                                listener?.onOrderSnapshot(snapshot)
                            }
                        }
                    } else if (table == "order_sync_state") {
                        mainHandler.post {
                            listener?.onQueueSyncUpdated()
                        }
                    }
                }
            } else if (event == "phx_reply") {
                // Topic joined response
                Log.d(TAG, "phx_reply received for topic $topic")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling message", e)
        }
    }

    private fun notifyStatus(status: String, warning: String?) {
        mainHandler.post {
            listener?.onConnectionStatusChanged(status, warning)
        }
    }
}
