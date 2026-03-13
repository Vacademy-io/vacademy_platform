// ─── Shared config passed to every strategy ──────────────────────────────────
export interface ZohoMeetingConfig {
    meetingKey: string;       // numeric meeting ID (providerMeetingId)
    embedToken: string | null; // t= token (providerEmbedToken)
    meetingUrl: string;        // original join URL (used for TLD detection + fallback)
    tld: string;               // "in" | "eu" | "com.au" | "jp" | "com"
}

// ─── Strategy interface (ISP / DIP) ──────────────────────────────────────────
export interface IZohoMeetingStrategy {
    /** Unique name for logging/debugging */
    readonly name: string;
    /** True if this strategy can run in the current environment */
    isSupported(): boolean;
    /** Mount the meeting UI into `container` */
    mount(container: HTMLElement, config: ZohoMeetingConfig): Promise<void>;
    /** Clean up resources */
    unmount(): void;
}

// ─── Hook return shape ────────────────────────────────────────────────────────
export type ZohoMeetingStatus =
    | "idle"
    | "loading"
    | "ready"
    | "error"
    | "unsupported";

export interface ZohoMeetingState {
    status: ZohoMeetingStatus;
    error: string | null;
    activeStrategy: string | null;
}
