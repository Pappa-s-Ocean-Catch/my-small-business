package expo.modules.calleridlistener

/**
 * Extracts Caller ID and Call-ID from SIP packets.
 */
object SipParser {

    data class SipResult(val callerNumber: String, val callId: String)

    fun parse(datagramContent: String): SipResult? {
        val lines = datagramContent.split("\r\n", "\n")
        if (lines.isEmpty()) return null
        
        // 1. Must be an INVITE request
        val requestLine = lines[0].trim()
        if (!requestLine.startsWith("INVITE ")) return null
        
        // 2. Parse headers (handling continuations)
        val headers = mutableMapOf<String, String>()
        var currentHeaderName: String? = null
        var currentHeaderValue = StringBuilder()

        for (i in 1 until lines.size) {
            val line = lines[i]
            if (line.isEmpty()) break // End of headers
            
            if (line.startsWith(" ") || line.startsWith("\t")) {
                // Continuation line
                if (currentHeaderName != null) {
                    currentHeaderValue.append(" ").append(line.trim())
                }
            } else {
                // New header
                if (currentHeaderName != null) {
                    headers[currentHeaderName!!.lowercase()] = currentHeaderValue.toString().trim()
                }
                val colonIndex = line.indexOf(':')
                if (colonIndex > 0) {
                    currentHeaderName = line.substring(0, colonIndex).trim()
                    currentHeaderValue = StringBuilder(line.substring(colonIndex + 1).trim())
                } else {
                    currentHeaderName = null
                }
            }
        }
        // Add the last header
        if (currentHeaderName != null) {
            headers[currentHeaderName!!.lowercase()] = currentHeaderValue.toString().trim()
        }

        // 3. Extract Call-ID
        val callId = headers["call-id"]
        
        // 4. Extract Identity
        val pAssertedIdentity = headers["p-asserted-identity"]
        val remotePartyId = headers["remote-party-id"]
        val from = headers["from"]

        val number = extractNumber(pAssertedIdentity)
            ?: extractNumber(remotePartyId)
            ?: extractNumber(from)
            ?: return null

        if (number.isBlank() || isAnonymous(number)) {
            return null
        }

        return SipResult(callerNumber = number, callId = callId ?: "")
    }

    private fun extractNumber(headerValue: String?): String? {
        if (headerValue == null) return null
        
        // Match <sip:NUMBER@domain> or sip:NUMBER@domain or <tel:NUMBER>
        val sipRegex = "<sip:([^@>]+)@".toRegex()
        val telRegex = "<tel:([^>]+)>".toRegex()
        val sipPlainRegex = "sip:([^@;]+)@".toRegex()

        var match = sipRegex.find(headerValue)
        if (match != null) return match.groupValues[1].trim()

        match = telRegex.find(headerValue)
        if (match != null) return match.groupValues[1].trim()

        match = sipPlainRegex.find(headerValue)
        if (match != null) return match.groupValues[1].trim()
        
        // Fallback: extract anything between sip: and @
        val sipIdx = headerValue.indexOf("sip:")
        if (sipIdx != -1) {
             val atIdx = headerValue.indexOf("@", sipIdx)
             if (atIdx != -1) {
                 return headerValue.substring(sipIdx + 4, atIdx).trim()
             }
        }

        return null
    }
    
    private fun isAnonymous(number: String): Boolean {
        val lower = number.lowercase()
        return lower == "anonymous" || lower == "private" || lower == "restricted" || lower == "unknown"
    }
}
