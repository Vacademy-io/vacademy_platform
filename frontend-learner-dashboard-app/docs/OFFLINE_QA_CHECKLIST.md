# Offline Content Download & Sync — QA Handoff Checklist

Companion to `docs/OFFLINE_MEDIA_PLUGIN.md` (native video streaming) and
`/Users/priyanshu/.claude/plans/fancy-strolling-hartmanis.md` (full plan). All 9
implementation phases are code-complete; this is the manual verification pass
before shipping. Everything below is **manual/on-device** — there is no
automated substitute for airplane-mode, disk-full, or Keychain-backed
behavior.

## 1. Device matrix

Run the full manual test script (§3) on each of these at least once before
shipping; the video playback checks (§4) are the minimum bar for every entry:

| Device | Why it's in the matrix |
|---|---|
| Oldest-supported iPhone (check `ios/App/App.xcodeproj` deployment target) | Slowest AES-CTR decrypt throughput, oldest WKWebView `WKURLSchemeHandler` behavior, tightest RAM for the chunked downloader |
| Low-storage Android device (e.g. 32GB, mostly full) | Disk-full mid-download path, `getFreeDiskSpace()` accuracy, localhost `ServerSocket` responder under memory pressure |
| One white-label flavor (any of `seven_cs`, `ssdc`, `stemx`, etc. — pick one not already covered by CI) | Confirms the local `OfflineMedia` plugin (not an npm package, so not auto-registered) is present for every flavor's `main` sourceSet, and confirms flavor-specific branding doesn't hide offline UI |
| Electron, macOS | `protocol.handle('offline-media', ...)` path, obfuscated (not Keychain) secure storage backing |
| Electron, Windows | Same as macOS — separate run because Windows file path handling (drive letters, backslashes) is the most likely native-path divergence point for `resolveAbsolutePath` in `src/lib/offline/resolve.ts` |

## 2. iOS manual build step (do this before any iOS device testing)

The iOS side of the `OfflineMedia` plugin was added by hand-editing
`ios/App/App.xcodeproj/project.pbxproj` (verified with `plutil -lint` only —
no Xcode toolchain was available when it was written). Before relying on any
iOS test result:

1. Open `ios/App/App.xcworkspace` in Xcode (not the `.xcodeproj` — Capacitor
   uses CocoaPods).
2. Run `pod install` in `ios/App/` first if `Pods/` is stale.
3. For **every** build target (App + any white-label targets), open Build
   Phases → Compile Sources and confirm all four new files are checked:
   - `OfflineMediaPlugin.swift`
   - `OfflineMediaSchemeHandler.swift`
   - `OfflineMediaCrypto.swift`
   - `MainViewController.swift`
4. Open `Main.storyboard`, select the root view controller, and confirm the
   Custom Class (Identity Inspector) is `MainViewController` for every
   target — if a target still shows `CAPBridgeViewController`, the
   `offline-media://` scheme handler never gets registered for that target
   and video playback will silently fail to load (no crash, just a blocked
   network request).
5. Build once for each target (⌘B) and fix any "file not a member of target"
   errors before device testing — those mean step 3 didn't take for that
   target.
6. Confirm the app still builds/launches with **no** Range request sent
   (i.e., non-video slides) — the scheme handler is registered globally on
   the `WKWebViewConfiguration`, so a mistake there can break the whole
   WebView, not just video.

## 3. Manual test script (device registration → sync → revoke)

Reconstructed from plan §Verification + the downloads-page feature set.
Run against a real backend (not mocked) — this is the point where
client/server contract drift would actually surface.

### 3.1 Device registration + limit
1. Fresh install, log in, open a course with offline-enabled content.
2. Register the device (should happen automatically on first download
   attempt, or from the Downloads screen). Confirm `GET
   /admin-core-service/learner-offline/v1/devices` shows the new device as
   `ACTIVE`.
3. Repeat registration on `maxDevices` (institute setting, default 2) more
   devices/simulators for the same account.
4. Attempt one more registration past the cap → expect HTTP 409
   `DEVICE_LIMIT_REACHED` and a UI dialog listing current devices with an
   option to revoke one (per plan §A3/§B9).
5. Revoke the oldest device from that dialog, then retry registration on the
   device that was blocked → should now succeed.

### 3.2 Download → check-in → lease renewal
1. Download a full chapter (mix of PDF, audio, video, quiz) while online.
   Confirm per-node progress % and a final "Downloaded" state on
   `chapter-sidebar-slides.tsx` / `course-tree-sidebar.tsx`.
2. Force a check-in (kill + relaunch, or wait for the 6h foreground
   interval / trigger via any network reconnect). Confirm
   `device_state.lease_expires_at` advances and no purge occurs.
3. On the backend, temporarily shorten `revalidationDays` to a small value
   (institute setting) or directly edit `offline_device.lease_expires_at`
   in the DB to force imminent expiry, then check in again from the app —
   confirm the lease renews before it lapses in normal use.

### 3.3 Lease expiry lock
1. With a device's lease already expired (server-shortened window, per
   §3.2), go offline (airplane mode) and open any downloaded slide.
2. Expect the `LeaseLockOverlay` (`src/components/common/study-library/
   .../slide-material/offline/lease-lock-overlay.tsx`) — "Connect to the
   internet to keep offline access" — instead of the slide content. This is
   gated in `slide-material.tsx`'s `loadContent` before the type-specific
   switch, so it should appear for every downloadable slide type
   (VIDEO/DOCUMENT/AUDIO/ASSIGNMENT), not just one.
3. Reconnect briefly (check-in fires) → confirm the overlay is replaced by
   the actual slide content on next slide load without requiring app
   restart.

### 3.4 Revocation (admin) + un-enrollment
1. As admin, revoke the test device from `AdminOfflineDeviceController`
   (admin UI device list).
2. On the learner device, still offline: content should remain accessible
   until the next check-in reaches the server (documented trust boundary —
   the server can't reach an offline device). Confirm no crash/lockup.
3. Reconnect → check-in should report `deviceStatus: "REVOKED"` →
   `LeaseLockOverlay` (reason `REVOKED`, "Offline access removed") should
   appear, and downloaded files/rows should be purged (confirm via the
   Downloads screen showing an empty/reset state, and via device file
   inspection that `.enc` files under `offline/<userId>/` are gone).
4. Repeat with un-enrollment instead of device revoke (remove the learner
   from the batch/course on the backend) — expect the same purge+notice
   flow, reason `UNENROLLED`, sourced from `check-in`'s `revocations[]`.

### 3.5 Content update flow
1. While a chapter is fully downloaded, edit one slide on the backend
   (republish a PDF, or change a quiz question) so its checksum/manifest
   version changes.
2. Trigger a check-in on the device → expect an "Update available" badge
   on the affected node (not a forced purge — old copy keeps working per
   plan's soft-update decision).
3. Tap "Update" → confirm only the changed asset re-downloads (diff by
   checksum), not the whole chapter.

## 4. Video offline playback checks (every device in §1)

This is the newly-wired path (`resolve.ts` offline-stream branch →
`src/lib/offline/native/offline-media.ts` `openAsset` → `custom-video-player.tsx`).

1. Download a chapter containing a `FILE_ID`-backed video slide, fully to
   `DOWNLOADED`.
2. Enable airplane mode (true radio-off, not just app-level "simulate
   offline" if the app has one — some CDN/media requests can silently
   succeed over a lingering DNS cache otherwise).
3. Open the video slide. Expect:
   - Playback starts without hitting the network (check native network
     logs / Charles proxy shows no requests for the video).
   - The player's download button (kebab menu, `custom-video-player.tsx`
     ~L1911) is **absent** — `isOfflineSource` should force
     `allowVideoDownload` false regardless of the learner's role
     permission.
   - Right-click / long-press context menu does not offer "Save video as"
     (same `allowVideoDownload` gate).
4. Seek forward and backward several times, including seeking into the
   last few seconds of the file (exercises the Range-request path at both
   an early and a near-EOF byte offset — this is also where the iOS 416
   fix in `OfflineMediaSchemeHandler.swift` matters: seeking past EOF via a
   scrub-bar drag should not silently return 200 OK with garbage/empty
   content).
5. Background the app mid-playback and resume — playback should not crash;
   the decrypt session (`openAsset` token) should still be valid or cleanly
   re-opened.
6. Navigate to the next slide, then back to the video slide. Confirm no
   growing memory/file-descriptor leak after doing this ~10 times (the
   `closeAsset`/`release()` cleanup in `slide-material.tsx`'s
   `offlineStreamReleaseRef` should fire on every slide change — see
   Video Token Lifecycle below).
7. **No plaintext in the app container**: with the device still in
   airplane mode (or after), inspect the app's sandboxed storage:
   - iOS: `xcrun simctl get_app_container booted <bundle-id> data` (or
     device container via Xcode's Devices window), then `find` under
     `Documents`/`Library` for the video's `.enc` file. Open it in a hex
     viewer — must **not** start with an `ftyp`/`moov` MP4 box signature
     (that would mean ciphertext == plaintext, i.e. encryption is a no-op).
   - Android: `adb shell run-as <package> find /data/data/<package>/files`
     to locate `offline/<userId>/assets/*.enc`, `adb pull` it, and hex-dump
     — same check.
   - Electron: inspect the app's userData directory directly (no sandbox to
     work around) for the same `.enc` files.
   - In all three, confirm there is **no** decrypted temp file left behind
     anywhere (no `/tmp`-equivalent plaintext `.mp4`) — playback must have
     stayed fully in-memory/streamed.
8. Confirm the video element never grew a `Content-Type`/CORS console error
   from the removed `crossOrigin="anonymous"` on offline sources (see
   `custom-video-player.tsx` — `crossOrigin` is now conditional on
   `isOfflineSource`).

### Video token lifecycle (for the reviewer, not a test step)

`resolveSlideSource({ isVideo: true, ... })` in `src/lib/offline/resolve.ts`
calls the native `openAsset({path, key, nonce, mimeType})` and returns
`{ kind: "offline-stream", url, release }`. `release()` wraps
`closeAsset(token)`. `slide-material.tsx` stores the returned `release` in
`offlineStreamReleaseRef` and calls it (a) at the top of every `loadContent`
run (i.e., whenever the active slide changes, before resolving the new
slide's content) and (b) on component unmount via a `useEffect` cleanup —
so at most one decrypt session should ever be open at a time, and none
should outlive the slide that opened it.

## 5. Spec §4 edge-case traceability

| Spec §4 case | Owning mechanism | How to test |
|---|---|---|
| 4.1 Permission resolution (explicit rules, ancestor override, course default) | `OfflineAccessResolver` (backend, unit-tested) + manifest version bumps + check-in `revocations[]` + soft "Update available" | §3.5 above; also toggle a per-chapter override in admin and confirm the node's download affordance appears/disappears after next manifest fetch |
| 4.1 Un-enrollment / revoke while offline | check-in `revocations[]`, `action: PURGE` | §3.4 above |
| 4.2 Resume after kill mid-download | `Range: bytes=<bytes_downloaded>-` in `chunked-downloader.ts`, boot recovery (`download-manager.ts init()` demotes `DOWNLOADING`→`PENDING`) | Start a large download, force-quit the app at ~30-50%, relaunch, confirm it resumes from the `.part` file's byte offset rather than restarting |
| 4.2 Disk-full mid-download | Preflight free-space check + mid-download pause, persistent "Storage full" banner | Fill the low-storage Android device (§1) to near-capacity, start a download that won't fit, confirm a clean pause + banner rather than a crash or corrupt `.enc` file |
| 4.2 Reinstall = clean slate | All state keyed by local SQLite; badges never assume server-side "already downloaded" | Uninstall/reinstall the app, log back in, confirm every previously-downloaded chapter shows "Not downloaded" (no ghost "Downloaded" badges) |
| 4.2 Per-slide all-or-nothing, per-asset retry | `download-manager.ts` slide DOWNLOADED only when all assets+payload done; failed asset retries without re-downloading finished siblings | Kill network mid-chapter-download so one asset fails; confirm sibling assets already finished are not re-downloaded on retry |
| 4.3 Sync ledger dedup | `offline_sync_event` `client_event_id` PK, `INSERT ... ON CONFLICT DO NOTHING` | Replay the same offline-queued batch twice (e.g. by forcing a flush retry) and confirm no duplicate activity/marks server-side |
| 4.3 Ordering + monotonic position guard | seq+clientTs sort, monotonic guard on `VIDEO_LAST_TIMESTAMP`/`DOCUMENT_LAST_PAGE`/`LAST_SLIDE_VIEWED` | Queue several offline video-position events out of order (simulate by editing `event_queue` rows), sync, confirm the server's stored last-position matches the highest `client_ts`, not the last event processed |
| 4.3 Server re-scoring + discrepancy review | `OfflineQuizRescoringService`, admin discrepancy review API | Submit a quiz offline with a tampered/incorrect client-side score, sync, confirm server marks win and a discrepancy row appears in the admin review queue |
| 4.3 Batch partial success | Per-event `REQUIRES_NEW` tx, HTTP 200 with mixed per-event status | Craft a batch with one malformed event among valid ones (if a test harness allows), confirm valid events still land as `ACCEPTED` |
| 4.4 Cancel mid-download | `AbortController` in `download-manager.ts cancelNode` | Start a chapter download, tap Cancel/Delete mid-flight, confirm the in-flight request aborts promptly (no lingering network activity) and `.part`/rows are cleaned up |
| 4.4 Global 2-job concurrency | `download-manager.ts` concurrency cap | Queue 4+ nodes at once, confirm only 2 download simultaneously (observe via progress bars advancing in pairs, or network activity) |
| 4.4 user_id partitioning (shared device) | Every offline table keyed by `user_id` | Log in as User A, download content, log out, log in as User B on the same device — confirm User B sees an empty Downloads screen and no access to User A's decrypted content (§3.4-adjacent: also re-confirm after a revoke that the *other* user's data was untouched) |
| §7 Third-party/online-only content offline | `isOnlineOnlySlide` gate → `RequiresInternetSlide` | Go offline on a chapter containing a YouTube/Vimeo/embed/ASSESSMENT slide, confirm the "This content requires internet" message instead of a broken player |

## 6. Known gaps to flag if hit during QA (not blockers, but expected)

- iOS/Android native `OfflineMedia` plugin code was verified by test-vector
  math + code inspection, **not** compiled in this environment (no iOS/
  Android toolchain available) — §2 above is the first real compile check.
- No automated integration test exists yet for the Android
  `OfflineMediaServer` localhost responder or the Electron
  `protocol.handle` path — only the shared AES-CTR counter math has a
  passing Node test script (`scripts/offline-media-test-vectors.ts`).
- Background/foreground-service downloading is out of scope for v1 (the UI
  says "Keep the app open while downloading") — don't file a bug for a
  download pausing when the app is backgrounded; confirm instead that it
  resumes correctly on foreground.
