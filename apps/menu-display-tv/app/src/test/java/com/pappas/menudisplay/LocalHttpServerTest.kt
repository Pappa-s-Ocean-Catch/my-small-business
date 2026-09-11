package com.pappas.menudisplay

import java.net.Socket
import org.junit.Assert.*
import org.junit.Test

class LocalHttpServerTest {
    private fun request(server: LocalHttpServer, request: String): String =
        Socket("127.0.0.1", server.port).use { socket ->
            socket.soTimeout = 3000
            socket.getOutputStream().write(request.toByteArray())
            socket.getOutputStream().flush()
            socket.getInputStream().bufferedReader().readText()
        }

    @Test fun authenticatesBeforeReadingBodyAndDoesNotCallUpload() {
        var uploads = 0
        LocalHttpServer("123456", "page".toByteArray(), { _, _, _ -> uploads++; "ok" }, {}).use { server ->
            server.start(0)
            val result = request(server, "POST /upload HTTP/1.1\r\nHost: localhost\r\nContent-Length: 100\r\n\r\n")
            assertTrue(result.startsWith("HTTP/1.1 401"))
            assertEquals(0, uploads)
        }
    }
    @Test fun acceptsPairedUploadAndDecodesFilename() {
        var name = ""
        var bytes = ""
        LocalHttpServer("123456", "page".toByteArray(), { input, length, filename ->
            name = filename
            bytes = input.readNBytes(length.toInt()).toString(Charsets.UTF_8)
            "saved"
        }, {}).use { server ->
            server.start(0)
            val result = request(server, "POST /upload HTTP/1.1\r\nHost: localhost\r\nX-Pairing-Code: 123456\r\nX-Filename: Lunch%20menu.png\r\nContent-Length: 3\r\n\r\nabc")
            assertTrue(result.startsWith("HTTP/1.1 200"))
            assertEquals("Lunch menu.png", name)
            assertEquals("abc", bytes)
        }
    }
    @Test fun rejectsOversizedAndCrossOriginUploads() {
        LocalHttpServer("123456", byteArrayOf(), { _, _, _ -> error("must not upload") }, {}).use { server ->
            server.start(0)
            assertTrue(request(server, "POST /upload HTTP/1.1\r\nHost: localhost\r\nX-Pairing-Code: 123456\r\nContent-Length: 99999999\r\n\r\n").startsWith("HTTP/1.1 413"))
            assertTrue(request(server, "POST /upload HTTP/1.1\r\nHost: localhost\r\nOrigin: http://evil.test\r\nX-Pairing-Code: 123456\r\nContent-Length: 3\r\n\r\nabc").startsWith("HTTP/1.1 403"))
        }
    }
    @Test fun rejectsDuplicateLengthAndLocksOutRepeatedWrongCodes() {
        LocalHttpServer("123456", byteArrayOf(), { _, _, _ -> "ok" }, {}).use { server ->
            server.start(0)
            val duplicate = "POST /upload HTTP/1.1\r\nHost: localhost\r\nContent-Length: 3\r\nContent-Length: 4\r\n\r\n"
            assertTrue(request(server, duplicate).startsWith("HTTP/1.1 400"))
            repeat(5) {
                assertTrue(request(server, "POST /upload HTTP/1.1\r\nHost: localhost\r\nX-Pairing-Code: 000000\r\nContent-Length: 3\r\n\r\nabc").startsWith("HTTP/1.1 401"))
            }
            assertTrue(request(server, "POST /upload HTTP/1.1\r\nHost: localhost\r\nX-Pairing-Code: 123456\r\nContent-Length: 3\r\n\r\nabc").startsWith("HTTP/1.1 401"))
        }
    }

    @Test fun pairingConfirmsCodeWithoutUploadingAnImage() {
        var uploads = 0
        LocalHttpServer("123456", byteArrayOf(), { _, _, _ -> uploads++; "saved" }, {}).use { server ->
            server.start(0)
            val wrong = request(server, "POST /pair HTTP/1.1\r\nHost: localhost\r\nX-Pairing-Code: 000000\r\nContent-Length: 0\r\n\r\n")
            assertTrue(wrong.startsWith("HTTP/1.1 401"))
            val correct = request(server, "POST /pair HTTP/1.1\r\nHost: localhost\r\nX-Pairing-Code: 123456\r\nContent-Length: 0\r\n\r\n")
            assertTrue(correct.startsWith("HTTP/1.1 200"))
            assertTrue(correct.endsWith("Paired with TV"))
            assertEquals(0, uploads)
        }
    }

    @Test fun unpairedPageLoadsDoNotLockOutManualPairing() {
        LocalHttpServer("123456", byteArrayOf(), { _, _, _ -> "saved" }, {}).use { server ->
            server.start(0)
            repeat(6) {
                assertTrue(request(server, "POST /pair HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\n\r\n").startsWith("HTTP/1.1 401"))
            }
            assertTrue(request(server, "POST /pair HTTP/1.1\r\nHost: localhost\r\nX-Pairing-Code: 123456\r\nContent-Length: 0\r\n\r\n").startsWith("HTTP/1.1 200"))
        }
    }

}
