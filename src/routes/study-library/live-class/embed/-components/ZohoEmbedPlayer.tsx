import React from "react";

interface ZohoEmbedPlayerProps {
    meetingUrl: string;
    /** The provider_meeting_id from the backend — used as the Zoho embed key */
    providerMeetingId?: string | null;
}

const ZohoEmbedPlayer: React.FC<ZohoEmbedPlayerProps> = ({
    meetingUrl = "",
    providerMeetingId,
}) => {
    const getEmbedUrl = () => {
        // --- Primary: use providerMeetingId directly as the Zoho key ---
        if (providerMeetingId) {
            // Infer the Zoho regional domain from the meetingUrl if possible
            const tldMatch = meetingUrl.match(/zoho\.(in|eu|com\.au|jp|com)/);
            const tld = tldMatch ? tldMatch[1] : "com";
            const embedUrl = `https://meeting.zoho.${tld}/embed?key=${providerMeetingId}`;
            console.log("[ZohoEmbed] Using providerMeetingId:", providerMeetingId);
            console.log("[ZohoEmbed] Embed URL:", embedUrl);
            return embedUrl;
        }

        // --- Fallback: parse the key from the meeting URL ---
        console.log("[ZohoEmbed] providerMeetingId not available, parsing URL:", meetingUrl);
        if (!meetingUrl) return "";

        // Matches: meet.zoho.xx/KEY  or  meeting.zoho.xx/meeting/KEY
        const urlMatch = meetingUrl.match(
            /(?:meet|meeting)\.zoho\.(in|eu|com\.au|jp|com)\/(?:meeting\/)?([a-zA-Z0-9-]+)\/?(?:\?.*)?$/
        );
        if (urlMatch) {
            const tld = urlMatch[1];
            const key = urlMatch[2];
            const embedUrl = `https://meeting.zoho.${tld}/embed?key=${key}`;
            console.log("[ZohoEmbed] Parsed key from URL:", key, "→", embedUrl);
            return embedUrl;
        }

        console.warn("[ZohoEmbed] Could not determine embed URL, using meetingUrl as-is");
        return meetingUrl;
    };

    const embedUrl = getEmbedUrl();

    if (!embedUrl) {
        return (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
                No meeting URL provided.
            </div>
        );
    }

    return (
        <div className="relative w-full h-full flex-1 min-h-[400px] bg-black rounded-lg overflow-hidden">
            <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                width="100%"
                height="100%"
                frameBorder={0}
                allow="camera; microphone; display-capture; fullscreen"
                allowFullScreen
                title="Zoho Meeting"
            />
        </div>
    );
};

export default ZohoEmbedPlayer;
