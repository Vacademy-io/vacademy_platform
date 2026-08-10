# OfflineMedia native plugin

In-repo Capacitor 7 local plugin (no npm package) providing the two things the offline-download
feature (plan §B1/B3/B4) cannot do from JavaScript alone:

1. Free disk space on the device's app-private storage volume.
2. Range-aware streaming AES-CTR decrypt of on-disk ciphertext video, served as a real HTTP(S)-ish
   URL a `<video>` tag can use directly (seeking included), without ever materializing plaintext
   on disk or as a giant in-memory Blob.

Video is the only media type that goes through this plugin. JSON slides decrypt in-memory;
PDF/audio/images decrypt to a Blob + `URL.createObjectURL` (capped ~80MB). Video can't use either
approach at GB scale, and Capacitor's `convertFileSrc` is explicitly forbidden here because the
file on disk **is ciphertext** — serving it directly would play garbage / leak ciphertext instead
of decrypting it.

## API

```ts
// src/lib/offline/native/offline-media.ts
getFreeDiskSpace(): Promise<FreeDiskSpace | null>       // null = native plugin unavailable (web)
openAsset(request: OpenAssetRequest): Promise<OpenAssetResult>
closeAsset(token: string): Promise<void>

interface FreeDiskSpace { freeBytes: number; totalBytes?: number }
interface OpenAssetRequest { path: string; key: string /* base64, 32 bytes */; nonce: string /* base64, 12 bytes */; mimeType?: string }
interface OpenAssetResult { token: string; url: string }
```

Native plugin surface (what each platform actually implements, called via `registerPlugin('OfflineMedia', ...)`):

```ts
getFreeDiskSpace(): Promise<{ bytes: number }>
openAsset(params: { path: string; keyB64: string; nonceB64: string; mimeType?: string }): Promise<{ token: string; url: string }>
closeAsset(params: { token: string }): Promise<void>
```

`offline-media.ts` is the only place that bridges between the two — see "Nonce contract" below for
why they differ (12 vs 16 bytes).

## URL / Range semantics per platform

| Platform | `url` shape | Serving mechanism |
|---|---|---|
| iOS | `offline-media://<token>/stream` | `WKURLSchemeHandler` registered on the `WKWebViewConfiguration` in `MainViewController.webViewConfiguration(for:)` |
| Android | `http://127.0.0.1:<port>/<token>/stream` | Single-purpose localhost `ServerSocket` HTTP/1.1 responder, started lazily on first `openAsset` |
| Electron | `offline-media://<token>/stream` | `protocol.handle('offline-media', ...)` in the main process (Electron 25+ API) |

All three:
- Honor a single `Range: bytes=start-end` / `bytes=start-` / `bytes=-suffixLength` request header (first range only — HTML5 video never sends multi-range requests).
- Return `206 Partial Content` + `Content-Range: bytes start-end/total` + `Accept-Ranges: bytes` when a Range header was present, `200 OK` + full `Content-Length` otherwise.
- Default `Content-Type` to `video/mp4` (or `video/webm` for a `.webm` path extension), overridable via `openAsset`'s optional `mimeType`.
- Decrypt only the bytes actually requested, streaming in ~64–256 KiB chunks (a multiple of the 16-byte AES block size) — never the whole file into memory.

## Platform implementation choice + rationale

- **iOS — `WKURLSchemeHandler`.** Capacitor 7's `CAPBridgeViewController` exposes
  `webViewConfiguration(for:)` as an overridable hook specifically for registering custom scheme
  handlers before the `WKWebView` is constructed (scheme handlers are immutable once the web view
  exists). `MainViewController` (`ios/App/App/MainViewController.swift`) subclasses it, registers
  `OfflineMediaSchemeHandler` for the `offline-media` scheme, and registers the `OfflineMediaPlugin`
  instance in `capacitorDidLoad()`. No fallback to a localhost server was needed — the scheme-handler
  path worked cleanly through Capacitor's public extension point.
- **Android — localhost `ServerSocket` responder.** Capacitor 7 plugins cannot cleanly hook
  `WebViewClient.shouldInterceptRequest` (owned by the Bridge's own `WebViewClient`, not exposed to
  plugin authors), and `androidx.webkit.WebViewLocalServer` is designed for serving static local
  *assets*, not range-aware on-the-fly decryption of an open native session. A tiny
  dependency-free HTTP/1.1 GET+Range responder bound to `127.0.0.1` (`OfflineMediaServer.java`) was
  the most direct option: one accept thread + a cached thread pool for connections, one thread per
  request, `Connection: close` after each response (simplest correct behavior — the WebView opens a
  new connection per Range request as needed, which is normal for local media servers).
- **Electron — `protocol.handle`.** Electron ^26.2.2 (see `electron/package.json`) supports the
  modern `protocol.handle` API (available since Electron 25), which returns a standard `Response`
  object backed by a `ReadableStream` — a clean fit for streaming decrypted chunks. The scheme is
  registered as privileged (`standard`, `secure`, `supportFetchAPI`, `stream`, `bypassCSP`,
  `corsEnabled`) via `protocol.registerSchemesAsPrivileged` at the top of `electron/src/index.ts`
  (must run before `app.whenReady()` resolves — Electron throws if done later). The actual
  `protocol.handle('offline-media', ...)` request handler is registered lazily, the first time the
  `OfflineMedia` plugin class is instantiated by `setupCapacitorElectronPlugins()` (called from
  `ElectronCapacitorApp.init()` in `electron/src/setup.ts`, after the app is ready).

### Android network security config

`android/app/src/main/res/xml/network_security_config.xml` was added and wired via
`android:networkSecurityConfig="@xml/network_security_config"` on `<application>` in
`AndroidManifest.xml`. It explicitly permits cleartext (plain HTTP) traffic to `127.0.0.1` and
`localhost` only; everything else stays TLS-only (`base-config cleartextTrafficPermitted="false"`,
system trust anchors), matching the rest of the app. Android's platform default already allows
cleartext to loopback on most versions, but this makes it explicit and future-proof rather than
relying on undocumented default behavior.

### Android plugin registration

`OfflineMediaPlugin` is a local, in-repo plugin (no `package.json`), so it is **not** picked up by
Capacitor's `capacitor.plugins.json` auto-registration (that mechanism only scans installed npm
plugin packages). It's registered explicitly in `MainActivity.onCreate()`:

```java
registerPlugin(OfflineMediaPlugin.class); // before super.onCreate()
```

This must happen before `super.onCreate()`, which is where the Bridge/WebView actually gets
constructed. `MainActivity.java` lives at
`android/app/src/main/java/com/template/app/MainActivity.java` declaring `package
io.vacademy.student.app;` — a pre-existing folder/package mismatch already in this codebase (Gradle
doesn't enforce path==package for Java). The new plugin sources follow the same convention: physical
path `android/app/src/main/java/com/template/app/offlinemedia/`, package
`io.vacademy.student.app.offlinemedia`. All Android product flavors (`seven_cs`, `ssdc`, `stemx`,
etc.) share the `main` sourceSet, so every flavor gets the plugin automatically — no per-flavor work
needed.

### Electron plugin bridging

Follows the existing `@capacitor-community/electron` local-plugin convention already used by this
app (no new mechanism introduced):

- `electron/src/offline-media-plugin.ts` exports an `OfflineMedia` class with `getFreeDiskSpace`,
  `openAsset`, `closeAsset` methods.
- `electron/src/rt/electron-plugins.js` exports that class (`module.exports = { offlineMedia: { OfflineMedia } }`).
- `setupCapacitorElectronPlugins()` (called from `ElectronCapacitorApp.init()` in `setup.ts`)
  instantiates it once and auto-bridges every prototype method to
  `ipcMain.handle('OfflineMedia-<method>', ...)`.
- `electron/src/rt/electron-rt.ts` (already required from `electron/src/preload.ts`) mirrors that
  automatically as `window.CapacitorCustomPlatform.plugins.OfflineMedia.<method>(...)` via
  `contextBridge.exposeInMainWorld`.
- `src/lib/offline/native/offline-media.ts` declares an explicit `electron` `jsImplementation` in
  its `registerPlugin('OfflineMedia', { web, electron })` call that forwards to
  `window.CapacitorCustomPlatform.plugins.OfflineMedia` — declaring this explicitly (rather than
  relying on Capacitor core's "unknown custom platform falls back to the `web` implementation"
  behavior) keeps Electron on its real native implementation instead of silently degrading.

No changes to `electron/src/preload.ts` were needed — it already `require('./rt/electron-rt')`,
which is where the bridge is built.

## Nonce contract — 12 bytes on disk, 16 bytes at the native boundary

This is the part most likely to silently break across platforms if touched carelessly, so it's
documented once, here, as the source of truth alongside `src/lib/offline/crypto/ctr.ts`.

The JS downloader stores a **random 12-byte nonce per file** in the `assets.nonce` DB column
(base64). It encrypts with WebCrypto:

```ts
counter: nonce(12 bytes) || big-endian-uint32(blockIndex)   // 16-byte counter block
length: 32                                                    // only the LAST 4 bytes increment
```

`blockIndex = floor(byteOffset / 16)`. Critically, WebCrypto's `length: 32` means **only the last 4
bytes of the 16-byte counter block ever change** — the 12-byte nonce prefix is fixed for the whole
file, for every block, forever.

None of the three native implementations receive that raw 12-byte value. `openAsset` in
`src/lib/offline/native/offline-media.ts` zero-pads it first:

```
paddedNonce16 = nonce(12 bytes) || 0x00 0x00 0x00 0x00
```

...and only ever sends that 16-byte, zero-padded value to native code as `nonceB64`. All three
native implementations then treat their `nonce` parameter as a full 16-byte value and compute, for
an arbitrary request byte offset:

```
blockIndex   = floor(offset / 16)
counterBlock = (nonce_as_big_endian_uint128 + blockIndex) mod 2^128
keystream    = AES-256-ECB-encrypt(key, counterBlock)      // one block
plaintext    = ciphertext XOR keystream                    // trim (offset mod 16) bytes off the first block if offset isn't 16-aligned
```

This 128-bit addition is **mathematically identical** to WebCrypto's "only the last 4 bytes
increment" rule for any realistic file size: `blockIndex` would have to reach 2³² (a ~64 TiB single
file) before the addition could ever carry into the fixed 12-byte prefix. This equivalence — and
the padding step — only holds because the 16-byte value native code receives is *exactly*
`nonce(12) || 0x00000000`, never a randomly-generated 16-byte value and never the raw 12-byte DB
value left unpadded. `src/lib/offline/native/offline-media.ts`'s `padNonceTo16Bytes` is the single
place this happens and asserts the input is exactly 12 bytes before padding.

Electron's implementation (`electron/src/offline-media-crypto.ts`) doesn't hand-roll AES-ECB like
iOS/Android must — Node's `crypto.createCipheriv('aes-256-ctr', key, counterBlock)` already
increments its internal counter the same way per 16-byte block once seeded with the correct
starting counter block, so it only needs to compute that starting block for the requested offset
and let Node's CTR cipher stream from there.

### Sub-block (non-16-aligned) offset handling

The downloader's own ciphertext chunk writes are always 16-byte-aligned (8 MiB chunks, already a
multiple of 16), but **HTTP Range requests during video seeking are not** — a browser/WebView can
ask for an arbitrary byte offset. All three implementations handle this: compute `blockIndex =
floor(offset/16)` and `subOffset = offset % 16`, decrypt starting from that block's keystream, and
discard the first `subOffset` bytes of the first keystream block before emitting ciphertext-XOR
output. Verified explicitly by test vector 3 below.

## Test vectors

Generated and verified by `scripts/offline-media-test-vectors.ts`
(`node_modules/.bin/ts-node scripts/offline-media-test-vectors.ts`, `TS_NODE_TRANSPILE_ONLY=true`
for speed). Plaintext is encrypted with Node's real `crypto.webcrypto.subtle` AES-CTR
implementation (ground truth — the same primitive real browsers use, not a reimplementation), then
decrypted with the exact `decryptRange`/`addCounter` functions from
`electron/src/offline-media-crypto.ts` — the same code the Electron plugin runs at runtime, so
there's no risk of the test drifting from the real implementation. iOS
(`OfflineMediaCrypto.swift`) and Android (`OfflineMediaCrypto.java`) were verified by code
inspection against this exact algorithm (see the "Nonce contract" section above) — they were not
compiled/run as part of this pass; see "Remaining work" below.

**Result: all 3 vectors pass.**

| # | Case | Offset | Key (hex) | Nonce 12B (hex) | Padded Nonce 16B (hex) | Plaintext (hex, full) | Ciphertext (hex, full) | Expected plaintext slice @ offset | Actual (native math) | Pass |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Aligned, full range (offset 0, 3 blocks) | 0 | `8ab564b8ef52ff7947989d9b563950182 58d3fb17b10217628ec45ed6d07ada0` | `a78515f6e60966d6d1bba0a8` | `a78515f6e60966d6d1bba0a800000000` | `41414141...43434343` (48B) | `a2f0646e...c8647993d` | = full plaintext | = full plaintext | ✅ |
| 2 | Aligned, mid-file (offset 32, block index 2) | 32 | `16d9b75d9e9ec5bb531cbcb06a9663ed95 cb41e545018f5f516867fc42131e6f` | `c8a8a0cca251355f8c50c553` | `c8a8a0cca251355f8c50c55300000000` | `31313131...33333333` (48B) | `eb8916fd...9bde3ca8f5cd8` | `33333333333333333333333333333333` | `33333333333333333333333333333333` | ✅ |
| 3 | **Non-aligned** (offset 20 = block 1 + 4 bytes; simulates a mid-block HTTP Range seek) | 20 | `44e02d7ea34fd066ae49d5028d5f32be92 503c8c83b9e09d03f20f56bed0ebca` | `64f462decf1d07e1cf2361a4` | `64f462decf1d07e1cf2361a400000000` | `30313233...696a6b6c` (48B) | `24073e54...5746c2e51e34f9af2` | `4b4c4d4e4f505152535455565758595a6162636465666768696a6b6c` | `4b4c4d4e4f505152535455565758595a6162636465666768696a6b6c` | ✅ |

(Hex values above are wrapped for table width — run the script for the unwrapped, copy-pasteable
JSON output, which also includes full ciphertext for every vector.)

`scripts/package.json` (`{"type": "commonjs"}`) was added because the app root `package.json` has
`"type": "module"`, which otherwise makes Node try to load `.ts`/`.cjs`-adjacent files under
`scripts/` as ES modules before ts-node's CommonJS require hook gets a chance to run; this scopes
CommonJS resolution to the `scripts/` directory only and doesn't affect the existing `.mjs` scripts
there (explicit `.mjs` always forces ESM regardless of `package.json` `type`).

## Threat notes

- Key material (`key`, `nonce`) exists only in memory for the lifetime of an open `openAsset`
  session (a `Map`/`ConcurrentHashMap`/`NSLock`-guarded dictionary keyed by opaque UUID token),
  never written to disk, never logged.
- `closeAsset` overwrites (`fill(0)` / `Arrays.fill(..., 0)` / manual zero loop) the key and nonce
  bytes before dropping the session, on all three platforms — best-effort zeroization; Swift/Java/JS
  GC and memory management mean this reduces but does not eliminate the window a debugger or memory
  dump could observe key material, matching the project's stated threat model (device-local key,
  not defending against a fully compromised/rooted device with live debugger access).
- The Android localhost server binds to `127.0.0.1` specifically (not `0.0.0.0`), so it is never
  reachable from outside the device.
- iOS/Electron's `offline-media://` scheme only resolves requests whose host is a currently-open
  session token — an unknown/expired/already-closed token returns `404`, never falls back to
  serving arbitrary files.
- No decrypted plaintext is ever written to disk on any platform — decryption happens per-chunk,
  in memory, streamed directly into the HTTP-ish response.

## Remaining work / not done here

- **Video player integration** (setting `<video src>` to the returned `url`, calling `closeAsset`
  on unmount/src change, force-hiding the download button for offline sources) is a separate phase
  — `custom-video-player.tsx`, `slide-material.tsx`, and `resolve.ts` were explicitly out of scope
  for this pass and were not touched.
- **iOS/Android were not compiled.** Per this task's constraints, `pod install`/`xcodebuild` were
  not run (no iOS toolchain guaranteed in this environment) and no Android Gradle build/assemble
  was run (only `npx cap update android`, which exited 0 and only touches plugin manifest
  bookkeeping, not a real compile). Both were verified by careful code inspection against the
  WebCrypto-verified test vectors above, matching Capacitor 7's documented `CAPBridgedPlugin`
  (iOS)/`@CapacitorPlugin` (Android) local-plugin patterns. Compile-verifying them is the natural
  next step before shipping.
- **iOS Xcode project file.** `ios/App/App.xcodeproj/project.pbxproj` was hand-edited to add the
  four new Swift files (`OfflineMediaPlugin.swift`, `OfflineMediaSchemeHandler.swift`,
  `OfflineMediaCrypto.swift`, `MainViewController.swift`) to every target's Compile Sources build
  phase, and `Main.storyboard`'s root view controller class was changed from
  `CAPBridgeViewController` to `MainViewController` to route through the new subclass. The edit was
  verified with `plutil -lint` (passed — well-formed plist/pbxproj) rather than a full Xcode
  open/build, since no Xcode toolchain was available in this environment. **Recommended manual
  verification before shipping:** open the project in Xcode once and confirm (a) all four new files
  show up in each target's "Compile Sources" build phase in the target's Build Phases tab, and (b)
  the storyboard's root view controller's Custom Class is `MainViewController` for every flavor
  target — if the pbxproj edit missed a target, Xcode's file inspector will show it un-checked for
  that target's membership, a one-click fix.
- **No integration/unit test harness exists yet** for either the Android or Electron plugin classes
  in this repo (no Kotlin test setup, no Jest/Vitest config wired to run against `electron/src/`).
  The Node test-vector script above is the only automated verification currently in place; it
  covers the shared counter-math contract but not the HTTP/localhost-server/scheme-handler request
  plumbing on any platform.
