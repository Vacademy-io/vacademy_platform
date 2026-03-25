/**
 * Debugging utilities for development to detect performance issues and potential stack overflows.
 */
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const originalSetTimeout = window.setTimeout;
    let pendingTimeouts = 0;
    const MAX_PENDING = 100;

    // Monitor for excessive setTimeout calls which can indicate loops
    (window as unknown as { setTimeout: unknown }).setTimeout = function(handler: TimerHandler, timeout?: number, ...args: unknown[]) {
        pendingTimeouts++;
        
        if (pendingTimeouts > MAX_PENDING) {
            console.warn(`[DEBUG] High number of pending timeouts detected: ${pendingTimeouts}. This might indicate an infinite recursion or re-render loop.`);
        }

        const wrappedHandler = (...hArgs: unknown[]) => {
            pendingTimeouts--;
            if (typeof handler === 'function') {
                return (handler as (...a: unknown[]) => void)(...hArgs);
            }
            return (handler as unknown);
        };

        return originalSetTimeout(wrappedHandler as TimerHandler, timeout, ...args);
    };

    console.log("[DEBUG] Timeout monitoring enabled.");
}

export {};
