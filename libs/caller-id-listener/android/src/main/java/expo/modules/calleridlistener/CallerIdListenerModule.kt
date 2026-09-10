package expo.modules.calleridlistener

import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallerIdListenerModule : Module() {

    private var server: CallerIdServer? = null
    private var isRunning = false
    private var currentPort = 5060

    override fun definition() = ModuleDefinition {
        Name("CallerIdListener")

        Events("CallerIdIncomingCall", "CallerIdListenerStatus", "CallerIdRawPacket", "CallerIdAITranscript", "CallerIdAIToolCall", "CallerIdError")

        OnCreate {
            server = CallerIdServer(
                onIncomingCall = { callerNumber, callId ->
                    val payload = Bundle().apply {
                        putString("phoneNumber", callerNumber)
                        if (callId.isNotEmpty()) {
                            putString("callId", callId)
                        }
                        putDouble("timestamp", System.currentTimeMillis().toDouble())
                    }
                    sendEvent("CallerIdIncomingCall", payload)
                },
                onStatusChange = { state, port, message ->
                    val payload = Bundle().apply {
                        putString("state", state)
                        if (port != null) putInt("port", port)
                        if (message != null) putString("message", message)
                    }
                    sendEvent("CallerIdListenerStatus", payload)
                    if (state == "listening") isRunning = true
                    if (state == "stopped" || state == "error") isRunning = false
                },
                onRawPacket = { content ->
                    val payload = Bundle().apply {
                        putString("content", content)
                    }
                    sendEvent("CallerIdRawPacket", payload)
                },
                onAITranscript = { callId, role, text ->
                    val payload = Bundle().apply {
                        putString("callId", callId)
                        putString("role", role)
                        putString("text", text)
                    }
                    sendEvent("CallerIdAITranscript", payload)
                },
                onAIToolCall = { callId, toolCallId, name, arguments ->
                    val payload = Bundle().apply {
                        putString("callId", callId)
                        putString("toolCallId", toolCallId)
                        putString("name", name)
                        putString("arguments", arguments)
                    }
                    sendEvent("CallerIdAIToolCall", payload)
                },
                onError = { message ->
                    val payload = Bundle().apply {
                        putString("message", message)
                    }
                    sendEvent("CallerIdError", payload)
                }
            )
        }

        OnDestroy {
            server?.stop()
            server = null
            isRunning = false
        }

        Function("start") { port: Int?, sipResponses: List<String>?, aiCallAssistantEnabled: Boolean?, ephemeralToken: String?, fallbackNumber: String? ->
            val bindPort = port ?: 5060
            currentPort = bindPort
            server?.start(bindPort, sipResponses ?: emptyList(), aiCallAssistantEnabled ?: false, ephemeralToken, fallbackNumber)
        }

        Function("stop") {
            server?.stop()
            isRunning = false
        }
        
        Function("sendAIToolOutput") { callId: String, toolCallId: String, output: String ->
            server?.sendToolOutput(callId, toolCallId, output)
        }

        Function("endCall") { callId: String ->
            server?.endCall(callId)
        }

        Function("isRunning") {
            return@Function isRunning
        }
    }
}
