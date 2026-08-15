import ExpoModulesCore
import Network
import UIKit
import CryptoKit

private struct PrinterOptions {
  let viewTag: Int; let host: String; let port: UInt16; let width: Int; let copies: Int; let captureScale: CGFloat; let timeoutMs: Int
}
private struct Raster { let width: Int; let height: Int; let rgba: [UInt8] }
private struct NativeFailure: Error { let code: String; let phase: String; let message: String }

private actor PrinterQueues {
  static let shared = PrinterQueues()
  private var tails: [String: Task<Void, Never>] = [:]
  func run<T: Sendable>(key: String, _ work: @escaping @Sendable () async throws -> T) async throws -> T {
    let previous = tails[key]
    let task = Task { if let previous { _ = await previous.result } }
    tails[key] = task
    _ = await task.result
    defer { if tails[key] == task { tails.removeValue(forKey: key) } }
    return try await work()
  }
}

public final class NativeRawTcpPrinterModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeRawTcpPrinter")
    AsyncFunction("print") { (input: [String: Any]) async -> [String: Any] in
      let started = DispatchTime.now().uptimeNanoseconds
      do {
        let options = try Self.parse(input)
        let captureStart = DispatchTime.now().uptimeNanoseconds
        let image = try await MainActor.run { try self.capture(tag: options.viewTag, scale: options.captureScale) }
        let captureEnd = DispatchTime.now().uptimeNanoseconds
        let raster = try Self.resize(try Self.rgba(image), maxWidth: options.width)
        let resizeEnd = DispatchTime.now().uptimeNanoseconds
        let bytes = Self.escPos(raster)
        let rasterEnd = DispatchTime.now().uptimeNanoseconds
        var sendMs: UInt64 = 0
        let sendStart = DispatchTime.now().uptimeNanoseconds
        let target = options.host.lowercased() + ":" + String(options.port)
        try await PrinterQueues.shared.run(key: target) { try await Self.send(bytes, options: options) }
        sendMs = Self.elapsed(sendStart)
        return ["ok": true, "captureMs": Self.elapsed(captureStart, captureEnd), "resizeMs": Self.elapsed(captureEnd, resizeEnd), "rasterMs": Self.elapsed(resizeEnd, rasterEnd), "sendMs": sendMs, "totalMs": Self.elapsed(started), "width": raster.width, "height": raster.height, "byteLength": bytes.count, "fnv1a32": Self.fnv1a32(bytes), "sent": true]
      } catch let failure as NativeFailure {
        return ["ok": false, "error": ["code": failure.code, "phase": failure.phase, "message": failure.message], "totalMs": Self.elapsed(started)]
      } catch {
        return ["ok": false, "error": ["code": "RASTER_FAILED", "phase": "native", "message": error.localizedDescription], "totalMs": Self.elapsed(started)]
      }
    }
  }

  private func capture(tag: Int, scale: CGFloat) throws -> UIImage {
    guard let view: UIView = appContext?.findView(withTag: tag, ofType: UIView.self) else { throw NativeFailure(code: "VIEW_NOT_FOUND", phase: "capture", message: "Receipt view was not found") }
    guard view.bounds.width > 0 && view.bounds.height > 0 else { throw NativeFailure(code: "CAPTURE_FAILED", phase: "capture", message: "Receipt view has no size") }
    let renderer = UIGraphicsImageRenderer(bounds: view.bounds, format: { let format = UIGraphicsImageRendererFormat(); format.scale = scale; return format }())
    return renderer.image { _ in view.drawHierarchy(in: view.bounds, afterScreenUpdates: true) }
  }

  private static func parse(_ value: [String: Any]) throws -> PrinterOptions {
    guard let viewTag = value["viewTag"] as? Int, let host = value["host"] as? String, let port = value["port"] as? Int, let width = value["width"] as? Int, let copies = value["copies"] as? Int, let timeoutMs = value["timeoutMs"] as? Int else { throw NativeFailure(code: "INVALID_OPTIONS", phase: "options", message: "Missing printer options") }
    guard let captureScale = value["captureScale"] as? Double, !host.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, (1...65535).contains(port), width >= 8, (1...10).contains(copies), timeoutMs > 0, (1...2).contains(captureScale) else { throw NativeFailure(code: "INVALID_OPTIONS", phase: "options", message: "Invalid printer options") }
    return PrinterOptions(viewTag: viewTag, host: host, port: UInt16(port), width: width, copies: copies, captureScale: CGFloat(captureScale), timeoutMs: timeoutMs)
  }

  private static func rgba(_ image: UIImage) throws -> Raster {
    guard let cgImage = image.cgImage else { throw NativeFailure(code: "CAPTURE_FAILED", phase: "capture", message: "Receipt image is unavailable") }
    let width = cgImage.width; let height = cgImage.height; var pixels = [UInt8](repeating: 0, count: width * height * 4)
    guard let context = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { throw NativeFailure(code: "CAPTURE_FAILED", phase: "capture", message: "Unable to read receipt pixels") }
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    return Raster(width: width, height: height, rgba: pixels)
  }

  private static func resize(_ source: Raster, maxWidth requested: Int) -> Raster {
    let maxWidth = max(8, requested) / 8 * 8
    if source.width <= maxWidth && source.width % 8 == 0 { return source }
    let scale = min(1, Double(maxWidth) / Double(source.width)); let width = max(8, Int(Double(source.width) * scale)) / 8 * 8; let height = max(1, Int(Double(source.height) * scale)); var output = [UInt8](repeating: 0, count: width * height * 4)
    for y in 0..<height { for x in 0..<width { let sx = min(source.width - 1, Int(Double(x) / scale)); let sy = min(source.height - 1, Int(Double(y) / scale)); let from = (sy * source.width + sx) * 4; let to = (y * width + x) * 4; output[to..<to+4] = source.rgba[from..<from+4] } }
    return Raster(width: width, height: height, rgba: output)
  }

  private static func escPos(_ raster: Raster) -> [UInt8] {
    var bytes: [UInt8] = [0x1b, 0x40, 0x1b, 0x61, 0x01, 0x1b, 0x33, 24]
    for y in stride(from: 0, to: raster.height, by: 24) { bytes += [0x1b, 0x2a, 33, UInt8(raster.width & 0xff), UInt8(raster.width >> 8)]
      for x in 0..<raster.width { for stripe in 0..<3 { var value: UInt8 = 0; for bit in 0..<8 { let py = y + stripe * 8 + bit; if py < raster.height { let i = (py * raster.width + x) * 4; let luminance = Double(raster.rgba[i]) * 0.299 + Double(raster.rgba[i+1]) * 0.587 + Double(raster.rgba[i+2]) * 0.114; if raster.rgba[i+3] > 0 && luminance < 180 { value |= UInt8(1 << (7 - bit)) } } }; bytes.append(value) } }; bytes.append(0x0a) }
    bytes += [0x1b, 0x32, 0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]; return bytes
  }

  private static func send(_ bytes: [UInt8], options: PrinterOptions) async throws {
    for _ in 0..<options.copies { try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      let connection = NWConnection(host: NWEndpoint.Host(options.host), port: NWEndpoint.Port(rawValue: options.port)!, using: .tcp)
      var settled = false; func finish(_ result: Result<Void, Error>) { guard !settled else { return }; settled = true; connection.cancel(); continuation.resume(with: result) }
      connection.stateUpdateHandler = { state in if case .failed(let error) = state { finish(.failure(NativeFailure(code: "CONNECTION_FAILED", phase: "send", message: error.localizedDescription))) } }
      connection.start(queue: .global()); connection.send(content: Data(bytes), completion: .contentProcessed { error in if let error { finish(.failure(NativeFailure(code: "SEND_FAILED", phase: "send", message: error.localizedDescription))) } else { finish(.success(())) } })
      DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(options.timeoutMs)) { finish(.failure(NativeFailure(code: "TIMEOUT", phase: "send", message: "Printer timed out"))) }
    } }
  }

  private static func elapsed(_ start: UInt64, _ end: UInt64 = DispatchTime.now().uptimeNanoseconds) -> UInt64 { (end - start) / 1_000_000 }
  private static func fnv1a32(_ bytes: [UInt8]) -> String { var hash: UInt32 = 0x811c9dc5; for byte in bytes { hash ^= UInt32(byte); hash = hash &* 0x01000193 }; return String(format: "%08x", hash) }
}
