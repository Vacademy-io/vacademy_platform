// components/ParticipantsSidePanel.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Users, Loader2, WifiOff, Wifi, Clock, UserCheck, UserX } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// Participant interface should ideally be imported from a shared types file if used elsewhere,
// or defined in the parent component (ActualPresentationDisplay) that fetches the data.
// For this refactor, assuming ActualPresentationDisplay will pass typed participants.
interface Participant {
    username: string;
    user_id?: string | null;
    name?: string | null;
    email?: string | null;
    status: string;
    joined_at?: string; // ISO string
    last_active_at?: string; // ISO string, for INACTIVE participants
}

interface ParticipantsSidePanelProps {
    sessionId: string; // Still needed for context, potentially for actions within the panel
    isOpen: boolean;
    onClose: () => void;
    topOffset?: string;
    participants: Participant[]; // Received from parent
    sseStatus: 'connecting' | 'connected' | 'disconnected'; // Received from parent
}

// const ADMIN_SSE_URL_BASE_PARTICIPANTS = ...; // Removed, SSE logic is now in parent

// Helper to format date/time (can remain if not duplicated elsewhere)
const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        const today = new Date();
        if (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        ) {
            return date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
        }
        return (
            date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
            ' ' +
            date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
        );
    } catch (e) {
        console.warn('Failed to format date:', isoString, e);
        return 'Invalid Date';
    }
};

export const ParticipantsSidePanel: React.FC<ParticipantsSidePanelProps> = ({
    sessionId, // Retained for now, might be removed if no participant-specific actions need it directly
    isOpen,
    onClose,
    topOffset = '0px',
    participants, // Now from props
    sseStatus, // Now from props
}) => {
    // Removed local state for participants and sseStatus
    // Removed eventSourceRef
    // Removed SSE connection useEffect

    if (!isOpen) return null;

    const StatusIndicator = () => {
        // Uses sseStatus from props
        if (sseStatus === 'connecting') {
            return (
                <div className="flex items-center gap-1.5 rounded-lg border border-yellow-400/30 bg-yellow-500/20 px-2 py-1 backdrop-blur-sm">
                    <Loader2 size={14} className="animate-spin text-yellow-400" />
                    <span className="hidden text-xs font-medium text-yellow-300 lg:inline">
                        Connecting
                    </span>
                </div>
            );
        }
        if (sseStatus === 'connected') {
            return (
                <div className="flex items-center gap-1.5 rounded-lg border border-green-400/30 bg-green-500/20 px-2 py-1 backdrop-blur-sm">
                    <Wifi size={14} className="text-green-400" />
                    <span className="hidden text-xs font-medium text-green-300 lg:inline">
                        Live
                    </span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/20 px-2 py-1 backdrop-blur-sm">
                <WifiOff size={14} className="text-red-400" />
                <span className="hidden text-xs font-medium text-red-300 lg:inline">Offline</span>
            </div>
        );
    };

    return (
        <div
            className="fixed right-0 top-0 z-[1000] flex h-screen w-80 flex-col border-l border-white/20 bg-black/20 shadow-2xl backdrop-blur-xl transition-transform duration-500 ease-out sm:w-96"
            style={{
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                height: `calc(100vh - ${topOffset})`, // Adjusted to use topOffset correctly if header is outside
                top: topOffset, // Position panel below any fixed header
            }}
        >
            {/* Enhanced background effects */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-800/30 to-slate-900/50" />
            <div className="absolute right-0 top-1/4 h-64 w-32 bg-blue-500/5 blur-2xl" />
            <div className="absolute bottom-1/4 left-0 h-64 w-32 bg-purple-500/5 blur-2xl" />

            {/* Enhanced header */}
            <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-white/10 p-4 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 p-2 shadow-lg">
                        <Users size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                            Participants
                            <span className="rounded-lg bg-white/20 px-2 py-1 font-mono text-sm backdrop-blur-sm">
                                {sseStatus === 'connected' ? (
                                    participants.length
                                ) : (
                                    <span className="text-xs font-normal italic">...</span>
                                )}
                            </span>
                        </h3>
                        <div className="mt-1">
                            <StatusIndicator />
                        </div>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="rounded-xl text-white/70 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white"
                >
                    <X size={20} />
                </Button>
            </div>

            <ScrollArea className="relative z-10 grow">
                <div className="space-y-3 p-4">
                    {/* Enhanced loading state */}
                    {sseStatus === 'connecting' && participants.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="relative mb-4">
                                <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg">
                                    <Loader2 className="animate-spin text-white" size={24} />
                                </div>
                                <div className="absolute inset-0 animate-pulse rounded-full bg-blue-500/20 blur-xl" />
                            </div>
                            <p className="mb-1 font-medium text-white">Loading participants...</p>
                            <p className="text-sm text-white/60">Connecting to live session</p>
                        </div>
                    )}

                    {/* Enhanced disconnected state */}
                    {sseStatus === 'disconnected' && participants.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center shadow-lg backdrop-blur-sm">
                            <div className="relative mb-4">
                                <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-red-600 shadow-lg">
                                    <WifiOff size={24} className="text-white" />
                                </div>
                                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl" />
                            </div>
                            <p className="mb-2 font-semibold text-red-300">Connection Lost</p>
                            <p className="text-sm leading-relaxed text-red-200/80">
                                Attempting to reconnect to participant updates...
                            </p>
                        </div>
                    )}

                    {/* Enhanced empty state */}
                    {sseStatus === 'connected' && participants.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="relative mb-4">
                                <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-r from-slate-600 to-slate-700 shadow-xl">
                                    <Users size={32} className="text-white/80" />
                                </div>
                                <div className="absolute inset-0 rounded-2xl bg-slate-500/10 blur-xl" />
                            </div>
                            <p className="mb-2 font-medium text-white">Waiting for participants</p>
                            <p className="max-w-xs text-sm leading-relaxed text-white/60">
                                Share the session code for participants to join this live session.
                            </p>
                        </div>
                    )}

                    {/* Enhanced participant list */}
                    {participants.length > 0 &&
                        participants.map((p, index) => (
                            <div
                                key={p.user_id || p.username + index}
                                className="group relative rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:bg-white/10 hover:shadow-xl"
                            >
                                {/* Subtle gradient overlay */}
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                                <div className="relative flex flex-col">
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* Avatar */}
                                            <div
                                                className={`flex size-10 items-center justify-center rounded-full font-bold text-white shadow-lg ${
                                                    p.status?.toLowerCase() === 'active'
                                                        ? 'bg-gradient-to-r from-green-500 to-green-600'
                                                        : 'bg-gradient-to-r from-slate-500 to-slate-600'
                                                }`}
                                            >
                                                {(p.name || p.username).charAt(0).toUpperCase()}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <span
                                                    className="block truncate text-sm font-semibold text-white"
                                                    title={p.username}
                                                >
                                                    {p.name || p.username}
                                                </span>
                                                {p.email && (
                                                    <span className="block truncate text-xs text-white/60">
                                                        {p.email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Enhanced status badge */}
                                        <div
                                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold backdrop-blur-sm ${
                                                p.status?.toLowerCase() === 'active'
                                                    ? 'border-green-400/30 bg-green-500/20 text-green-300'
                                                    : p.status?.toLowerCase() === 'inactive' ||
                                                        p.status?.toLowerCase() ===
                                                            'inactive_disconnected'
                                                      ? 'border-yellow-400/30 bg-yellow-500/20 text-yellow-300'
                                                      : 'border-slate-400/30 bg-slate-500/20 text-slate-300'
                                            }`}
                                        >
                                            {p.status?.toLowerCase() === 'active' ? (
                                                <UserCheck size={12} />
                                            ) : (
                                                <UserX size={12} />
                                            )}
                                            <span className="capitalize tracking-wide">
                                                {p.status
                                                    ? p.status.toLowerCase().replace('_', ' ')
                                                    : 'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Enhanced time information */}
                                    {(p.status?.toLowerCase() === 'inactive' ||
                                        p.status?.toLowerCase() === 'inactive_disconnected') &&
                                        p.last_active_at && (
                                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
                                                <Clock
                                                    size={12}
                                                    className="shrink-0 text-yellow-400"
                                                />
                                                <span className="text-xs text-white/70">
                                                    Last active:{' '}
                                                    <span className="font-medium text-white/90">
                                                        {formatDateTime(p.last_active_at)}
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                    {p.status?.toLowerCase() === 'active' && p.joined_at && (
                                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
                                            <UserCheck
                                                size={12}
                                                className="shrink-0 text-green-400"
                                            />
                                            <span className="text-xs text-white/70">
                                                Joined:{' '}
                                                <span className="font-medium text-white/90">
                                                    {formatDateTime(p.joined_at)}
                                                </span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                </div>
            </ScrollArea>
        </div>
    );
};
