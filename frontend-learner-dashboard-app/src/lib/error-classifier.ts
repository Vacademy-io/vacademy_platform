export type ErrorCategory = 'network' | 'offline' | 'runtime' | 'chunk' | 'unknown';

export function classifyError(error: unknown): ErrorCategory {
    if (!error) return 'unknown';

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return 'offline';
    }

    const err = error as { name?: string; message?: string };
    const name = err.name ?? '';
    const message = (err.message ?? (typeof error === 'string' ? error : '')).toLowerCase();

    if (
        name === 'ChunkLoadError' ||
        message.includes('failed to fetch dynamically imported module') ||
        message.includes('importing a module script failed') ||
        message.includes('unable to preload css')
    ) {
        return 'chunk';
    }

    // Browsers emit TypeError: "Failed to fetch" for both CORS blocks and network failures.
    // There is no way to distinguish CORS from a downed server from client JS — both show
    // the same opaque error. We surface both as a network/maintenance page.
    if (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('network error') ||
        message.includes('cors') ||
        message.includes('err_network') ||
        message.includes('err_internet_disconnected') ||
        message.includes('err_connection_refused') ||
        (name === 'TypeError' && message.includes('fetch'))
    ) {
        return 'network';
    }

    if (
        name === 'TypeError' ||
        name === 'ReferenceError' ||
        name === 'RangeError' ||
        name === 'SyntaxError' ||
        name === 'URIError' ||
        name === 'EvalError'
    ) {
        return 'runtime';
    }

    return 'unknown';
}
