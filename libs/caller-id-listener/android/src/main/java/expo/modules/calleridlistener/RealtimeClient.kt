package expo.modules.calleridlistener

import android.util.Base64
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class RealtimeClient(
    private val ephemeralToken: String,
    private val fallbackNumber: String?,
    private val onAudioDelta: (ByteArray) -> Unit,
    private val onTranscript: (String, String, String) -> Unit, // callId, role, text
    private val onAIToolCall: (String, String, String, String) -> Unit, // callId, toolCallId, name, arguments
    private val onError: (String) -> Unit
) {
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
        
    private var callId: String = ""

    fun connect(callId: String) {
        this.callId = callId
        val request = Request.Builder()
            .url("wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1")
            .addHeader("Authorization", "Bearer $ephemeralToken")
            .addHeader("OpenAI-Beta", "realtime=v1")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // Configure session for g711_ulaw
                val sessionUpdate = JSONObject().apply {
                    put("type", "session.update")
                    put("session", JSONObject().apply {
                        put("voice", "alloy")
                        put("input_audio_format", "g711_ulaw")
                        put("output_audio_format", "g711_ulaw")
                        
                        val num = fallbackNumber ?: "the store directly"
                        put("instructions", "You are a phone order-taking assistant for Pappa's restaurant. Your ONLY job is to take orders. If the customer has a complaint, wants to talk to sales, or has any non-order request, politely tell them to call $num and then use the endCall tool. When an order is completed and submitted via submitOrder, say goodbye and use the endCall tool.")
                        
                        // Define ordering tools
                        put("tools", JSONArray().apply {
                            put(JSONObject().apply {
                                put("type", "function")
                                put("name", "searchMenu")
                                put("description", "Search the restaurant menu for items")
                                put("parameters", JSONObject().apply {
                                    put("type", "object")
                                    put("properties", JSONObject().apply {
                                        put("query", JSONObject().apply {
                                            put("type", "string")
                                        })
                                    })
                                })
                            })
                            put(JSONObject().apply {
                                put("type", "function")
                                put("name", "submitOrder")
                                put("description", "Submit the finalized order to the POS")
                                put("parameters", JSONObject().apply {
                                    put("type", "object")
                                    put("properties", JSONObject().apply {
                                        put("customerName", JSONObject().apply {
                                            put("type", "string")
                                        })
                                        put("items", JSONObject().apply {
                                            put("type", "string")
                                            put("description", "Stringified JSON array of items")
                                        })
                                    })
                                })
                            })
                            put(JSONObject().apply {
                                put("type", "function")
                                put("name", "endCall")
                                put("description", "End the phone call after an order is complete or if the customer is not making an order")
                            })
                            // Expand with other tools as needed
                        })
                    })
                }
                webSocket.send(sessionUpdate.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    when (json.optString("type")) {
                        "response.audio.delta" -> {
                            val base64Delta = json.optString("delta")
                            if (base64Delta.isNotEmpty()) {
                                val audioBytes = Base64.decode(base64Delta, Base64.NO_WRAP)
                                onAudioDelta(audioBytes)
                            }
                        }
                        "response.audio_transcript.done" -> {
                            val transcript = json.optString("transcript")
                            if (transcript.isNotEmpty()) {
                                onTranscript(callId, "ai", transcript)
                            }
                        }
                        "conversation.item.input_audio_transcription.completed" -> {
                            val transcript = json.optString("transcript")
                            if (transcript.isNotEmpty()) {
                                onTranscript(callId, "customer", transcript)
                            }
                        }
                        "response.function_call_arguments.done" -> {
                            val callId = json.optString("call_id")
                            val name = json.optString("name")
                            val arguments = json.optString("arguments")
                            if (callId.isNotEmpty() && name.isNotEmpty()) {
                                onAIToolCall(this@RealtimeClient.callId, callId, name, arguments)
                            }
                        }
                        "input_audio_buffer.speech_started" -> {
                            // Optionally handle barge-in by interrupting current AI response
                            val interrupt = JSONObject().apply {
                                put("type", "response.cancel")
                            }
                            webSocket.send(interrupt.toString())
                        }
                        "error" -> {
                            val msg = json.optJSONObject("error")?.optString("message") ?: "Unknown"
                            onError("OpenAI Error: $msg")
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                onError("WebSocket failure: ${t.message}")
                t.printStackTrace()
            }
        })
    }

    fun sendAudio(g711Bytes: ByteArray) {
        if (webSocket == null) return
        val base64Audio = Base64.encodeToString(g711Bytes, Base64.NO_WRAP)
        
        val event = JSONObject().apply {
            put("type", "input_audio_buffer.append")
            put("audio", base64Audio)
        }
        
        webSocket?.send(event.toString())
    }

    fun sendToolOutput(toolCallId: String, output: String) {
        if (webSocket == null) return
        
        val event = JSONObject().apply {
            put("type", "conversation.item.create")
            put("item", JSONObject().apply {
                put("type", "function_call_output")
                put("call_id", toolCallId)
                put("output", output)
            })
        }
        
        val createResponseEvent = JSONObject().apply {
            put("type", "response.create")
        }

        webSocket?.send(event.toString())
        webSocket?.send(createResponseEvent.toString())
    }

    fun disconnect() {
        try {
            webSocket?.close(1000, "Call Ended")
        } catch (e: Exception) {}
        webSocket = null
        client.dispatcher.executorService.shutdown()
    }
}
