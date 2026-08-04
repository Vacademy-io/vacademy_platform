/**
 * Handles the "Failed to fetch dynamically imported module" failure mode
 * that happens when a user's tab is older than the currently-deployed build:
 * the main bundle references hashed chunk filenames that no longer exist on
 * the CDN, so the lazy import 404s. The fix is to force a hard reload so the
 * browser pulls a fresh index.html and its current chunk references.
 *
 * A second, more common failure mode on Cloudflare Pages: there is no 404 for
 * unmatched paths, so during the deploy-propagation window an edge that has
 * the new index.html but not yet its assets answers `GET /assets/<chunk>.js`
 * with the SPA fallback — **200 text/html**, and (verified in prod) with
 * `cache-control: public, max-age=14400`. The browser then caches that HTML
 * body under the .js URL for four hours, so a plain location.reload() re-reads
 * the poisoned entry and can never recover. Every recovery here therefore
 * re-fetches the failed URLs with `cache: 'reload'` first — that both bypasses
 * and OVERWRITES the poisoned HTTP-cache entry — and only then reloads.
 *
 * Reloads are spaced by a small backoff so retries land after the propagation
 * window closes rather than three times inside it, and a sessionStorage-backed
 * budget prevents infinite loops when a deploy ships genuinely broken chunks.
 *
 * NOTE: index.html carries an inline pre-boot guard for the case this module
 * can never see — an entry-graph chunk failing before the app boots. It uses
 * the same sessionStorage key, limits, backoff and purge; keep the two in sync.
 */

const RELOAD_KEY = 'vacademy:chunk-reload-attempts';
/**
 * Must comfortably exceed MAX_RELOADS × (PURGE_TIMEOUT_MS + BACKOFF_MS + page
 * load), otherwise the record expires between retries, the budget resets and
 * the page reloads forever.
 */
const RELOAD_WINDOW_MS = 60_000;
const MAX_RELOADS = 3;
/** Delay before reload, indexed by attempts already spent. */
const BACKOFF_MS = [0, 1_500, 3_000];
/**
 * Cap on waiting for the cache purge, so a hanging edge can't strand the page.
 * Generous on purpose: a purge that is cut short mid-download does not replace
 * the cached entry, so the poison survives into the next attempt. The entry
 * chunk alone is ~8 MB, and the reload has to re-fetch all of this anyway.
 */
const PURGE_TIMEOUT_MS = 8_000;

interface ReloadRecord {
    count: number;
    firstAt: number;
}

export function isChunkLoadError(err: unknown): boolean {
    if (!err) return false;
    const errObj = err as { name?: string; message?: string };
    const name = errObj.name ?? '';
    const message = errObj.message ?? (typeof err === 'string' ? err : '');
    return (
        name === 'ChunkLoadError' ||
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('error loading dynamically imported module') ||
        message.includes('Unable to preload CSS')
    );
}

/**
 * Detects the React.lazy resolver crash where the dynamic import resolved
 * but the resulting module object was undefined — so React's internal
 * `moduleObject.default` access throws a TypeError. This is observed in the
 * wild after a deploy when a stale tab fetches a chunk filename whose body
 * was rewritten or replaced (the request itself succeeds, so it does not
 * surface as a ChunkLoadError).
 *
 * The message wording differs per browser engine:
 *   - V8 (Chrome/Edge):   "Cannot read properties of undefined (reading 'default')"
 *   - SpiderMonkey (FF):  "can't access property \"default\" of undefined"
 *   - JSC (Safari):       "undefined is not an object (evaluating 'X.default')"
 */
export function isLazyResolverError(err: unknown): boolean {
    if (!err) return false;
    const errObj = err as { name?: string; message?: string };
    if (errObj.name !== 'TypeError') return false;
    const message = errObj.message ?? '';
    return (
        /reading ['"]default['"]/.test(message) ||
        /property ['"]default['"] of undefined/.test(message) ||
        /evaluating ['"][^'"]*\.default['"]/.test(message)
    );
}

function readRecord(): ReloadRecord {
    try {
        const raw = sessionStorage.getItem(RELOAD_KEY);
        if (!raw) return { count: 0, firstAt: 0 };
        const parsed = JSON.parse(raw) as ReloadRecord;
        if (Date.now() - parsed.firstAt > RELOAD_WINDOW_MS) {
            return { count: 0, firstAt: 0 };
        }
        return parsed;
    } catch {
        return { count: 0, firstAt: 0 };
    }
}

function writeRecord(record: ReloadRecord): void {
    try {
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify(record));
    } catch {
        // Private-mode / quota errors — nothing we can do
    }
}

/**
 * URLs of our own build assets that have failed this page load. Populated
 * opportunistically — resource-error events carry the URL directly, dynamic
 * import failures only mention it inside the message text.
 */
const failedAssetUrls = new Set<string>();

/**
 * At most one recovery per page load, however many chunks failed at once.
 * Kept on `window` because index.html's pre-boot guard shares it — otherwise
 * both guards would fire for the same failure and spend two budget slots.
 */
declare global {
    interface Window {
        __chunkRecovering__?: boolean;
    }
}

/** Only our hashed build output; never third-party scripts. */
function isOwnAssetUrl(url: string): boolean {
    return url.startsWith(`${window.location.origin}/assets/`);
}

export function rememberFailedAsset(url: string | undefined | null): void {
    if (url && isOwnAssetUrl(url)) failedAssetUrls.add(url);
}

/** Pull any same-origin /assets/ URL out of a chunk-error message. */
export function rememberFailedAssetsFrom(err: unknown): void {
    const message =
        typeof err === 'string' ? err : (err as { message?: string } | null)?.message ?? '';
    for (const match of message.matchAll(/https?:\/\/[^\s"')]+\/assets\/[^\s"')]+/g)) {
        rememberFailedAsset(match[0]);
    }
}

/**
 * Re-fetch every failed asset with `cache: 'reload'`, which forces a network
 * hit AND writes the response back over the cached entry — the only way to
 * evict a poisoned body that a plain reload would otherwise keep serving.
 * Always resolves; a failed purge just means we reload without it.
 */
function purgePoisonedCacheEntries(): Promise<void> {
    if (typeof fetch !== 'function' || failedAssetUrls.size === 0) return Promise.resolve();
    const purges = Array.from(failedAssetUrls, (url) =>
        fetch(url, { cache: 'reload', credentials: 'same-origin' }).then(
            () => undefined,
            () => undefined
        )
    );
    return Promise.race([
        Promise.all(purges).then(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, PURGE_TIMEOUT_MS)),
    ]);
}

/**
 * Recover the page, subject to a retry budget. Returns true if recovery was
 * started; false when the budget is exhausted and the caller should fall back
 * to a visible error UI.
 *
 * Recovery is asynchronous — the poisoned cache entries are purged and the
 * backoff elapses before the reload — so a `true` return means "handled",
 * not "already reloaded". Callers must not reload themselves on true.
 *
 * Also a no-op while a Zoom meeting is active — the SDK fires unhandled
 * rejections during reconnect/visibilitychange that look like chunk errors
 * but aren't; reloading the page in the middle of a live meeting is a
 * worse user experience than letting the SDK recover on its own.
 *
 * Both a runtime flag (set by the Zoom player when it mounts) and a URL
 * check are used; the URL check is the safety net in case the flag isn't
 * set yet when the first error fires (e.g. during initial route render).
 */
export function reloadForChunkError(): boolean {
    if (typeof window === 'undefined') return false;
    if ((window as unknown as { __zoomMeetingActive?: boolean }).__zoomMeetingActive) {
        return false;
    }
    // URL-based safety net: any /host/ (admin) or /embed (learner) path is
    // a live-meeting route — never reload regardless of flag timing.
    const path = window.location.pathname;
    if (path.includes('/live-session/host/') || path.includes('/live-class/embed')) {
        return false;
    }
    if (window.__chunkRecovering__) return true;
    const record = readRecord();
    if (record.count >= MAX_RELOADS) {
        return false;
    }
    window.__chunkRecovering__ = true;
    writeRecord({
        count: record.count + 1,
        firstAt: record.firstAt || Date.now(),
    });
    const delay = BACKOFF_MS[record.count] ?? 0;
    void purgePoisonedCacheEntries().then(() => {
        setTimeout(() => window.location.reload(), delay);
    });
    return true;
}

/**
 * Install global listeners for dynamic-import failures so stale tabs recover
 * without reaching any route-level error boundary. Call once at app bootstrap.
 *
 * - `vite:preloadError` is Vite's native event for preload failures of
 *   dynamically-imported chunks. Calling preventDefault suppresses the throw.
 * - `unhandledrejection` and `error` cover dynamic imports (e.g. React.lazy,
 *   manual import() calls) that bypass Vite's preload path.
 */
export function installChunkErrorHandler(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('vite:preloadError', (event) => {
        rememberFailedAsset((event as unknown as { payload?: { url?: string } }).payload?.url);
        rememberFailedAssetsFrom((event as unknown as { payload?: unknown }).payload);
        if (reloadForChunkError()) {
            event.preventDefault();
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        if (isChunkLoadError(event.reason) || isLazyResolverError(event.reason)) {
            rememberFailedAssetsFrom(event.reason);
            if (reloadForChunkError()) {
                event.preventDefault();
            }
        }
    });

    // Capture phase: resource-load failures (a <script>/<link> that came back
    // as fallback HTML) do not bubble, and they carry the URL we need to purge.
    window.addEventListener(
        'error',
        (event) => {
            const target = event.target as (HTMLElement & { src?: string; href?: string }) | null;
            if (target && target !== (window as unknown as EventTarget) && target.tagName) {
                const rel = String((target as HTMLLinkElement).rel ?? '').toLowerCase();
                const url =
                    target.tagName === 'SCRIPT'
                        ? target.src
                        : rel === 'stylesheet' || rel === 'modulepreload'
                          ? target.href
                          : undefined;
                if (url && isOwnAssetUrl(url)) {
                    rememberFailedAsset(url);
                    reloadForChunkError();
                }
                return;
            }
            if (
                isChunkLoadError(event.error) ||
                isChunkLoadError(event.message) ||
                isLazyResolverError(event.error)
            ) {
                rememberFailedAssetsFrom(event.error ?? event.message);
                if (reloadForChunkError()) {
                    event.preventDefault();
                }
            }
        },
        true
    );
}
