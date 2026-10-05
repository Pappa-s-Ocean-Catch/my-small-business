package com.mysmallbusiness.nativerawtcpprinter;

import java.io.ByteArrayOutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.Arrays;

// Integration checks with real loopback sockets; no Android framework required.
public class RawTcpTransportTest {
  public static void main(String[] args) throws Exception {
    int before = Thread.getAllStackTraces().size();
    try (ServerSocket server = new ServerSocket(0)) {
      Thread reader = new Thread(() -> {
        try {
          for (int i = 0; i < 200; i++) {
            try (Socket socket = server.accept()) {
              ByteArrayOutputStream bytes = new ByteArrayOutputStream();
              socket.getInputStream().transferTo(bytes);
              if (!Arrays.equals(bytes.toByteArray(), new byte[]{1, 2, 3})) throw new AssertionError("corrupt document");
            }
          }
        } catch (Exception e) { throw new RuntimeException(e); }
      });
      reader.start();
      for (int i = 0; i < 200; i++) RawTcpTransport.send("127.0.0.1", server.getLocalPort(), new byte[]{1, 2, 3}, 1, 1000);
      reader.join(5000);
      if (reader.isAlive()) throw new AssertionError("reader did not observe socket closure");
    }
    int extraThreads = Thread.getAllStackTraces().size() - before;
    if (extraThreads > 2) throw new AssertionError("threads grew with jobs: " + extraThreads);
    System.out.println("PASS: 200 sends close sockets; extra live threads=" + extraThreads);

    try (ServerSocket server = new ServerSocket(0)) {
      Thread nonReader = new Thread(() -> {
        try (Socket socket = server.accept()) { Thread.sleep(2000); }
        catch (Exception e) { throw new RuntimeException(e); }
      });
      nonReader.start();
      long started = System.nanoTime();
      boolean timedOut = false;
      try { RawTcpTransport.send("127.0.0.1", server.getLocalPort(), new byte[32 * 1024 * 1024], 1, 150); }
      catch (SocketTimeoutException expected) { timedOut = true; }
      long elapsed = (System.nanoTime() - started) / 1_000_000;
      if (!timedOut || elapsed > 1500) throw new AssertionError("write deadline not enforced: " + elapsed);
      nonReader.join();
      System.out.println("PASS: stalled write terminates at deadline (" + elapsed + "ms)");
    }
  }
}
