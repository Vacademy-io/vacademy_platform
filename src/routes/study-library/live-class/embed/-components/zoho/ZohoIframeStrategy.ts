import { IZohoMeetingStrategy, ZohoMeetingConfig } from "./types";

/**
 * Iframe-based fallback strategy.
 * Uses `t=` embed token when available to bypass Zoho login for learners.
 * Without the token the iframe still renders but Zoho may show its login screen.
 * Note: Will fail if Zoho sets `X-Frame-Options: sameorigin` on the resulting page.
 */
export class ZohoIframeStrategy implements IZohoMeetingStrategy {
    readonly name = "iframe";

    private iframe: HTMLIFrameElement | null = null;

    isSupported(): boolean {
        // Always available as last-resort fallback
        return true;
    }

    mount(container: HTMLElement, config: ZohoMeetingConfig): Promise<void> {
        return new Promise((resolve, reject) => {
            const baseUrl =
                `https://meeting.zoho.${config.tld}/meeting/login/embedmeeting.jsp` +
                `?meetingKey=${encodeURIComponent(config.meetingKey)}` +
                `&newWindow=false`;

            const embedUrl = config.embedToken
                ? `${baseUrl}&t=${encodeURIComponent(config.embedToken)}`
                : baseUrl;

            const iframe = document.createElement("iframe");
            iframe.src = embedUrl;
            iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;";
            iframe.allow =
                "camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write; autoplay; picture-in-picture";
            iframe.allowFullscreen = true;
            iframe.title = "Zoho Meeting";

            iframe.onload = () => resolve();
            iframe.onerror = () => reject(new Error("Zoho iframe failed to load"));

            this.iframe = iframe;
            container.appendChild(iframe);
        });
    }

    unmount(): void {
        this.iframe?.remove();
        this.iframe = null;
    }
}
