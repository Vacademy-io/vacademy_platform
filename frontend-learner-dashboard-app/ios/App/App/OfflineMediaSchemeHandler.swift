import Foundation
import WebKit

/// Serves `offline-media://<token>/stream` requests from the WKWebView by decrypting the
/// on-disk ciphertext for an open `OfflineMedia.openAsset()` session, on the fly, per
/// requested byte range.
///
/// Registered on the WKWebViewConfiguration in `MainViewController.webViewConfiguration(for:)`.
/// This is the iOS half of the "video always streams through OfflineMedia, never via
/// convertFileSrc / a Blob" playback strategy — the file on disk is ciphertext, so serving it
/// directly (as `convertFileSrc` would) would leak plaintext; this handler decrypts only the
/// bytes actually requested, in memory, per request.
final class OfflineMediaSchemeHandler: NSObject, WKURLSchemeHandler {

    /// Read/decrypt in 64 KiB chunks (already a multiple of the 16-byte AES block size) so we
    /// never have to materialize a whole (potentially multi-GB) video in memory.
    private static let chunkSize = 64 * 1024

    /// Tracks tasks that have been told to stop, so the background read loop can bail out
    /// promptly instead of continuing to decrypt/emit data for a cancelled request.
    private let cancelledLock = NSLock()
    private var cancelledTasks = Set<ObjectIdentifier>()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let taskId = ObjectIdentifier(urlSchemeTask)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.handle(urlSchemeTask: urlSchemeTask, taskId: taskId)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        cancelledLock.lock()
        cancelledTasks.insert(ObjectIdentifier(urlSchemeTask))
        cancelledLock.unlock()
    }

    private func isCancelled(_ taskId: ObjectIdentifier) -> Bool {
        cancelledLock.lock()
        defer { cancelledLock.unlock() }
        return cancelledTasks.contains(taskId)
    }

    private func clearCancelled(_ taskId: ObjectIdentifier) {
        cancelledLock.lock()
        cancelledTasks.remove(taskId)
        cancelledLock.unlock()
    }

    private func fail(_ urlSchemeTask: WKURLSchemeTask, _ taskId: ObjectIdentifier, code: Int, message: String) {
        guard !isCancelled(taskId) else { clearCancelled(taskId); return }
        let error = NSError(domain: "OfflineMedia", code: code, userInfo: [NSLocalizedDescriptionKey: message])
        urlSchemeTask.didFailWithError(error)
        clearCancelled(taskId)
    }

    private func handle(urlSchemeTask: WKURLSchemeTask, taskId: ObjectIdentifier) {
        guard let url = urlSchemeTask.request.url, let token = url.host else {
            return fail(urlSchemeTask, taskId, code: 400, message: "Malformed offline-media URL")
        }
        guard let session = OfflineMediaSessionStore.shared.session(for: token) else {
            return fail(urlSchemeTask, taskId, code: 404, message: "Unknown or closed OfflineMedia token")
        }

        let fileManager = FileManager.default
        guard let attrs = try? fileManager.attributesOfItem(atPath: session.path),
              let totalSize = (attrs[.size] as? NSNumber)?.uint64Value else {
            return fail(urlSchemeTask, taskId, code: 404, message: "File not found: \(session.path)")
        }

        guard let fileHandle = FileHandle(forReadingAtPath: session.path) else {
            return fail(urlSchemeTask, taskId, code: 500, message: "Unable to open file for reading")
        }
        defer { try? fileHandle.close() }

        // Parse an optional "Range: bytes=start-end" request header.
        var rangeStart: UInt64 = 0
        var rangeEnd: UInt64 = totalSize > 0 ? totalSize - 1 : 0
        var isPartial = false
        if let rangeHeader = urlSchemeTask.request.value(forHTTPHeaderField: "Range") {
            if let parsed = OfflineMediaSchemeHandler.parseRange(rangeHeader, totalSize: totalSize) {
                rangeStart = parsed.start
                rangeEnd = parsed.end
                isPartial = true
            } else if OfflineMediaSchemeHandler.isRangeStartOutOfBounds(rangeHeader, totalSize: totalSize) {
                // RFC 7233: a start beyond the last valid byte is "not satisfiable",
                // not "unparseable" — parseRange returns nil for both, so this is
                // checked separately rather than silently falling through to 200.
                return failRangeNotSatisfiable(urlSchemeTask, taskId, totalSize: totalSize)
            }
        }

        if totalSize == 0 {
            rangeStart = 0
            rangeEnd = 0
        }

        let contentLength = totalSize == 0 ? 0 : (rangeEnd - rangeStart + 1)

        var headers: [String: String] = [
            "Content-Type": session.mimeType,
            "Accept-Ranges": "bytes",
            "Content-Length": "\(contentLength)",
            "Cache-Control": "no-store"
        ]
        let statusCode: Int
        if isPartial {
            statusCode = 206
            headers["Content-Range"] = "bytes \(rangeStart)-\(rangeEnd)/\(totalSize)"
        } else {
            statusCode = 200
        }

        guard let response = HTTPURLResponse(
            url: url,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        ) else {
            return fail(urlSchemeTask, taskId, code: 500, message: "Failed to construct response")
        }

        if isCancelled(taskId) { clearCancelled(taskId); return }
        urlSchemeTask.didReceive(response)

        if contentLength == 0 {
            urlSchemeTask.didFinish()
            clearCancelled(taskId)
            return
        }

        do {
            try fileHandle.seek(toOffset: rangeStart)
        } catch {
            return fail(urlSchemeTask, taskId, code: 500, message: "Seek failed: \(error.localizedDescription)")
        }

        var remaining = contentLength
        var offset = rangeStart

        while remaining > 0 {
            if isCancelled(taskId) { clearCancelled(taskId); return }

            let readSize = Int(min(UInt64(OfflineMediaSchemeHandler.chunkSize), remaining))
            let ciphertextChunk = fileHandle.readData(ofLength: readSize)
            if ciphertextChunk.isEmpty { break }

            do {
                let plaintextChunk = try OfflineMediaCrypto.decrypt(
                    ciphertext: [UInt8](ciphertextChunk),
                    key: session.key,
                    nonce: session.nonce,
                    fileOffset: offset
                )
                urlSchemeTask.didReceive(Data(plaintextChunk))
            } catch {
                return fail(urlSchemeTask, taskId, code: 500, message: "Decrypt failed: \(error.localizedDescription)")
            }

            offset += UInt64(ciphertextChunk.count)
            remaining -= UInt64(ciphertextChunk.count)
        }

        if isCancelled(taskId) { clearCancelled(taskId); return }
        urlSchemeTask.didFinish()
        clearCancelled(taskId)
    }

    /// Sends a 416 Range Not Satisfiable with `Content-Range: bytes */<total>`, per RFC 7233 §4.4.
    private func failRangeNotSatisfiable(_ urlSchemeTask: WKURLSchemeTask, _ taskId: ObjectIdentifier, totalSize: UInt64) {
        guard let url = urlSchemeTask.request.url else { return }
        let headers = ["Content-Range": "bytes */\(totalSize)"]
        guard let response = HTTPURLResponse(
            url: url,
            statusCode: 416,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        ) else {
            return fail(urlSchemeTask, taskId, code: 500, message: "Failed to construct 416 response")
        }
        if isCancelled(taskId) { clearCancelled(taskId); return }
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didFinish()
        clearCancelled(taskId)
    }

    /// True when a "bytes=start-..." Range header's start exceeds the last valid byte offset —
    /// the case RFC 7233 requires a 416 for, which `parseRange` below can't distinguish from a
    /// merely-malformed header (both return nil there).
    static func isRangeStartOutOfBounds(_ header: String, totalSize: UInt64) -> Bool {
        guard header.hasPrefix("bytes="), totalSize > 0 else { return false }
        let spec = header.dropFirst("bytes=".count).split(separator: ",").first.map(String.init) ?? ""
        let parts = spec.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, let start = UInt64(parts[0]) else { return false }
        return start > totalSize - 1
    }

    /// Parses a single-range "bytes=start-end" / "bytes=start-" header, per RFC 7233. Multi-range
    /// requests are not used by HTML5 video playback, so only the first range is honored.
    static func parseRange(_ header: String, totalSize: UInt64) -> (start: UInt64, end: UInt64)? {
        guard header.hasPrefix("bytes=") else { return nil }
        let spec = header.dropFirst("bytes=".count).split(separator: ",").first.map(String.init) ?? ""
        let parts = spec.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 2 else { return nil }

        if parts[0].isEmpty {
            // "bytes=-N" => last N bytes
            guard let suffixLength = UInt64(parts[1]), suffixLength > 0, totalSize > 0 else { return nil }
            let start = suffixLength >= totalSize ? 0 : totalSize - suffixLength
            return (start, totalSize - 1)
        }

        guard let start = UInt64(parts[0]) else { return nil }
        if parts[1].isEmpty {
            guard totalSize > 0 else { return nil }
            return (start, totalSize - 1)
        }
        guard let end = UInt64(parts[1]) else { return nil }
        let clampedEnd = totalSize > 0 ? min(end, totalSize - 1) : end
        guard start <= clampedEnd else { return nil }
        return (start, clampedEnd)
    }
}
