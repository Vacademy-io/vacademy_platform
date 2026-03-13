import React, { useRef } from "react";
import { ArrowSquareOut, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { ZohoMeetingConfig } from "./types";
import { useZohoMeeting } from "./useZohoMeeting";

interface ZohoMeetingContainerProps {
    config: ZohoMeetingConfig;
    /** Shown when all strategies fail */
    fallbackJoinUrl?: string;
}

const ZohoMeetingContainer: React.FC<ZohoMeetingContainerProps> = ({
    config,
    fallbackJoinUrl,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { status, error, activeStrategy } = useZohoMeeting(containerRef, config);

    return (
        <div className="relative w-full h-full flex-1 min-h-[400px] bg-black rounded-lg overflow-hidden">
            {/* The SDK / iframe mounts here */}
            <div ref={containerRef} className="absolute inset-0 w-full h-full" />

            {/* Loading overlay */}
            {status === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 text-white z-10">
                    <SpinnerGap size={40} className="animate-spin text-primary-400" />
                    <p className="text-sm text-neutral-400">Connecting to meeting…</p>
                </div>
            )}

            {/* Error overlay */}
            {status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-900 text-white z-10 px-6 text-center">
                    <WarningCircle size={48} className="text-red-400" />
                    <p className="text-sm text-neutral-300">{error}</p>
                    {fallbackJoinUrl && (
                        <button
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm transition-colors"
                            onClick={() => window.open(fallbackJoinUrl, "_blank", "noopener,noreferrer")}
                        >
                            Open in Zoho
                            <ArrowSquareOut size={16} weight="bold" />
                        </button>
                    )}
                </div>
            )}

            {/* Debug badge — remove in production */}
            {status === "ready" && activeStrategy && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs bg-black/60 text-green-400 z-10 pointer-events-none">
                    {activeStrategy}
                </div>
            )}
        </div>
    );
};

export default ZohoMeetingContainer;
