import ExpoModulesCore
import Foundation

public class CallerIdListenerModule: Module {
  private var server: CallerIdServer?
  private var isRunning = false
  
  public func definition() -> ModuleDefinition {
    Name("CallerIdListener")

    Events("CallerIdIncomingCall", "CallerIdListenerStatus", "CallerIdRawPacket")

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
        }
      )
    }
    
    OnDestroy {
      self.server?.stop()
      self.server = nil
      self.isRunning = false
    }
    
    Function("start") { (port: Int?) in
      let bindPort = port ?? 5060
      self.server?.start(port: UInt16(bindPort))
    }
    
    Function("stop") {
      self.server?.stop()
      self.isRunning = false
    }
    
    Function("isRunning") {
      return self.isRunning
    }
  }
}
