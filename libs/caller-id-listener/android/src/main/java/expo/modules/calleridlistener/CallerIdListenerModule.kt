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

        Events("CallerIdIncomingCall", "CallerIdListenerStatus")

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
                }
            )
        }

        OnDestroy {
            server?.stop()
            server = null
            isRunning = false
        }

        Function("start") { port: Int? ->
            val bindPort = port ?: 5060
            currentPort = bindPort
            server?.start(bindPort)
        }

        Function("stop") {
            server?.stop()
            isRunning = false
        }

        Function("isRunning") {
            return@Function isRunning
        }
    }
}
