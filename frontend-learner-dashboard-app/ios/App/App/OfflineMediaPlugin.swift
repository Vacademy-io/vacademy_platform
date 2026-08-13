import Foundation
import Capacitor

/// One open decrypt "session". Key material lives only in memory for the lifetime of the
/// session and is zeroized when the session is closed (see `OfflineMediaSessionStore.close`).
final class OfflineMediaSession {
    let path: String
    var key: [UInt8]
    var nonce: [UInt8]
    let mimeType: String

    init(path: String, key: [UInt8], nonce: [UInt8], mimeType: String) {
        self.path = path
        self.key = key
        self.nonce = nonce
        self.mimeType = mimeType
    }

    /// Overwrites key/nonce bytes with zeros before the session is dropped, so no key
    /// material lingers in the process heap longer than necessary.
    func zeroize() {
        for i in 0..<key.count { key[i] = 0 }
        for i in 0..<nonce.count { nonce[i] = 0 }
    }
}

/// In-memory registry of open `OfflineMedia.openAsset()` sessions, keyed by opaque token.
/// Shared between `OfflineMediaPlugin` (which creates/destroys sessions) and
/// `OfflineMediaSchemeHandler` (which reads from them while serving `offline-media://` requests).
final class OfflineMediaSessionStore {
    static let shared = OfflineMediaSessionStore()

    private let lock = NSLock()
    private var sessions: [String: OfflineMediaSession] = [:]

    private init() {}

    func open(path: String, key: [UInt8], nonce: [UInt8], mimeType: String) -> String {
        let token = UUID().uuidString
        lock.lock()
        sessions[token] = OfflineMediaSession(path: path, key: key, nonce: nonce, mimeType: mimeType)
        lock.unlock()
        return token
    }

    func session(for token: String) -> OfflineMediaSession? {
        lock.lock()
        defer { lock.unlock() }
        return sessions[token]
    }

    func close(token: String) {
        lock.lock()
        let session = sessions.removeValue(forKey: token)
        lock.unlock()
        session?.zeroize()
    }
}

/// Native `OfflineMedia` Capacitor plugin.
///
/// Provides:
///  - `getFreeDiskSpace()` — bytes available on the volume backing the app's home directory.
///  - `openAsset({path, keyB64, nonceB64, mimeType})` — registers a decrypt session for an
///    on-disk ciphertext file and returns a `{token, url}` pair. `url` is an
///    `offline-media://<token>/stream` URL, servable by `OfflineMediaSchemeHandler`
///    (registered on the WKWebView's configuration in `MainViewController`) directly as an
///    HTML5 `<video>` src, including Range/206 support for seeking.
///  - `closeAsset({token})` — drops the session and zeroizes its key material.
@objc(OfflineMediaPlugin)
public class OfflineMediaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OfflineMediaPlugin"
    public let jsName = "OfflineMedia"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getFreeDiskSpace", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAsset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeAsset", returnType: CAPPluginReturnPromise)
    ]

    /// URL scheme used for streaming decrypted video; must match the scheme registered via
    /// `webViewConfiguration.setURLSchemeHandler` in `MainViewController.swift`.
    static let scheme = "offline-media"

    @objc func getFreeDiskSpace(_ call: CAPPluginCall) {
        do {
            let homeURL = URL(fileURLWithPath: NSHomeDirectory())
            let values = try homeURL.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            let bytes = values.volumeAvailableCapacityForImportantUsage ?? 0
            call.resolve(["bytes": bytes])
        } catch {
            call.reject("Failed to read free disk space: \(error.localizedDescription)")
        }
    }

    @objc func openAsset(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            return call.reject("Missing required parameter: path")
        }
        guard let keyB64 = call.getString("keyB64"), let keyData = Data(base64Encoded: keyB64) else {
            return call.reject("Missing or invalid required parameter: keyB64")
        }
        guard let nonceB64 = call.getString("nonceB64"), let nonceData = Data(base64Encoded: nonceB64) else {
            return call.reject("Missing or invalid required parameter: nonceB64")
        }
        guard keyData.count == 32 else {
            return call.reject("keyB64 must decode to 32 bytes (AES-256), got \(keyData.count)")
        }
        guard nonceData.count == 16 else {
            return call.reject("nonceB64 must decode to 16 bytes, got \(nonceData.count)")
        }
        guard FileManager.default.fileExists(atPath: path) else {
            return call.reject("File does not exist at path: \(path)")
        }

        let mimeType = call.getString("mimeType") ?? OfflineMediaPlugin.guessMimeType(path: path)

        let token = OfflineMediaSessionStore.shared.open(
            path: path,
            key: [UInt8](keyData),
            nonce: [UInt8](nonceData),
            mimeType: mimeType
        )
        let url = "\(OfflineMediaPlugin.scheme)://\(token)/stream"
        call.resolve(["token": token, "url": url])
    }

    @objc func closeAsset(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            return call.reject("Missing required parameter: token")
        }
        OfflineMediaSessionStore.shared.close(token: token)
        call.resolve()
    }

    static func guessMimeType(path: String) -> String {
        let ext = (path as NSString).pathExtension.lowercased()
        switch ext {
        case "m4v", "mov": return "video/mp4"
        case "webm": return "video/webm"
        default: return "video/mp4"
        }
    }
}
