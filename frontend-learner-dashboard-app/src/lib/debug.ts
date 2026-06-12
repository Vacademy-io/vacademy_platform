/**
 * Debugging utilities for development to detect performance issues and potential stack overflows.
 *
 * Counter accounting: a pending timeout is released BOTH when it fires and when
 * it is cleared via clearTimeout. The original version never decremented on
 * clearTimeout, so ordinary debounce/tooltip churn leaked the counter upward
 * forever and produced false "infinite re-render loop" warnings.
 */
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    const pendingIds = new Set<number>();
    const MAX_PENDING = 100;
    let warnedAt = 0;

    (window as unknown as { setTimeout: unknown }).setTimeout = function(handler: TimerHandler, timeout?: number, ...args: unknown[]) {
        const wrappedHandler = (...hArgs: unknown[]) => {
            pendingIds.delete(id);
            if (typeof handler === 'function') {
                return (handler as (...a: unknown[]) => void)(...hArgs);
            }
            return (handler as unknown);
        };

        const id = originalSetTimeout(wrappedHandler as TimerHandler, timeout, ...args);
        pendingIds.add(id);

        // Warn at most once per threshold crossing, not on every call.
        if (pendingIds.size > MAX_PENDING && pendingIds.size > warnedAt) {
            warnedAt = pendingIds.size * 2;
            console.warn(`[DEBUG] High number of pending timeouts detected: ${pendingIds.size}. This might indicate an infinite recursion or re-render loop.`);
        }

        return id;
    };

    (window as unknown as { clearTimeout: unknown }).clearTimeout = function(id?: number) {
        if (typeof id === 'number') pendingIds.delete(id);
        return originalClearTimeout(id);
    };
}

export {};
