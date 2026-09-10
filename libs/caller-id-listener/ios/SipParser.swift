import Foundation

struct SipResult {
    let callerNumber: String
    let callId: String
}

class SipParser {
    static func parse(datagramContent: String) -> SipResult? {
        let lines = datagramContent.components(separatedBy: .newlines)
        if lines.isEmpty { return nil }
        
        // 1. Must be an INVITE request
        let requestLine = lines[0].trimmingCharacters(in: .whitespaces)
        if !requestLine.hasPrefix("INVITE ") { return nil }
        
        // 2. Parse headers (handling continuations)
        var headers: [String: String] = [:]
        var currentHeaderName: String? = nil
        var currentHeaderValue = ""
        
        for i in 1..<lines.count {
            let line = lines[i]
            if line.isEmpty { break } // End of headers
            
            if line.hasPrefix(" ") || line.hasPrefix("\t") {
                // Continuation line
                if currentHeaderName != nil {
                    currentHeaderValue += " " + line.trimmingCharacters(in: .whitespaces)
                }
            } else {
                // New header
                if let name = currentHeaderName {
                    headers[name.lowercased()] = currentHeaderValue.trimmingCharacters(in: .whitespaces)
                }
                if let colonIndex = line.firstIndex(of: ":") {
                    currentHeaderName = String(line[..<colonIndex]).trimmingCharacters(in: .whitespaces)
                    let afterColon = line.index(after: colonIndex)
                    currentHeaderValue = String(line[afterColon...]).trimmingCharacters(in: .whitespaces)
                } else {
                    currentHeaderName = nil
                }
            }
        }
        // Add the last header
        if let name = currentHeaderName {
            headers[name.lowercased()] = currentHeaderValue.trimmingCharacters(in: .whitespaces)
        }
        
        // 3. Extract Call-ID
        let callId = headers["call-id"] ?? ""
        
        // 4. Extract Identity
        let pAssertedIdentity = headers["p-asserted-identity"]
        let remotePartyId = headers["remote-party-id"]
        let from = headers["from"]
        
        guard let number = extractNumber(pAssertedIdentity)
            ?? extractNumber(remotePartyId)
            ?? extractNumber(from) else {
            return nil
        }
        
        if number.trimmingCharacters(in: .whitespaces).isEmpty || isAnonymous(number) {
            return nil
        }
        
        return SipResult(callerNumber: number, callId: callId)
    }
    
    private static func extractNumber(_ headerValue: String?) -> String? {
        guard let headerValue = headerValue else { return nil }
        
        let patterns = [
            "<sip:([^@>]+)@",
            "<tel:([^>]+)>",
            "sip:([^@;]+)@"
        ]
        
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let nsString = headerValue as NSString
                if let match = regex.firstMatch(in: headerValue, options: [], range: NSRange(location: 0, length: nsString.length)) {
                    if match.numberOfRanges > 1 {
                        let range = match.range(at: 1)
                        return nsString.substring(with: range).trimmingCharacters(in: .whitespaces)
                    }
                }
            }
        }
        
        // Fallback: extract anything between sip: and @
        if let sipRange = headerValue.range(of: "sip:") {
            let start = sipRange.upperBound
            if let atRange = headerValue.range(of: "@", range: start..<headerValue.endIndex) {
                let end = atRange.lowerBound
                return String(headerValue[start..<end]).trimmingCharacters(in: .whitespaces)
            }
        }
        
        return nil
    }
    
    private static func isAnonymous(_ number: String) -> Bool {
        let lower = number.lowercased()
        return lower == "anonymous" || lower == "private" || lower == "restricted" || lower == "unknown"
    }
    
    static func buildResponse(statusCode: String, requestContent: String) -> String? {
        let lines = requestContent.components(separatedBy: "\n").map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "\r")) }
        if lines.isEmpty { return nil }
        
        var vias: [String] = []
        var from = ""
        var to = ""
        var callId = ""
        var cseq = ""
        
        for rawLine in lines {
            let line = rawLine.replacingOccurrences(of: "\r", with: "").replacingOccurrences(of: "\n", with: "")
            let lower = line.lowercased()
            if lower.hasPrefix("via:") { vias.append(line) }
            else if lower.hasPrefix("from:") && from.isEmpty { from = line }
            else if lower.hasPrefix("to:") && to.isEmpty { to = line }
            else if lower.hasPrefix("call-id:") && callId.isEmpty { callId = line }
            else if lower.hasPrefix("cseq:") && cseq.isEmpty { cseq = line }
        }
        
        if vias.isEmpty || from.isEmpty || to.isEmpty || callId.isEmpty || cseq.isEmpty {
            return nil
        }
        
        if !statusCode.hasPrefix("100") && !to.lowercased().contains("tag=") {
            to += ";tag=pos-listener"
        }
        
        var response = "SIP/2.0 \(statusCode)\r\n"
        for via in vias {
            response += "\(via)\r\n"
        }
        response += "\(from)\r\n"
        response += "\(to)\r\n"
        response += "\(callId)\r\n"
        response += "\(cseq)\r\n"
        response += "Contact: <sip:pos-listener@127.0.0.1:5060>\r\n"
        response += "Content-Length: 0\r\n\r\n"
        
        return response
    }

    static func build200OkWithSdp(requestContent: String, sdpBody: String) -> String? {
        let lines = requestContent.components(separatedBy: .newlines)
        if lines.isEmpty { return nil }
        
        var vias: [String] = []
        var from = ""
        var to = ""
        var callId = ""
        var cseq = ""
        
        for rawLine in lines {
            let line = rawLine.trimmingCharacters(in: CharacterSet(charactersIn: "\r\n"))
            let lower = line.lowercased()
            if lower.hasPrefix("via:") { vias.append(line) }
            else if lower.hasPrefix("from:") && from.isEmpty { from = line }
            else if lower.hasPrefix("to:") && to.isEmpty { to = line }
            else if lower.hasPrefix("call-id:") && callId.isEmpty { callId = line }
            else if lower.hasPrefix("cseq:") && cseq.isEmpty { cseq = line }
        }
        
        if vias.isEmpty || from.isEmpty || to.isEmpty || callId.isEmpty || cseq.isEmpty {
            return nil
        }
        
        if !to.lowercased().contains("tag=") {
            to += ";tag=pos-listener"
        }
        
        var sb: [String] = []
        sb.append("SIP/2.0 200 OK\r\n")
        for via in vias {
            sb.append(via + "\r\n")
        }
        sb.append(from + "\r\n")
        sb.append(to + "\r\n")
        sb.append(callId + "\r\n")
        sb.append(cseq + "\r\n")
        sb.append("Contact: <sip:pos-listener@127.0.0.1:5060>\r\n")
        sb.append("Content-Type: application/sdp\r\n")
        
        let sdpBytesLength = sdpBody.data(using: .utf8)?.count ?? 0
        sb.append("Content-Length: \(sdpBytesLength)\r\n\r\n")
        sb.append(sdpBody)
        
        return sb.joined(separator: "")
    }
    
    static func buildBye(requestContent: String) -> String? {
        let lines = requestContent.components(separatedBy: .newlines)
        if lines.isEmpty { return nil }
        
        let requestLine = lines[0]
        let parts = requestLine.split(separator: " ")
        if parts.count < 3 { return nil }
        let requestUri = String(parts[1])
        
        var from = ""
        var to = ""
        var callId = ""
        var cseqNumber = 1
        var via = ""
        
        for rawLine in lines {
            let line = rawLine.trimmingCharacters(in: CharacterSet(charactersIn: "\r\n"))
            let lower = line.lowercased()
            if lower.hasPrefix("via:") && via.isEmpty { via = line }
            else if lower.hasPrefix("from:") && from.isEmpty { from = line }
            else if lower.hasPrefix("to:") && to.isEmpty { to = line }
            else if lower.hasPrefix("call-id:") && callId.isEmpty { callId = line }
            else if lower.hasPrefix("cseq:") {
                let cseqParts = line.components(separatedBy: " ")
                if cseqParts.count >= 2, let num = Int(cseqParts[1]) {
                    cseqNumber = num
                }
            }
        }
        
        if from.isEmpty || to.isEmpty || callId.isEmpty { return nil }
        
        // Ensure "To" in original becomes "From" in BYE, and "From" becomes "To"
        var newFrom = ""
        if let toRange = to.range(of: "To:", options: .caseInsensitive) {
            newFrom = to.replacingCharacters(in: toRange, with: "From:") + ";tag=pos-listener"
        }
        
        var newTo = ""
        if let fromRange = from.range(of: "From:", options: .caseInsensitive) {
            newTo = from.replacingCharacters(in: fromRange, with: "To:")
        }
        
        let newCseq = "CSeq: \(cseqNumber + 1) BYE"
        
        var sb: [String] = []
        sb.append("BYE \(requestUri) SIP/2.0\r\n")
        if !via.isEmpty { sb.append("\(via)\r\n") }
        sb.append("\(newFrom)\r\n")
        sb.append("\(newTo)\r\n")
        sb.append("\(callId)\r\n")
        sb.append("\(newCseq)\r\n")
        sb.append("Max-Forwards: 70\r\n")
        sb.append("Content-Length: 0\r\n\r\n")
        
        return sb.joined(separator: "")
    }
}
