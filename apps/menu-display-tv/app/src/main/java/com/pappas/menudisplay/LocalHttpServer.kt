package com.pappas.menudisplay

import java.io.*
import java.net.*
import java.security.MessageDigest
import java.util.concurrent.*

/** Single request per connection; bounded headers, body and worker queue. No CORS. */
class LocalHttpServer(
    private val code: String,
    private val page: ByteArray,
    private val upload: (InputStream, Long, String) -> String,
    private val changed: () -> Unit
) : Closeable {
    companion object { const val MAX_UPLOAD = 20L * 1024 * 1024 }
    private var listener: ServerSocket? = null
    private val sockets = ConcurrentHashMap.newKeySet<Socket>()
    private val workers = ThreadPoolExecutor(2, 2, 0, TimeUnit.SECONDS, ArrayBlockingQueue(4))
    private var failures = 0
    private var blockedUntil = 0L
    val port get() = listener?.localPort ?: 0

    fun start(port: Int = 8787) {
        val socket = ServerSocket().apply { reuseAddress = true; bind(InetSocketAddress(port)) }
        listener = socket
        Thread({
            while (!socket.isClosed) {
                try {
                    val client = socket.accept()
                    sockets.add(client)
                    try { workers.execute { serve(client) } }
                    catch (_: RejectedExecutionException) { sockets.remove(client); client.close() }
                } catch (_: IOException) { break }
            }
        }, "menu-upload-listener").apply { isDaemon = true; start() }
    }

    @Synchronized private fun authenticated(value: String): Boolean {
        // An initial page-load check has no credential; it is not a code guess.
        if (value.isEmpty()) return false
        val now = System.nanoTime()
        if (now < blockedUntil) return false
        if (MessageDigest.isEqual(code.toByteArray(), value.toByteArray())) { failures = 0; return true }
        if (++failures >= 5) { blockedUntil = now + TimeUnit.SECONDS.toNanos(30); failures = 0 }
        return false
    }

    private class HttpError(val status: Int, override val message: String) : IOException(message)
    private fun serve(socket: Socket) {
        socket.use {
            try {
                socket.soTimeout = 15000
                val input = BufferedInputStream(socket.getInputStream())
                var headerBytes = 0
                fun line(): String {
                    val bytes = ByteArrayOutputStream()
                    while (true) {
                        val b = input.read()
                        if (b < 0) throw HttpError(400, "Incomplete request")
                        if (++headerBytes > 8192) throw HttpError(431, "Headers too large")
                        if (b == 10) return bytes.toString("US-ASCII").trimEnd('\r')
                        bytes.write(b)
                    }
                }
                val request = line().split(' ')
                if (request.size != 3) throw HttpError(400, "Invalid request")
                val headers = mutableMapOf<String, String>()
                while (true) {
                    val line = line()
                    if (line.isEmpty()) break
                    val colon = line.indexOf(':')
                    if (colon <= 0) throw HttpError(400, "Invalid header")
                    val key = line.substring(0, colon).lowercase()
                    if (headers.put(key, line.substring(colon + 1).trim()) != null) throw HttpError(400, "Duplicate header")
                }
                val host = headers["host"] ?: throw HttpError(400, "Missing host")
                // Prevent DNS rebinding: accept only this connection's local IP (or loopback for tests).
                val hostname = host.substringBefore(':')
                if (hostname != socket.localAddress.hostAddress && !(socket.localAddress.isLoopbackAddress && hostname == "localhost"))
                    throw HttpError(403, "Use the address shown on the TV")
                if (headers["origin"] != null && headers["origin"] != "http://$host") throw HttpError(403, "Cross-origin access denied")
                if (request[0] == "GET" && request[1] == "/") {
                    respond(socket, 200, page, "text/html; charset=utf-8")
                    return
                }
                if (request[0] != "POST" || request[1] !in setOf("/upload", "/pair")) throw HttpError(404, "Not found")
                if (!authenticated(headers["x-pairing-code"].orEmpty())) throw HttpError(401, "Incorrect pairing code. After five attempts, wait 30 seconds.")
                if (request[1] == "/pair") {
                    respond(socket, 200, "Paired with TV".toByteArray())
                    return
                }
                if (headers.containsKey("transfer-encoding")) throw HttpError(400, "Content-Length required")
                val length = headers["content-length"]?.toLongOrNull() ?: throw HttpError(411, "Content-Length required")
                if (length <= 0 || length > MAX_UPLOAD) throw HttpError(413, "Choose an image up to 20 MiB")
                val filename = try { URLDecoder.decode(headers["x-filename"].orEmpty(), "UTF-8") }
                    catch (_: IllegalArgumentException) { throw HttpError(400, "Invalid filename") }
                val result = upload(input, length, filename)
                respond(socket, 200, result.toByteArray())
                changed()
            } catch (e: HttpError) { runCatching { respond(socket, e.status, e.message.toByteArray()) } }
            catch (e: IllegalArgumentException) { runCatching { respond(socket, 422, (e.message ?: "Invalid image").toByteArray()) } }
            catch (_: Exception) { runCatching { respond(socket, 500, "Upload failed. Check TV storage and retry.".toByteArray()) } }
            finally { sockets.remove(socket) }
        }
    }

    private fun respond(socket: Socket, status: Int, body: ByteArray, type: String = "text/plain; charset=utf-8") {
        val output = socket.getOutputStream()
        val reason = if (status == 200) "OK" else "Error"
        output.write(("HTTP/1.1 $status $reason\r\nContent-Type: $type\r\nContent-Length: ${body.size}\r\n" +
            "Connection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n" +
            "Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\r\n\r\n").toByteArray())
        output.write(body)
        output.flush()
    }

    override fun close() {
        listener?.close()
        sockets.forEach { runCatching { it.close() } }
        workers.shutdownNow()
    }
}
