package com.mysmallbusiness.nativerawtcpprinter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

// One physical printer: serialize across all callers, including multiple module instances.
private val sunmiQueue = Mutex()

class SunmiPrinterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SunmiPrinter")
    AsyncFunction("printRaw") Coroutine { values: List<Int> ->
      require(values.isNotEmpty() && values.size <= 1024 * 1024 && values.all { it in 0..255 }) { "Invalid Sunmi document bytes" }
      withPrinter { printer -> transaction(printer) { printer.sendRAWData(values.map { it.toByte() }.toByteArray(), null) } }
    }
    AsyncFunction("printImage") Coroutine { uri: String, width: Int, copies: Int ->
      require(width in 8..576 && copies in 1..10) { "Invalid Sunmi print options" }
      val context = appContext.reactContext ?: error("Android context unavailable")
      val parsed = Uri.parse(uri)
      require(parsed.scheme == "file" || parsed.scheme == "content") { "Sunmi receipt must be a local image" }
      withContext(Dispatchers.IO) {
        val source = context.contentResolver.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it) }
          ?: error("Unable to read receipt image")
        val bitmap = try {
          Bitmap.createScaledBitmap(source, width, maxOf(1, (source.height.toLong() * width / source.width).toInt()), true)
        } catch (error: Throwable) {
          source.recycle()
          throw error
        }
        try {
          withPrinter { printer ->
            repeat(copies) {
              transaction(printer) {
                printer.setAlignment(1, null)
                // Keep each Binder payload comfortably below Android's 1 MB transaction limit.
                var y = 0
                while (y < bitmap.height) {
                  val strip = Bitmap.createBitmap(bitmap, 0, y, bitmap.width, minOf(256, bitmap.height - y))
                  try { printer.printBitmap(strip, null) }
                  finally { if (strip !== bitmap) strip.recycle() }
                  y += 256
                }
                printer.lineWrap(3, null)
                printer.cutPaper(null)
              }
            }
          }
        } finally {
          if (bitmap !== source) bitmap.recycle()
          source.recycle()
        }
      }
    }
  }

  private suspend fun withPrinter(job: suspend (SunmiPrinterService) -> Unit) = sunmiQueue.withLock {
    val context = appContext.reactContext ?: error("Android context unavailable")
    val connection = CompletableDeferred<SunmiPrinterService>()
    val callback = object : InnerPrinterCallback() {
      override fun onConnected(service: SunmiPrinterService) { connection.complete(service) }
      override fun onDisconnected() { connection.completeExceptionally(IllegalStateException("Sunmi printer service disconnected")) }
    }
    val manager = InnerPrinterManager.getInstance()
    try {
      withTimeout(30000) {
        val bound = withContext(Dispatchers.Main) { manager.bindService(context, callback) }
        check(bound) { "Sunmi printer service is unavailable on this device" }
        val printer = connection.await()
        withContext(Dispatchers.IO) {
          check(manager.hasPrinter(printer)) { "No built-in Sunmi printer detected" }
          val state = printer.updatePrinterState()
          check(state == 1) { "Sunmi printer is not ready (status $state)" }
          job(printer)
        }
      }
    } finally {
      // Also release pending binds after timeouts. Never mask a print failure with cleanup errors.
      withContext(kotlinx.coroutines.NonCancellable + Dispatchers.Main) {
        try { manager.unBindService(context, callback) } catch (_: Exception) { }
      }
    }
  }

  private suspend fun transaction(printer: SunmiPrinterService, commands: () -> Unit) {
    val result = CompletableDeferred<Unit>()
    val callback = object : InnerResultCallback() {
      override fun onRunResult(success: Boolean) {
        if (!success) result.completeExceptionally(IllegalStateException("Sunmi rejected the print job"))
      }
      override fun onReturnString(value: String?) { }
      override fun onRaiseException(code: Int, message: String?) {
        result.completeExceptionally(IllegalStateException("Sunmi error $code: $message"))
      }
      override fun onPrintResult(code: Int, message: String?) {
        if (code == 0) result.complete(Unit)
        else result.completeExceptionally(IllegalStateException("Sunmi print error $code: $message"))
      }
    }
    printer.enterPrinterBuffer(true)
    try {
      commands()
      printer.exitPrinterBufferWithCallback(true, callback)
      result.await()
    } catch (error: Throwable) {
      try { printer.exitPrinterBuffer(false) } catch (_: Exception) { }
      throw error
    }
  }
}
