"""Exercise source-extracted Android TCP client lifecycle using the local JDK.

No Android device or real network connection required. The constructor, writer,
and destroy method are copied verbatim at runtime from the installed dependency.
Run: python3 tools/audits/native-tcp-lifecycle-repro.py
"""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
base = root / 'node_modules/react-native-tcp-socket/android/src/main/java/com/asterinet/react/tcpsocket'
source = (base / 'TcpSocketClient.java').read_text()
module = (base / 'TcpSocketModule.java').read_text()


def block(text, marker):
    start = text.index(marker)
    opening = text.index('{', start)
    depth = 1
    end = opening + 1
    while depth:
        depth += (text[end] == '{') - (text[end] == '}')
        end += 1
    return text[start:end]


end_method = block(module, 'public void end(final Integer cId)')
assert 'socketClient.destroy();' in end_method
assert 'remove(' not in end_method
assert 'shutdown' not in source
methods = '\n'.join(block(source, marker) for marker in [
    'TcpSocketClient(TcpEventListener',
    'public void write(final int msgId',
    'public void destroy()',
])
java = '''
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

class TcpSocket {
  final int id;
  TcpSocket(int id) { this.id = id; }
  int getId() { return id; }
}
class TcpEventListener {
  final CountDownLatch writes;
  TcpEventListener(int count) { writes = new CountDownLatch(count); }
  void onError(int id, Exception e) { throw new AssertionError(e); }
  void onWritten(int id, int message, Exception e) { writes.countDown(); }
  void onClose(int id, Exception e) {}
}
class TcpSocketClient extends TcpSocket {
  private final ExecutorService listenExecutor;
  private final ExecutorService writeExecutor;
  private final TcpEventListener receiverListener;
  private Socket socket;
  private boolean closed = true;
''' + methods + '''
}
public class NativeTcpLifecycleAudit {
  public static void main(String[] args) throws Exception {
    int count = 25;
    Map<Integer, TcpSocketClient> socketMap = new ConcurrentHashMap<>();
    TcpEventListener events = new TcpEventListener(count);
    int before = Thread.getAllStackTraces().size();
    for (int i = 0; i < count; i++) {
      Socket socket = new Socket() {
        public OutputStream getOutputStream() { return new ByteArrayOutputStream(); }
      };
      TcpSocketClient client = new TcpSocketClient(events, i, socket);
      socketMap.put(i, client); // TcpSocketModule.connect does this.
      client.write(1, new byte[]{1}); // Real dependency writer starts its executor.
    }
    if (!events.writes.await(5, TimeUnit.SECONDS)) throw new AssertionError("writes stalled");
    for (TcpSocketClient client : socketMap.values()) client.destroy(); // Module.end
    int alive = 0;
    for (TcpSocketClient client : socketMap.values()) {
      var field = TcpSocketClient.class.getDeclaredField("writeExecutor");
      field.setAccessible(true);
      ExecutorService executor = (ExecutorService) field.get(client);
      if (!executor.isShutdown()) alive++;
    }
    System.out.println("After " + count + " successful writes and closes: retained clients=" + socketMap.size()
      + ", unclosed writer pools=" + alive + ", extra live threads=" + (Thread.getAllStackTraces().size() - before));
    if (socketMap.size() != count || alive != count) throw new AssertionError("unexpected lifecycle");
    // Audit-only cleanup so this local reproduction can exit.
    for (TcpSocketClient client : socketMap.values()) {
      for (String name : List.of("writeExecutor", "listenExecutor")) {
        var field = TcpSocketClient.class.getDeclaredField(name);
        field.setAccessible(true);
        ((ExecutorService) field.get(client)).shutdownNow();
      }
    }
  }
}
'''
with tempfile.TemporaryDirectory(prefix='printing-native-audit-') as folder:
    target = Path(folder) / 'NativeTcpLifecycleAudit.java'
    target.write_text(java)
    subprocess.run(['javac', str(target)], check=True)
    subprocess.run(['java', '-cp', folder, 'NativeTcpLifecycleAudit'], check=True, timeout=15)
