import ExpoModulesCore
import Foundation

public class CallerIdListenerModule: Module {
  private var server: CallerIdServer?
  private var isRunning = false
  
  public func definition() -> ModuleDefinition {
    Name("CallerIdListener")

    Events("CallerIdIncomingCall", "CallerIdListenerStatus", "CallerIdRawPacket", "CallerIdAITranscript", "CallerIdAIToolCall", "CallerIdError")

    OnCreate {
      self.server = CallerIdServer(
        onIncomingCall: { [weak self] callerNumber, callId in
          var payload: [String: Any] = [
            "phoneNumber": callerNumber,
            "timestamp": Date().timeIntervalSince1970 * 1000
          ]
          if !callId.isEmpty {
            payload["callId"] = callId
          }
          self?.sendEvent("CallerIdIncomingCall", payload)
        },
        onStatusChange: { [weak self] state, port, message in
          var payload: [String: Any] = ["state": state]
          if let port = port { payload["port"] = port }
          if let message = message { payload["message"] = message }
          
          self?.sendEvent("CallerIdListenerStatus", payload)
          
          if state == "listening" { self?.isRunning = true }
          if state == "stopped" || state == "error" { self?.isRunning = false }
        },
        onRawPacket: { [weak self] content in
          self?.sendEvent("CallerIdRawPacket", ["content": content])
        },
        onAITranscript: { [weak self] callId, role, text in
          var payload: [String: Any] = [
            "callId": callId,
            "role": role,
            "text": text
          ]
          self?.sendEvent("CallerIdAITranscript", payload)
        },
        onAIToolCall: { [weak self] callId, toolCallId, name, arguments in
          var payload: [String: Any] = [
            "callId": callId,
            "toolCallId": toolCallId,
            "name": name,
            "arguments": arguments
          ]
          self?.sendEvent("CallerIdAIToolCall", payload)
        },
        onError: { [weak self] message in
          self?.sendEvent("CallerIdError", ["message": message])
        }
      )
    }
    
    OnDestroy {
      self.server?.stop()
      self.server = nil
      self.isRunning = false
    }
    
    Function("start") { (port: Int?, sipResponses: [String]?, aiCallAssistantEnabled: Bool?, ephemeralToken: String?, fallbackNumber: String?) in
      let bindPort = UInt16(port ?? 5060)
      self.server?.start(port: bindPort, sipResponses: sipResponses ?? [], aiCallAssistantEnabled: aiCallAssistantEnabled ?? false, ephemeralToken: ephemeralToken, fallbackNumber: fallbackNumber)
    }
    
    Function("stop") {
      self.server?.stop()
      self.isRunning = false
    }
    
    Function("isRunning") {
      return self.isRunning
    }
    
    Function("sendAIToolOutput") { (callId: String, toolCallId: String, output: String) in
      self.server?.sendToolOutput(callId: callId, toolCallId: toolCallId, output: output)
    }
    
    Function("endCall") { (callId: String) in
      self.server?.endCall(callId: callId)
    }
  }
}
