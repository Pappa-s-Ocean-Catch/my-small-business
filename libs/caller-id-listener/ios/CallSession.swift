import Foundation
import Network

class CallSession {
    let callId: String
    let callerNumber: String
    private let ephemeralToken: String
    private let fallbackNumber: String?
    private let onAITranscript: (String, String, String) -> Void
    private let onAIToolCall: (String, String, String, String) -> Void
    private let onError: (String) -> Void
    private let onStatusChange: (String) -> Void
    
    var state = "INVITE_RECEIVED"
    
    private var rtpSession: RtpSession?
    private var realtimeClient: RealtimeClient?
    
    var remoteIp: String = ""
    var remotePort: UInt16 = 0
    
    var initialInviteContent: String = ""
    var sipConnection: NWConnection? = nil
    
    init(callId: String,
         callerNumber: String,
         ephemeralToken: String,
         fallbackNumber: String?,
         onAITranscript: @escaping (String, String, String) -> Void,
         onAIToolCall: @escaping (String, String, String, String) -> Void,
         onError: @escaping (String) -> Void,
         onStatusChange: @escaping (String) -> Void) {
        self.callId = callId
        self.callerNumber = callerNumber
        self.ephemeralToken = ephemeralToken
        self.fallbackNumber = fallbackNumber
        self.onAITranscript = onAITranscript
        self.onAIToolCall = onAIToolCall
        self.onError = onError
        self.onStatusChange = onStatusChange
    }
    
    func parseSdp(_ content: String) {
        let lines = content.components(separatedBy: .newlines)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("c=IN IP4 ") {
                remoteIp = String(trimmed.dropFirst("c=IN IP4 ".count))
            } else if trimmed.hasPrefix("m=audio ") {
                let parts = trimmed.dropFirst("m=audio ".count).components(separatedBy: " ")
                if let first = parts.first, let port = UInt16(first) {
                    remotePort = port
                }
            }
        }
    }
    
    func startRtpAndRealtime() {
        guard !remoteIp.isEmpty, remotePort != 0 else { return }
        
        realtimeClient = RealtimeClient(
            ephemeralToken: ephemeralToken,
            fallbackNumber: fallbackNumber,
            onAudioDelta: { [weak self] audioBytes in
                self?.rtpSession?.sendAudio(pcmuBytes: audioBytes)
            },
            onTranscript: onAITranscript,
            onAIToolCall: onAIToolCall,
            onError: { [weak self] msg in
                self?.onError("Call \(self?.callId ?? ""): \(msg)")
            }
        )
        
        rtpSession = RtpSession(remoteIp: remoteIp, remotePort: remotePort) { [weak self] audioBytes in
            self?.realtimeClient?.sendAudio(g711Bytes: audioBytes)
        }
        
        rtpSession?.start()
        realtimeClient?.connect(callId: callId)
        
        state = "ACTIVE"
        onStatusChange("ACTIVE")
    }
    
    func getLocalRtpPort() -> UInt16 {
        return rtpSession?.localPort ?? 0
    }
    
    func sendToolOutput(toolCallId: String, output: String) {
        realtimeClient?.sendToolOutput(toolCallId: toolCallId, output: output)
    }
    
    func stop() {
        state = "TERMINATED"
        rtpSession?.stop()
        realtimeClient?.disconnect()
        onStatusChange("TERMINATED")
    }
}
