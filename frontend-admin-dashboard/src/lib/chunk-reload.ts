/**
 * Handles the "Failed to fetch dynamically imported module" failure mode
 * that happens when a user's tab is older than the currently-deployed build:
 * the main bundle references hashed chunk filenames that no longer exist on
 * the CDN, so the lazy import 404s. The fix is to force a hard reload so the
 * browser pulls a fresh index.html and its current chunk references.
 *
 * A sessionStorage-backed budget prevents infinite reload loops in the rare
 * case that a deploy ships genuinely broken chunks.
 */

const RELOAD_KEY = 'vacademy:chunk-reload-attempts';
const RELOAD_WINDOW_MS = 10_000;
const MAX_RELOADS = 2;

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
 * Reload the page, subject to a retry budget. Returns true if a reload was
 * triggered; false when the budget is exhausted and the caller should fall
 * back to a visible error UI.
 */
export function reloadForChunkError(): boolean {
    if (typeof window === 'undefined') return false;
    const record = readRecord();
    if (record.count >= MAX_RELOADS) {
        return false;
    }
    writeRecord({
        count: record.count + 1,
        firstAt: record.firstAt || Date.now(),
    });
    window.location.reload();
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
        if (reloadForChunkError()) {
            event.preventDefault();
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        if (isChunkLoadError(event.reason) || isLazyResolverError(event.reason)) {
            if (reloadForChunkError()) {
                event.preventDefault();
            }
        }
    });

    window.addEventListener('error', (event) => {
        if (
            isChunkLoadError(event.error) ||
            isChunkLoadError(event.message) ||
            isLazyResolverError(event.error)
        ) {
            if (reloadForChunkError()) {
                event.preventDefault();
            }
        }
    });
}
