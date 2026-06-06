import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Phone,
    PhoneIncoming,
    PhoneOutgoing,
    PlayCircle,
    DownloadSimple,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    fetchCallHistory,
    fetchCallRecordingUrl,
    type CallLogItem,
} from './services/call-history';

/**
 * Lead Call History — drop-in panel for the StudentSidebar timeline tab.
 * Renders the most recent calls for a lead, with inline mp3 playback when a
 * recording is available. The presigned URL is fetched lazily on first play
 * so the list itself stays a single round-trip.
 */

interface LeadCallHistoryProps {
    userId: string;
    className?: string;
}

const formatDuration = (s?: number | null): string => {
    if (!s || s <= 0) return '0s';
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m === 0 ? `${r}s` : `${m}m ${r}s`;
};

const STATUS_LABEL: Record<string, string> = {
    COMPLETED: 'Connected',
    NO_ANSWER: 'No answer',
    BUSY: 'Busy',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    IN_PROGRESS: 'In progress',
    COUNSELLOR_RINGING: 'Ringing',
    COUNSELLOR_ANSWERED: 'Ringing lead',
    QUEUED: 'Queued',
    INITIATED: 'Starting',
};

const STATUS_TONE: Record<string, string> = {
    COMPLETED: 'bg-success-50 text-success-700',
    NO_ANSWER: 'bg-warning-50 text-warning-700',
    BUSY: 'bg-warning-50 text-warning-700',
    FAILED: 'bg-danger-50 text-danger-700',
    CANCELLED: 'bg-neutral-100 text-neutral-600',
};

export function LeadCallHistory({ userId, className }: LeadCallHistoryProps) {
    const instituteId = getCurrentInstituteId() ?? '';
    const query = useQuery({
        queryKey: ['telephony-call-history', userId, instituteId],
        queryFn: () => fetchCallHistory(userId, instituteId, 0, 50),
        enabled: !!userId && !!instituteId,
        staleTime: 30 * 1000,
    });

    if (!userId) return null;

    if (query.isLoading) {
        return (
            <div className={cn('p-4 text-sm text-neutral-500', className)}>Loading calls…</div>
        );
    }

    const items = query.data?.content ?? [];
    if (items.length === 0) {
        return (
            <div
                className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500',
                    className
                )}
            >
                <Phone className="size-6 text-neutral-400" />
                <span>No calls yet</span>
            </div>
        );
    }

    return (
        <div className={cn('space-y-2', className)}>
            {items.map((c) => (
                <CallHistoryRow key={c.id} item={c} instituteId={instituteId} />
            ))}
        </div>
    );
}

function CallHistoryRow({
    item,
    instituteId,
}: {
    item: CallLogItem;
    instituteId: string;
}) {
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
    const [loadingUrl, setLoadingUrl] = useState(false);
    const label = STATUS_LABEL[item.status] ?? item.status;
    const tone = STATUS_TONE[item.status] ?? 'bg-neutral-100 text-neutral-600';

    const resolveUrl = async (): Promise<string | null> => {
        if (recordingUrl) return recordingUrl;
        setLoadingUrl(true);
        try {
            const url = await fetchCallRecordingUrl(item.id, instituteId);
            setRecordingUrl(url);
            return url;
        } finally {
            setLoadingUrl(false);
        }
    };

    const isInbound = item.direction === 'INBOUND';
    return (
        <div
            className={cn(
                'rounded-md border bg-white p-3',
                isInbound
                    ? 'border-l-4 border-l-info-500 border-y-neutral-200 border-r-neutral-200'
                    : 'border-neutral-200'
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    {isInbound ? (
                        <PhoneIncoming className="size-4 text-info-600" />
                    ) : (
                        <PhoneOutgoing className="size-4 text-neutral-400" />
                    )}
                    <span
                        className={cn(
                            'text-sm font-medium',
                            isInbound ? 'text-info-700' : 'text-neutral-700'
                        )}
                    >
                        {isInbound ? 'Lead called back' : 'Outbound'}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', tone)}>
                        {label}
                    </span>
                    <span className="text-xs text-neutral-500">
                        · {formatDuration(item.durationSeconds)}
                    </span>
                </div>
                <span className="text-xs text-neutral-400">
                    {item.startTime
                        ? new Date(item.startTime).toLocaleString()
                        : ''}
                </span>
            </div>
            <div className="mt-1 text-xs text-neutral-500">
                {isInbound ? (
                    <>
                        <span>From {item.fromNumberMasked ?? '—'} · </span>
                        <span>To {item.callerId ?? item.toNumberMasked ?? '—'}</span>
                    </>
                ) : (
                    <>
                        {item.callerId ? <span>From {item.callerId} · </span> : null}
                        <span>To {item.toNumberMasked ?? '—'}</span>
                    </>
                )}
            </div>
            {item.hasRecording && (
                <div className="mt-2">
                    {recordingUrl ? (
                        <audio controls src={recordingUrl} className="w-full" />
                    ) : (
                        <button
                            type="button"
                            disabled={loadingUrl}
                            onClick={resolveUrl}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                        >
                            <PlayCircle className="size-4" />
                            {loadingUrl ? 'Loading…' : 'Play recording'}
                        </button>
                    )}
                    {recordingUrl && (
                        <a
                            href={recordingUrl}
                            download={`call-${item.id}.mp3`}
                            className="ml-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                        >
                            <DownloadSimple className="size-4" />
                            Download
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
