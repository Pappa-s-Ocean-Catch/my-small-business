package com.mysmallbusiness.nativerawtcpprinter

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap

private data class Raster(val width: Int, val height: Int, val rgba: ByteArray)
private data class Options(val viewTag: Int, val host: String, val port: Int, val width: Int, val copies: Int, val captureScale: Int, val timeoutMs: Int)

private object PrinterQueues {
  private val queues = ConcurrentHashMap<String, Mutex>()
  suspend fun <T> run(key: String, block: suspend () -> T): T = queues.getOrPut(key) { Mutex() }.withLock { block() }
}

class NativeRawTcpPrinterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeRawTcpPrinter")
    AsyncFunction("print") Coroutine { input: Map<String, Any?> ->
      val started = System.nanoTime()
      try {
        val options = parseOptions(input)
        val captureStarted = System.nanoTime()
        val bitmap = withContext(Dispatchers.Main) { capture(options.viewTag, options.captureScale) }
        val capturedAt = System.nanoTime()
        val resized = resize(bitmapToRgba(bitmap), options.width)
        val resizedAt = System.nanoTime()
        val bytes = escPos(resized)
        val rasterAt = System.nanoTime()
        var sendMs = 0L
        val sendStarted = System.nanoTime()
        PrinterQueues.run(options.host.trim().lowercase() + ":" + options.port) {
          withContext(Dispatchers.IO) { send(options, bytes) }
        }
        sendMs = elapsedMs(sendStarted)
        mapOf(
          "ok" to true, "captureMs" to elapsedMs(captureStarted, capturedAt), "resizeMs" to elapsedMs(capturedAt, resizedAt),
          "rasterMs" to elapsedMs(resizedAt, rasterAt), "sendMs" to sendMs, "totalMs" to elapsedMs(started),
          "width" to resized.width, "height" to resized.height, "byteLength" to bytes.size, "fnv1a32" to fnv1a32(bytes), "sent" to true
        )
      } catch (error: PrinterFailure) {
        mapOf("ok" to false, "error" to mapOf("code" to error.code, "message" to error.message.orEmpty(), "phase" to error.phase), "totalMs" to elapsedMs(started))
      } catch (error: Throwable) {
        mapOf("ok" to false, "error" to mapOf("code" to "RASTER_FAILED", "message" to (error.message ?: "Native printer failure"), "phase" to "native"), "totalMs" to elapsedMs(started))
      }
    }
  }

  private fun parseOptions(input: Map<String, Any?>): Options {
    fun number(name: String): Int = (input[name] as? Number)?.toInt() ?: throw PrinterFailure("INVALID_OPTIONS", "options", "$name is required")
    val host = input["host"] as? String ?: throw PrinterFailure("INVALID_OPTIONS", "options", "host is required")
    val result = Options(number("viewTag"), host, number("port"), number("width"), number("copies"), number("captureScale"), number("timeoutMs"))
    if (result.host.isBlank() || result.port !in 1..65535 || result.width < 8 || result.copies !in 1..10 || result.captureScale !in 1..2) throw PrinterFailure("INVALID_OPTIONS", "options", "Invalid printer options")
    return result
  }

  private fun capture(tag: Int, captureScale: Int): Bitmap {
    val view = appContext.findView<View>(tag) ?: throw PrinterFailure("VIEW_NOT_FOUND", "capture", "Receipt view was not found")
    if (view.width <= 0 || view.height <= 0) throw PrinterFailure("CAPTURE_FAILED", "capture", "Receipt view has no size")
    return Bitmap.createBitmap(view.width * captureScale, view.height * captureScale, Bitmap.Config.ARGB_8888).also { Canvas(it).apply { scale(captureScale.toFloat(), captureScale.toFloat()); view.draw(this) } }
  }
}

private class PrinterFailure(val code: String, val phase: String, message: String) : Exception(message)
private fun elapsedMs(start: Long, end: Long = System.nanoTime()) = (end - start) / 1_000_000
private fun bitmapToRgba(bitmap: Bitmap): Raster {
  val pixels = IntArray(bitmap.width * bitmap.height); bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
  val rgba = ByteArray(pixels.size * 4)
  pixels.forEachIndexed { i, pixel -> val o = i * 4; rgba[o] = (pixel shr 16).toByte(); rgba[o + 1] = (pixel shr 8).toByte(); rgba[o + 2] = pixel.toByte(); rgba[o + 3] = (pixel ushr 24).toByte() }
  return Raster(bitmap.width, bitmap.height, rgba)
}
private fun resize(source: Raster, requestedWidth: Int): Raster {
  val maxWidth = requestedWidth.coerceAtLeast(8) / 8 * 8
  if (source.width <= maxWidth && source.width % 8 == 0) return source
  val scale = minOf(1.0, maxWidth.toDouble() / source.width); val width = maxOf(8, (source.width * scale).toInt()) / 8 * 8; val height = maxOf(1, (source.height * scale).toInt())
  val output = ByteArray(width * height * 4)
  for (y in 0 until height) for (x in 0 until width) { val from = ((minOf(source.height - 1, (y / scale).toInt()) * source.width + minOf(source.width - 1, (x / scale).toInt())) * 4); val to = (y * width + x) * 4; for (c in 0..3) output[to + c] = source.rgba[from + c] }
  return Raster(width, height, output)
}
private fun escPos(raster: Raster): ByteArray {
  val output = ArrayList<Byte>(); fun put(value: Int) { output.add(value.toByte()) }; fun putAll(values: ByteArray) { values.forEach { output.add(it) } }
  putAll(byteArrayOf(0x1b, 0x40, 0x1b, 0x61, 0x01)); putAll(byteArrayOf(0x1b, 0x33, 24))
  for (y in 0 until raster.height step 24) { put(0x1b); put(0x2a); put(33); put(raster.width and 0xff); put(raster.width shr 8)
    for (x in 0 until raster.width) for (stripe in 0..2) { var value = 0; for (bit in 0..7) { val py = y + stripe * 8 + bit; if (py < raster.height) { val i = (py * raster.width + x) * 4; val alpha = raster.rgba[i + 3].toInt() and 0xff; val lum = (raster.rgba[i].toInt() and 0xff) * .299 + (raster.rgba[i + 1].toInt() and 0xff) * .587 + (raster.rgba[i + 2].toInt() and 0xff) * .114; if (alpha > 0 && lum < 180) value = value or (1 shl (7 - bit)) } }; put(value) }
    put(0x0a)
  }
  putAll(byteArrayOf(0x1b, 0x32, 0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00)); return output.toByteArray()
}
private fun send(options: Options, bytes: ByteArray) { try { repeat(options.copies) { Socket().use { socket -> socket.connect(InetSocketAddress(options.host, options.port), options.timeoutMs); socket.soTimeout = options.timeoutMs; socket.getOutputStream().use { it.write(bytes); it.flush() } } } } catch (error: java.net.SocketTimeoutException) { throw PrinterFailure("TIMEOUT", "send", error.message ?: "Printer timed out") } catch (error: Throwable) { throw PrinterFailure("SEND_FAILED", "send", error.message ?: "Unable to send to printer") } }
private fun fnv1a32(bytes: ByteArray): String { var hash = 0x811c9dc5.toInt(); bytes.forEach { hash = hash xor (it.toInt() and 0xff); hash *= 0x01000193 }; return (hash.toLong() and 0xffffffffL).toString(16).padStart(8, '0') }
