import Foundation
import Network

class CallerIdServer {
    private var listener: NWListener?
    private let onIncomingCall: (String, String) -> Void
    private let onStatusChange: (String, Int?, String?) -> Void
    private let onRawPacket: (String) -> Void
    
    // Call-ID cache for deduplication. Value is expiration timestamp.
    private var callIdCache: [String: TimeInterval] = [:]
    private let cacheQueue = DispatchQueue(label: "com.mysmallbusiness.callerid.cache")
    private let ttlSeconds: TimeInterval = 5 * 60 // 5 minutes
    private let maxCacheSize = 1000
    private var currentSipResponses: [String] = []
    
    init(onIncomingCall: @escaping (String, String) -> Void,
         onStatusChange: @escaping (String, Int?, String?) -> Void,
         onRawPacket: @escaping (String) -> Void) {
        self.onIncomingCall = onIncomingCall
        self.onStatusChange = onStatusChange
        self.onRawPacket = onRawPacket
    }
    
    func start(port: UInt16, sipResponses: [String] = []) {
        self.currentSipResponses = sipResponses
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
        
        if isInvite && !self.currentSipResponses.isEmpty {
            for responseString in self.currentSipResponses {
                if let sipResponse = SipParser.buildResponse(statusCode: responseString, requestContent: content),
                   let data = sipResponse.data(using: .utf8) {
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
               let data = sipResponse.data(using: .utf8) {
                connection.send(content: data, completion: .contentProcessed({ _ in }))
            }
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.1) {
                connection.cancel()
            }
        } else {
            connection.cancel()
        }
        guard let result = SipParser.parse(datagramContent: content) else { return }
        
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
    
    private func pruneCache(now: TimeInterval) {
        callIdCache = callIdCache.filter { $0.value >= now }
    }
}
