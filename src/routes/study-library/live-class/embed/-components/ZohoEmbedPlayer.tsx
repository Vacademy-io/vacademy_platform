import React from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import ZohoMeetingContainer from "./zoho/ZohoMeetingContainer";
import { ZohoMeetingConfig } from "./zoho/types";

interface ZohoEmbedPlayerProps {
    meetingUrl: string;
    /** Numeric meeting ID from Zoho (providerMeetingId from backend) */
    providerMeetingId?: string | null;
    /**
     * Embed auth token (t=...) from Zoho.
     * Required for the SDK / iframe to bypass Zoho login for learners.
     * Backend must store this when creating the meeting and return it here.
     */
    providerEmbedToken?: string | null;
}

const ZohoEmbedPlayer: React.FC<ZohoEmbedPlayerProps> = ({
    meetingUrl = "",
    providerMeetingId,
    providerEmbedToken,
}) => {
    const tldMatch = meetingUrl?.match(/zoho\.(in|eu|com\.au|jp|com)/);
    const tld = tldMatch ? tldMatch[1] : "com";

    // Full embed requires a meetingKey. The t= token is optional but needed for auth.
    // TODO: Remove TEST_EMBED_TOKEN once backend returns providerEmbedToken.
    const TEST_EMBED_TOKEN = "e24e91ce8b1f319b90d26040268661b3e2c8130b755240c4620e690a8cd372a6";
    const resolvedEmbedToken = providerEmbedToken ?? TEST_EMBED_TOKEN;

    if (providerMeetingId) {
        const config: ZohoMeetingConfig = {
            meetingKey: providerMeetingId,
            embedToken: resolvedEmbedToken,
            meetingUrl,
            tld,
        };

        const fallbackJoinUrl =
            meetingUrl ||
            `https://meeting.zoho.${tld}/meeting/${providerMeetingId}`;

        return (
            <ZohoMeetingContainer
                config={config}
                fallbackJoinUrl={fallbackJoinUrl}
            />
        );
    }

    // No meetingKey at all — show a plain join button.
    const joinUrl = meetingUrl;

    if (!joinUrl) {
        return (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
                No meeting URL available. Please contact support.
            </div>
        );
    }

    return (
        <div className="relative w-full h-full flex-1 min-h-[400px] flex flex-col items-center justify-center gap-4 bg-neutral-950 rounded-lg">
            <div className="flex flex-col items-center gap-3 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center">
                    <ArrowSquareOut size={32} className="text-primary-400" />
                </div>
                <h3 className="text-white text-xl font-semibold">Zoho Meeting</h3>
                <p className="text-neutral-400 text-sm max-w-xs">
                    Click below to join the live session. The meeting will open in a new tab.
                </p>
                <button
                    className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm transition-colors"
                    onClick={() => window.open(joinUrl, "_blank", "noopener,noreferrer")}
                >
                    Join Meeting
                    <ArrowSquareOut size={16} weight="bold" />
                </button>
            </div>
        </div>
    );
};

export default ZohoEmbedPlayer;
