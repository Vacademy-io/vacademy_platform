import React from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useZohoParticipantJoinLink } from "@/routes/study-library/live-class/-hooks/useZohoParticipantJoinLink";

interface ZohoEmbedPlayerProps {
    /** Fallback join URL shown if API call fails */
    meetingUrl: string;
    /** scheduleId + instituteId are used to fetch a personalized participant join link */
    scheduleId?: string | null;
    instituteId?: string | null;
    /** Optional — passed to Zoho so the participant appears with a real name */
    participantName?: string | null;
    participantEmail?: string | null;
}

const ZohoEmbedPlayer: React.FC<ZohoEmbedPlayerProps> = ({
    meetingUrl,
    scheduleId,
    instituteId,
    participantName,
    participantEmail,
}) => {
    const canFetch = !!scheduleId && !!instituteId;

    const { data, isLoading, error } = useZohoParticipantJoinLink(
        canFetch
            ? {
                  scheduleId: scheduleId!,
                  instituteId: instituteId!,
                  ...(participantName ? { participantName } : {}),
                  ...(participantEmail ? { participantEmail } : {}),
              }
            : null
    );

    const joinLink = data?.joinLink ?? meetingUrl;

    if (isLoading) {
        return (
            <div className="relative w-full h-full flex-1 min-h-[400px] flex items-center justify-center bg-neutral-900 rounded-lg">
                <div className="flex flex-col items-center gap-3 text-white">
                    <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-neutral-400">Connecting to meeting…</p>
                </div>
            </div>
        );
    }

    if (error && !meetingUrl) {
        return (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
                Failed to get meeting join link. Please contact support.
            </div>
        );
    }

    if (!joinLink) {
        return (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
                No meeting URL available. Please contact support.
            </div>
        );
    }

    // If we got a personalized join link from the API, embed it.
    // If we're in fallback mode (no scheduleId/instituteId or API errored),
    // show a join button instead — the generic joinLink might not be embeddable.
    if (data?.joinLink) {
        return (
            <div className="relative w-full h-full flex-1 min-h-[400px] bg-black rounded-lg overflow-hidden">
                <iframe
                    title="Zoho Meeting AV SDK"
                    src={joinLink}
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    allow="camera; microphone; clipboard-read; clipboard-write; fullscreen; display-capture"
                />
            </div>
        );
    }

    // Fallback: show join button
    return (
        <div className="relative w-full h-full flex-1 min-h-[400px] flex flex-col items-center justify-center gap-4 bg-neutral-950 rounded-lg">
            <div className="flex flex-col items-center gap-3 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center">
                    <ArrowSquareOut size={32} className="text-primary-400" />
                </div>
                <h3 className="text-white text-xl font-semibold">Zoho Meeting</h3>
                <p className="text-neutral-400 text-sm max-w-xs">
                    Click below to join the live session in a new tab.
                </p>
                <button
                    className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm transition-colors"
                    onClick={() => window.open(joinLink, "_blank", "noopener,noreferrer")}
                >
                    Join Meeting
                    <ArrowSquareOut size={16} weight="bold" />
                </button>
            </div>
        </div>
    );
};

export default ZohoEmbedPlayer;
