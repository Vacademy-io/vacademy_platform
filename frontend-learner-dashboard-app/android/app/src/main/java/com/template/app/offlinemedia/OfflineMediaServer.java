package io.vacademy.student.app.offlinemedia;

import android.util.Log;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Minimal single-purpose localhost HTTP responder that serves
 * `http://127.0.0.1:<port>/<token>/stream` by decrypting the on-disk ciphertext for an open
 * `OfflineMedia.openAsset()` session, on the fly, per requested byte range.
 *
 * Why a localhost server instead of a WebView request interceptor: Capacitor 7 plugins cannot
 * cleanly hook `WebViewClient.shouldInterceptRequest` (that's owned by the Bridge's own
 * WebViewClient, not exposed to plugin authors), and `WebViewLocalServer` from
 * androidx.webkit is intended for local *asset* serving, not for range-aware on-the-fly
 * decryption of an open native session — implementing our own tiny HTTP/1.1 GET+Range responder
 * bound to 127.0.0.1 is the most direct, dependency-free way to give the `<video>` tag a real
 * URL that supports seeking. This is the Android half of the "video always streams through
 * OfflineMedia, never via a raw file:// src" playback strategy (the file on disk is ciphertext;
 * serving it directly would leak plaintext / play garbage).
 *
 * One thread per connection (video playback is low-concurrency: at most a couple of concurrent
 * Range requests per active `<video>` element). Each response closes the connection afterward
 * (`Connection: close`) — simplest correct behavior; WebKit/Chromium re-opens a new connection
 * per Range request as needed, which is normal for local media servers.
 */
final class OfflineMediaServer {

    private static final String TAG = "OfflineMediaServer";
    private static final int CHUNK_SIZE = 256 * 1024; // multiple of the 16-byte AES block size
    private static final Pattern REQUEST_LINE = Pattern.compile("^GET\\s+/([^/\\s]+)/stream\\S*\\s+HTTP/1\\.[01]$");
    private static final Pattern RANGE_HEADER = Pattern.compile("^bytes=(\\d*)-(\\d*)$");

    static final OfflineMediaServer INSTANCE = new OfflineMediaServer();

    private final ExecutorService connectionExecutor = Executors.newCachedThreadPool();
    private ServerSocket serverSocket;
    private int port = -1;

    private OfflineMediaServer() {}

    synchronized int ensureStarted() throws IOException {
        if (serverSocket != null && !serverSocket.isClosed()) return port;

        // Bind to an ephemeral port on the loopback interface only — never reachable off-device.
        serverSocket = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        port = serverSocket.getLocalPort();

        Thread acceptThread = new Thread(this::acceptLoop, "OfflineMediaServer-accept");
        acceptThread.setDaemon(true);
        acceptThread.start();

        Log.i(TAG, "Started on 127.0.0.1:" + port);
        return port;
    }

    private void acceptLoop() {
        while (serverSocket != null && !serverSocket.isClosed()) {
            try {
                Socket socket = serverSocket.accept();
                connectionExecutor.submit(() -> handleConnection(socket));
            } catch (IOException e) {
                if (serverSocket == null || serverSocket.isClosed()) return; // normal shutdown
                Log.w(TAG, "accept() failed", e);
            }
        }
    }

    private void handleConnection(Socket socket) {
        try (Socket s = socket) {
            s.setSoTimeout(15_000);
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(new BufferedInputStream(s.getInputStream()), StandardCharsets.US_ASCII)
            );
            OutputStream rawOut = new BufferedOutputStream(s.getOutputStream());

            String requestLine = reader.readLine();
            if (requestLine == null) return;

            Matcher lineMatcher = REQUEST_LINE.matcher(requestLine.trim());
            if (!lineMatcher.matches()) {
                writeStatusOnly(rawOut, 400, "Bad Request");
                return;
            }
            String token = lineMatcher.group(1);

            String rangeHeaderValue = null;
            String header;
            while ((header = reader.readLine()) != null && !header.isEmpty()) {
                int colon = header.indexOf(':');
                if (colon < 0) continue;
                String name = header.substring(0, colon).trim();
                String value = header.substring(colon + 1).trim();
                if (name.equalsIgnoreCase("Range")) rangeHeaderValue = value;
            }

            OfflineMediaSession session = OfflineMediaSessionStore.INSTANCE.get(token);
            if (session == null) {
                writeStatusOnly(rawOut, 404, "Unknown or closed OfflineMedia token");
                return;
            }

            serveAsset(session, rangeHeaderValue, rawOut);
        } catch (IOException e) {
            Log.w(TAG, "Connection handling failed", e);
        }
    }

    private void serveAsset(OfflineMediaSession session, String rangeHeaderValue, OutputStream out) throws IOException {
        java.io.File file = new java.io.File(session.path);
        if (!file.exists()) {
            writeStatusOnly(out, 404, "File not found: " + session.path);
            return;
        }
        long totalSize = file.length();

        long start = 0;
        long end = totalSize > 0 ? totalSize - 1 : 0;
        boolean isPartial = false;

        if (rangeHeaderValue != null) {
            Matcher m = RANGE_HEADER.matcher(rangeHeaderValue);
            if (m.matches()) {
                String startStr = m.group(1);
                String endStr = m.group(2);
                if (!startStr.isEmpty()) {
                    start = Long.parseLong(startStr);
                    end = endStr.isEmpty() ? (totalSize > 0 ? totalSize - 1 : 0) : Math.min(Long.parseLong(endStr), totalSize - 1);
                    isPartial = true;
                } else if (!endStr.isEmpty()) {
                    // suffix range: last N bytes
                    long suffixLength = Long.parseLong(endStr);
                    start = suffixLength >= totalSize ? 0 : totalSize - suffixLength;
                    end = totalSize > 0 ? totalSize - 1 : 0;
                    isPartial = true;
                }
            }
        }

        long contentLength = totalSize == 0 ? 0 : (end - start + 1);

        StringBuilder headers = new StringBuilder();
        headers.append(isPartial ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n");
        headers.append("Content-Type: ").append(session.mimeType).append("\r\n");
        headers.append("Accept-Ranges: bytes\r\n");
        headers.append("Content-Length: ").append(contentLength).append("\r\n");
        headers.append("Cache-Control: no-store\r\n");
        headers.append("Connection: close\r\n");
        if (isPartial) {
            headers.append("Content-Range: bytes ").append(start).append('-').append(end).append('/').append(totalSize).append("\r\n");
        }
        headers.append("\r\n");
        out.write(headers.toString().getBytes(StandardCharsets.US_ASCII));

        if (contentLength == 0) {
            out.flush();
            return;
        }

        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            raf.seek(start);
            long remaining = contentLength;
            byte[] buffer = new byte[CHUNK_SIZE];
            long offset = start;

            while (remaining > 0) {
                int readSize = (int) Math.min(buffer.length, remaining);
                int read = raf.read(buffer, 0, readSize);
                if (read <= 0) break;

                byte[] ciphertextChunk = read == buffer.length ? buffer : java.util.Arrays.copyOf(buffer, read);
                try {
                    byte[] plaintextChunk = OfflineMediaCrypto.decrypt(ciphertextChunk, session.key, session.nonce, offset);
                    out.write(plaintextChunk);
                } catch (java.security.GeneralSecurityException e) {
                    Log.e(TAG, "Decrypt failed", e);
                    break;
                }

                offset += read;
                remaining -= read;
            }
        }
        out.flush();
    }

    private void writeStatusOnly(OutputStream out, int code, String message) throws IOException {
        String body = message == null ? "" : message;
        String response = "HTTP/1.1 " + code + " " + statusText(code) + "\r\n"
            + "Content-Type: text/plain\r\n"
            + "Content-Length: " + body.getBytes(StandardCharsets.UTF_8).length + "\r\n"
            + "Connection: close\r\n\r\n"
            + body;
        out.write(response.getBytes(StandardCharsets.UTF_8));
        out.flush();
    }

    private String statusText(int code) {
        switch (code) {
            case 400: return "Bad Request";
            case 404: return "Not Found";
            default: return "Error";
        }
    }
}
