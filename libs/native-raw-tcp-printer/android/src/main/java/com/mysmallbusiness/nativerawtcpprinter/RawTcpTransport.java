package com.mysmallbusiness.nativerawtcpprinter;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** One shared watchdog, no per-connection threads or retained client registry. */
final class RawTcpTransport {
  private static final ScheduledThreadPoolExecutor DEADLINES = new ScheduledThreadPoolExecutor(1, task -> {
    Thread thread = new Thread(task, "printer-write-deadline");
    thread.setDaemon(true);
    return thread;
  });
  static { DEADLINES.setRemoveOnCancelPolicy(true); }

  static void send(String host, int port, byte[] bytes, int copies, int timeoutMs) throws IOException {
    if (host.trim().isEmpty() || port < 1 || port > 65535 || copies < 1 || copies > 10 || timeoutMs < 1)
      throw new IllegalArgumentException("Invalid TCP print options");
    long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);
    for (int copy = 0; copy < copies; copy++) {
      long remaining = deadline - System.nanoTime();
      if (remaining <= 0) throw new SocketTimeoutException("Printer send deadline expired");
      AtomicBoolean expired = new AtomicBoolean(false);
      try (Socket socket = new Socket()) {
        ScheduledFuture<?> watchdog = DEADLINES.schedule(() -> {
          expired.set(true);
          try { socket.close(); } catch (IOException ignored) { }
        }, remaining, TimeUnit.NANOSECONDS);
        try {
          socket.connect(new InetSocketAddress(host, port), (int) Math.max(1, TimeUnit.NANOSECONDS.toMillis(remaining)));
          socket.getOutputStream().write(bytes);
          socket.getOutputStream().flush();
          if (expired.get()) throw new SocketTimeoutException("Printer send deadline expired");
        } catch (IOException error) {
          if (expired.get()) {
            SocketTimeoutException timeout = new SocketTimeoutException("Printer send deadline expired; delivery may be partial");
            timeout.initCause(error);
            throw timeout;
          }
          throw error;
        } finally {
          watchdog.cancel(false);
        }
      }
    }
  }
}
