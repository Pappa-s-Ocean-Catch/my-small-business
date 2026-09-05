package expo.modules.calleridlistener

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class SipParserTest {

    @Test
    fun testParseValidInvite() {
        val invite = """
            INVITE sip:5060@192.168.1.100 SIP/2.0
            Via: SIP/2.0/UDP 192.168.1.50:5060;branch=z9hG4bK1234
            From: "John Doe" <sip:+61411222333@domain.com>;tag=5678
            Call-ID: abcdef123456
            CSeq: 1 INVITE
            Contact: <sip:+61411222333@192.168.1.50:5060>
            Max-Forwards: 70
            
            v=0
            o=- 123456 123456 IN IP4 192.168.1.50
            s=session
        """.trimIndent()
        
        val result = SipParser.parse(invite)
        assertNotNull(result)
        assertEquals("+61411222333", result.callerNumber)
        assertEquals("abcdef123456", result.callId)
    }

    @Test
    fun testHeaderPriority() {
        val invite = """
            INVITE sip:5060@192.168.1.100 SIP/2.0
            P-Asserted-Identity: <sip:0299991111@domain.com>
            Remote-Party-ID: <sip:0299992222@domain.com>
            From: <sip:0299993333@domain.com>
            Call-ID: test-priority
        """.trimIndent()
        
        val result = SipParser.parse(invite)
        assertNotNull(result)
        // P-Asserted-Identity should take precedence
        assertEquals("0299991111", result.callerNumber)
        assertEquals("test-priority", result.callId)
    }

    @Test
    fun testAnonymousRejection() {
        val invite = """
            INVITE sip:5060@192.168.1.100 SIP/2.0
            From: <sip:Anonymous@domain.com>
            Call-ID: anon-call
        """.trimIndent()
        
        val result = SipParser.parse(invite)
        assertNull(result, "Anonymous calls should be rejected/ignored")
    }

    @Test
    fun testNonInviteRejection() {
        val options = """
            OPTIONS sip:5060@192.168.1.100 SIP/2.0
            From: <sip:0299993333@domain.com>
            Call-ID: options-call
        """.trimIndent()
        
        val result = SipParser.parse(options)
        assertNull(result, "Non-INVITE requests should be rejected")
    }

    @Test
    fun testContinuationLines() {
        val invite = """
            INVITE sip:5060@192.168.1.100 SIP/2.0
            From: 
              <sip:+61411222333@domain.com>
            Call-ID: continuation-test
        """.trimIndent()
        
        val result = SipParser.parse(invite)
        assertNotNull(result)
        assertEquals("+61411222333", result.callerNumber)
    }
}
