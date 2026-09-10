import Foundation
import Network

class RtpSession {
    private let remoteIp: String
    private let remotePort: UInt16
    private let onAudioReceived: (Data) -> Void
    
    private var listener: NWListener?
    private var connection: NWConnection?
    
    let localPort: UInt16
    
    private let ssrc = UInt32.random(in: 0...UInt32.max)
    private var sequenceNumber = UInt16.random(in: 0...UInt16.max)
    private var timestamp = UInt32.random(in: 0...UInt32.max)
    private let queue = DispatchQueue(label: "com.mysmallbusiness.callerid.rtp")
    
    init(remoteIp: String, remotePort: UInt16, onAudioReceived: @escaping (Data) -> Void) {
        self.remoteIp = remoteIp
        self.remotePort = remotePort
        self.onAudioReceived = onAudioReceived
        
        let parameters = NWParameters.udp
        parameters.allowLocalEndpointReuse = true
        
        do {
            listener = try NWListener(using: parameters, on: .any)
        } catch {
            listener = nil
        }
        
        localPort = listener?.port?.rawValue ?? 0
    }
    
    func start() {
        listener?.newConnectionHandler = { [weak self] newConnection in
            self?.connection = newConnection
            newConnection.start(queue: self?.queue ?? .global())
            self?.receive(on: newConnection)
        }
        listener?.start(queue: queue)
    }
    
    private func receive(on connection: NWConnection) {
        connection.receiveMessage { [weak self] content, context, isComplete, error in
            guard let self = self else { return }
            if let data = content, data.count > 12 {
                let v = (data[0] >> 6) & 0x03
                if v == 2 {
                    let cc = Int(data[0] & 0x0F)
                    let pt = data[1] & 0x7F
                    if pt == 0 { // PCMU
                        let headerLength = 12 + (cc * 4)
                        if data.count > headerLength {
                            let payload = data.subdata(in: headerLength..<data.count)
                            self.onAudioReceived(payload)
                        }
                    }
                }
            }
            if error == nil && self.listener != nil {
                self.receive(on: connection)
            }
        }
    }
    
    func sendAudio(pcmuBytes: Data) {
        guard let connection = self.connection else { return }
        
        queue.async {
            var offset = 0
            while offset < pcmuBytes.count {
                let chunkSize = min(160, pcmuBytes.count - offset)
                var packetData = Data(capacity: 12 + chunkSize)
                
                // Header
                packetData.append(0x80) // V=2, P=0, X=0, CC=0
                packetData.append(0x00) // M=0, PT=0 (PCMU)
                
                let seqBytes = withUnsafeBytes(of: self.sequenceNumber.bigEndian) { Data($0) }
                packetData.append(seqBytes)
                self.sequenceNumber &+= 1
                
                let tsBytes = withUnsafeBytes(of: self.timestamp.bigEndian) { Data($0) }
                packetData.append(tsBytes)
                self.timestamp &+= UInt32(chunkSize)
                
                let ssrcBytes = withUnsafeBytes(of: self.ssrc.bigEndian) { Data($0) }
                packetData.append(ssrcBytes)
                
                // Payload
                let chunk = pcmuBytes.subdata(in: offset..<(offset + chunkSize))
                packetData.append(chunk)
                
                connection.send(content: packetData, completion: .contentProcessed({ _ in }))
                
                offset += chunkSize
            }
        }
    }
    
    func stop() {
        listener?.cancel()
        listener = nil
        connection?.cancel()
        connection = nil
    }
}
