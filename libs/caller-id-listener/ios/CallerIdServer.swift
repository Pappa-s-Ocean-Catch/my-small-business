import Foundation
import Network

class CallerIdServer {
    private var listener: NWListener?
    private let onIncomingCall: (String, String) -> Void
    private let onStatusChange: (String, Int?, String?) -> Void
    private let onRawPacket: (String) -> Void
    private let onAITranscript: (String, String, String) -> Void
    private let onAIToolCall: (String, String, String, String) -> Void
    private let onError: (String) -> Void
    
    // Call-ID cache for deduplication. Value is expiration timestamp.
    private var callIdCache: [String: TimeInterval] = [:]
    private let cacheQueue = DispatchQueue(label: "com.mysmallbusiness.callerid.cache")
    private let ttlSeconds: TimeInterval = 5 * 60 // 5 minutes
    private let maxCacheSize = 1000
    private var currentSipResponses: [String] = []
    
    private var aiCallAssistantEnabled: Bool = false
    private var ephemeralToken: String? = nil
    private var fallbackNumber: String? = nil
    private var activeSessions: [String: CallSession] = [:]
    
    init(onIncomingCall: @escaping (String, String) -> Void,
         onStatusChange: @escaping (String, Int?, String?) -> Void,
         onRawPacket: @escaping (String) -> Void,
         onAITranscript: @escaping (String, String, String) -> Void,
         onAIToolCall: @escaping (String, String, String, String) -> Void,
         onError: @escaping (String) -> Void) {
        self.onIncomingCall = onIncomingCall
        self.onStatusChange = onStatusChange
        self.onRawPacket = onRawPacket
        self.onAITranscript = onAITranscript
        self.onAIToolCall = onAIToolCall
        self.onError = onError
    }
    
    func start(port: UInt16, sipResponses: [String] = [], aiCallAssistantEnabled: Bool = false, ephemeralToken: String? = nil, fallbackNumber: String? = nil) {
        self.currentSipResponses = sipResponses
        self.aiCallAssistantEnabled = aiCallAssistantEnabled
        self.ephemeralToken = ephemeralToken
        self.fallbackNumber = fallbackNumber
        if listener?.state == .ready && listener?.port?.rawValue == port {
            return // Already running on this port
        }
        stop()
        
        onStatusChange("starting", Int(port), nil)
        
        guard let nwPort = NWEndpoint.Port(rawValue: port) else {
            onStatusChange("error", Int(port), "Invalid port")
            return
        }
        
        let parameters = NWParameters.udp
        parameters.allowLocalEndpointReuse = true
        
        do {
            listener = try NWListener(using: parameters, on: nwPort)
        } catch {
            onStatusChange("error", Int(port), error.localizedDescription)
            return
        }
        
        listener?.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                self?.onStatusChange("listening", Int(port), nil)
            case .failed(let error):
                self?.onStatusChange("error", Int(port), error.localizedDescription)
                self?.stop()
            case .cancelled:
                self?.onStatusChange("stopped", nil, nil)
            default:
                break
            }
        }
        
        listener?.newConnectionHandler = { [weak self] connection in
            connection.start(queue: .global())
            self?.receive(on: connection)
        }
        
        listener?.start(queue: .global())
    }
    
    func stop() {
        listener?.cancel()
        listener = nil
        onStatusChange("stopped", nil, nil)
        
        for session in activeSessions.values {
            session.stop()
        }
        activeSessions.removeAll()
    }
    
    private func receive(on connection: NWConnection) {
        connection.receiveMessage { [weak self] content, context, isComplete, error in
            if let data = content, let text = String(data: data, encoding: .utf8) {
                self?.handleDatagram(text, connection: connection)
            } else {
                connection.cancel()
            }
        }
    }
    
    private func handleDatagram(_ content: String, connection: NWConnection) {
        DispatchQueue.main.async {
            self.onRawPacket(content)
        }
        
        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
        let isInvite = trimmedContent.hasPrefix("INVITE")
        let isCancel = trimmedContent.hasPrefix("CANCEL")
        let isBye = trimmedContent.hasPrefix("BYE")
        let isAck = trimmedContent.hasPrefix("ACK")
        
        guard let result = SipParser.parse(datagramContent: content) else { return }
        
        if aiCallAssistantEnabled, let token = ephemeralToken {
            let callId = result.callId
            let callerNumber = result.callerNumber
            
            let session: CallSession
            if let existingSession = activeSessions[callId] {
                session = existingSession
            } else {
                session = CallSession(
                    callId: callId,
                    callerNumber: callerNumber,
                    ephemeralToken: token,
                    fallbackNumber: fallbackNumber,
                    onAITranscript: onAITranscript,
                    onAIToolCall: onAIToolCall,
                    onError: onError,
                    onStatusChange: { [weak self] (state: String) in
                        if state == "TERMINATED" {
                            self?.activeSessions.removeValue(forKey: callId)
                        }
                    }
                )
                activeSessions[callId] = session
            }
            
            if isInvite {
                session.initialInviteContent = content
                session.sipConnection = connection
                
                session.parseSdp(content)
                session.startRtpAndRealtime()
                
                let localPort = session.getLocalRtpPort()
                let sdp = """
                v=0\r
                o=- 0 0 IN IP4 0.0.0.0\r
                s=session\r
                c=IN IP4 0.0.0.0\r
                t=0 0\r
                m=audio \(localPort) RTP/AVP 0\r
                a=rtpmap:0 PCMU/8000\r
                
                """
                
                if let okResponse = SipParser.build200OkWithSdp(requestContent: content, sdpBody: sdp),
                   let data = okResponse.data(using: String.Encoding.utf8) {
                    connection.send(content: data, completion: .contentProcessed({ _ in }))
                }
                
                DispatchQueue.main.async {
                    self.onIncomingCall(callerNumber, callId)
                }
            } else if isCancel || isBye {
                session.stop()
                if let okResponse = SipParser.buildResponse(statusCode: "200 OK", requestContent: content),
                   let data = okResponse.data(using: String.Encoding.utf8) {
                    connection.send(content: data, completion: .contentProcessed({ _ in }))
                }
            } else if isAck {
                // Connection established
            }
            return
        }
        
        if isInvite && !self.currentSipResponses.isEmpty {
            for responseString in self.currentSipResponses {
                if let sipResponse = SipParser.buildResponse(statusCode: responseString, requestContent: content),
                   let data = sipResponse.data(using: String.Encoding.utf8) {
                    connection.send(content: data, completion: .contentProcessed({ _ in
                        // We do not cancel here, wait for the loop to finish.
                    }))
                }
            }
            // Delay closing slightly to allow packets to send
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.1) {
                connection.cancel()
            }
        } else if isCancel {
            if let sipResponse = SipParser.buildResponse(statusCode: "200 OK", requestContent: content),
               let data = sipResponse.data(using: String.Encoding.utf8) {
                connection.send(content: data, completion: .contentProcessed({ _ in }))
            }
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.1) {
                connection.cancel()
            }
        } else {
            connection.cancel()
        }
        
        cacheQueue.async { [weak self] in
            guard let self = self else { return }
            
            let now = Date().timeIntervalSince1970
            self.pruneCache(now: now)
            
            let callId = result.callId
            if !callId.isEmpty {
                if self.callIdCache.keys.contains(callId) {
                    // Deduplicate
                    return
                }
                if self.callIdCache.count >= self.maxCacheSize {
                    // Prevent boundless growth, remove oldest
                    if let oldest = self.callIdCache.min(by: { $0.value < $1.value }) {
                        self.callIdCache.removeValue(forKey: oldest.key)
                    }
                }
                self.callIdCache[callId] = now + self.ttlSeconds
            }
            
            DispatchQueue.main.async {
                self.onIncomingCall(result.callerNumber, callId)
            }
        }
    }
    
    func sendToolOutput(callId: String, toolCallId: String, output: String) {
        activeSessions[callId]?.sendToolOutput(toolCallId: toolCallId, output: output)
    }
    
    func endCall(callId: String) {
        guard let session = activeSessions[callId] else { return }
        
        if !session.initialInviteContent.isEmpty, let connection = session.sipConnection {
            if let byeRequest = SipParser.buildBye(requestContent: session.initialInviteContent),
               let data = byeRequest.data(using: .utf8) {
                connection.send(content: data, completion: .contentProcessed({ _ in }))
            }
        }
        
        session.stop()
        activeSessions.removeValue(forKey: callId)
    }
    
    private func pruneCache(now: TimeInterval) {
        callIdCache = callIdCache.filter { $0.value >= now }
    }
}
