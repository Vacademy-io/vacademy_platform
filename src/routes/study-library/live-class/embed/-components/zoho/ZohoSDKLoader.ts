import { ZOHO_MEETING_SDK_URL, ZOHO_MEETING_SDK_GLOBAL, ZOHO_SDK_INIT_TIMEOUT_MS } from "./constants";

/**
 * Singleton script loader — loads the Zoho SDK once and caches the promise.
 * Subsequent calls return the same promise (idempotent).
 */
class ZohoSDKLoader {
    private loadPromise: Promise<void> | null = null;

    load(): Promise<void> {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise<void>((resolve, reject) => {
            // Already loaded by a previous render/route
            if ((window as any)[ZOHO_MEETING_SDK_GLOBAL]) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = ZOHO_MEETING_SDK_URL;
            script.async = true;

            const timeout = setTimeout(() => {
                reject(new Error(`Zoho SDK load timed out after ${ZOHO_SDK_INIT_TIMEOUT_MS}ms`));
            }, ZOHO_SDK_INIT_TIMEOUT_MS);

            script.onload = () => {
                clearTimeout(timeout);
                if ((window as any)[ZOHO_MEETING_SDK_GLOBAL]) {
                    resolve();
                } else {
                    reject(new Error(`Zoho SDK loaded but '${ZOHO_MEETING_SDK_GLOBAL}' not found on window`));
                }
            };

            script.onerror = () => {
                clearTimeout(timeout);
                this.loadPromise = null; // allow retry
                reject(new Error("Failed to load Zoho Meeting SDK script"));
            };

            document.head.appendChild(script);
        });

        return this.loadPromise;
    }

    /** Returns the global SDK object if already loaded */
    getSDK(): any | null {
        return (window as any)[ZOHO_MEETING_SDK_GLOBAL] ?? null;
    }
}

// Export as singleton
export const zohoSDKLoader = new ZohoSDKLoader();
