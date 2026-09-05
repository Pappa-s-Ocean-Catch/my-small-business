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
        
        for line in lines {
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
            to = to + ";tag=pos-listener"
        }
        
        var response = "SIP/2.0 \(statusCode)\r\n"
        for via in vias {
            response += "\(via)\r\n"
        }
        response += "\(from)\r\n"
        response += "\(to)\r\n"
        response += "\(callId)\r\n"
        response += "\(cseq)\r\n"
        response += "Content-Length: 0\r\n\r\n"
        
        return response
    }
}
