import { IZohoMeetingStrategy, ZohoMeetingConfig } from "./types";
import { zohoSDKLoader } from "./ZohoSDKLoader";
import { ZOHO_MEETING_SDK_GLOBAL } from "./constants";

/**
 * SDK-based strategy — uses the official Zoho Meeting JS SDK.
 * This bypasses CSP iframe restrictions by rendering directly in the DOM.
 *
 * Zoho SDK docs: https://www.zoho.com/meeting/developer/
 */
export class ZohoSDKStrategy implements IZohoMeetingStrategy {
    readonly name = "sdk";

    /** The SDK instance returned by `ZohoMeeting.init(...)` */
    private sdkInstance: any = null;

    isSupported(): boolean {
        // Available in any standard browser with network access to Zoho CDN
        return typeof window !== "undefined";
    }

    async mount(container: HTMLElement, config: ZohoMeetingConfig): Promise<void> {
        // 1. Ensure SDK script is loaded
        await zohoSDKLoader.load();

        const ZohoMeeting = (window as any)[ZOHO_MEETING_SDK_GLOBAL];
        if (!ZohoMeeting) {
            throw new Error("Zoho Meeting SDK not available after load");
        }

        // 2. Give the container a stable id so the SDK can find it
        if (!container.id) {
            container.id = `zoho-meeting-${config.meetingKey}`;
        }

        // 3. Initialize the SDK.
        //    The exact API shape depends on the Zoho SDK version — adjust if Zoho updates their SDK.
        //    Common patterns observed in Zoho documentation:
        //      ZohoMeeting.init({ meetingKey, embedToken, containerId, region })
        //      ZohoMeeting.joinMeeting({ ... })
        //
        //    We try `init` first (newer API), then fall back to `joinMeeting`.
        if (typeof ZohoMeeting.init === "function") {
            this.sdkInstance = await ZohoMeeting.init({
                meetingKey: config.meetingKey,
                embedToken: config.embedToken ?? undefined,
                containerId: container.id,
                region: config.tld,
            });
        } else if (typeof ZohoMeeting.joinMeeting === "function") {
            this.sdkInstance = await ZohoMeeting.joinMeeting({
                meetingKey: config.meetingKey,
                token: config.embedToken ?? undefined,
                container: container.id,
                region: config.tld,
            });
        } else {
            throw new Error(
                `Zoho SDK loaded but no known init method found. ` +
                `Available keys: ${Object.keys(ZohoMeeting).join(", ")}`
            );
        }
    }

    unmount(): void {
        try {
            if (this.sdkInstance && typeof this.sdkInstance.destroy === "function") {
                this.sdkInstance.destroy();
            } else if (this.sdkInstance && typeof this.sdkInstance.leave === "function") {
                this.sdkInstance.leave();
            }
        } catch {
            // Best-effort cleanup — SDK may have already cleaned up
        }
        this.sdkInstance = null;
    }
}
