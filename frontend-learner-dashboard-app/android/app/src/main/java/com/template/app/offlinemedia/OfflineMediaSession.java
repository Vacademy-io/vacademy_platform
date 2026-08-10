package io.vacademy.student.app.offlinemedia;

import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * One open `OfflineMedia.openAsset()` decrypt session. Key material lives only in memory for the
 * session's lifetime and is zeroized on {@link OfflineMediaSessionStore#close}.
 */
final class OfflineMediaSession {
    final String path;
    final byte[] key;
    final byte[] nonce;
    final String mimeType;

    OfflineMediaSession(String path, byte[] key, byte[] nonce, String mimeType) {
        this.path = path;
        this.key = key;
        this.nonce = nonce;
        this.mimeType = mimeType;
    }

    void zeroize() {
        Arrays.fill(key, (byte) 0);
        Arrays.fill(nonce, (byte) 0);
    }
}

/**
 * In-memory registry of open sessions, keyed by opaque token. Shared between
 * {@link OfflineMediaPlugin} (creates/destroys sessions) and {@link OfflineMediaServer} (reads
 * sessions while serving decrypted byte ranges over the localhost HTTP responder).
 */
final class OfflineMediaSessionStore {
    static final OfflineMediaSessionStore INSTANCE = new OfflineMediaSessionStore();

    private final Map<String, OfflineMediaSession> sessions = new ConcurrentHashMap<>();

    private OfflineMediaSessionStore() {}

    String open(String path, byte[] key, byte[] nonce, String mimeType) {
        String token = UUID.randomUUID().toString();
        sessions.put(token, new OfflineMediaSession(path, key, nonce, mimeType));
        return token;
    }

    OfflineMediaSession get(String token) {
        return sessions.get(token);
    }

    void close(String token) {
        OfflineMediaSession session = sessions.remove(token);
        if (session != null) session.zeroize();
    }
}
