import { useCallback, useEffect, useState } from 'react';
import { ArrowSquareOut, EnvelopeSimple } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyPagination } from '@/components/design-system/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { getInstituteId } from '@/constants/helper';
import {
    getHubEmailEvents,
    type HubEmailEventItem,
    type HubEmailEventType,
} from '../../-services/hub-api';

const PAGE_SIZE = 20;

const EVENT_LABELS: Record<HubEmailEventType, string> = {
    DELIVERY: 'Delivered emails',
    OPEN: 'Opened emails',
    CLICK: 'Clicked emails',
    BOUNCE: 'Bounced emails',
    COMPLAINT: 'Complaints',
};

interface Props {
    eventType: HubEmailEventType | null;
    windowDays: number;
    onClose: () => void;
}

export function EmailEventsDialog({ eventType, windowDays, onClose }: Props) {
    const instituteId = getInstituteId() || '';
    const [items, setItems] = useState<HubEmailEventItem[]>([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const load = useCallback(
        async (targetPage: number) => {
            if (!eventType || !instituteId) return;
            setLoading(true);
            setError(false);
            try {
                const res = await getHubEmailEvents(
                    instituteId,
                    eventType,
                    windowDays,
                    targetPage,
                    PAGE_SIZE
                );
                setItems(res.content);
                setTotalPages(res.totalPages);
                setTotalElements(res.totalElements);
                setPage(res.page);
            } catch (err) {
                console.error('Failed to load email events', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        },
        [eventType, instituteId, windowDays]
    );

    // Reset to first page whenever the dialog opens for a (new) event type.
    useEffect(() => {
        if (eventType) {
            setItems([]);
            load(0);
        }
    }, [eventType, load]);

    if (!eventType) return null;

    const windowLabel = windowDays === 1 ? 'last 24h' : `last ${windowDays} days`;

    return (
        <MyDialog
            open={!!eventType}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            heading={EVENT_LABELS[eventType]}
            dialogWidth="max-w-3xl"
        >
            <div className="space-y-3">
                <p className="text-caption text-neutral-500">
                    {loading
                        ? `Loading events from the ${windowLabel}…`
                        : `${totalElements.toLocaleString()} ${totalElements === 1 ? 'event' : 'events'} in the ${windowLabel}.`}
                </p>

                {error && (
                    <div className="rounded-md border border-danger-200 bg-danger-50 p-4 text-body text-danger-600">
                        Could not load emails. Please try again.
                    </div>
                )}

                {loading && (
                    <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 rounded-md" />
                        ))}
                    </div>
                )}

                {!loading && !error && items.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10 text-neutral-400">
                        <EnvelopeSimple size={32} />
                        <p className="text-body">
                            No {EVENT_LABELS[eventType].toLowerCase()} in the {windowLabel}.
                        </p>
                    </div>
                )}

                {!loading && !error && items.length > 0 && (
                    <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
                        {items.map((item) => (
                            <EventRow key={item.id} item={item} eventType={eventType} />
                        ))}
                    </ul>
                )}

                {!loading && totalPages > 1 && (
                    <MyPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={(p) => load(p)}
                    />
                )}
            </div>
        </MyDialog>
    );
}

function EventRow({ item, eventType }: { item: HubEmailEventItem; eventType: HubEmailEventType }) {
    return (
        <li className="flex flex-col gap-1 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-body font-medium text-neutral-700">{item.recipient}</span>
                <span className="text-caption text-neutral-400">
                    {formatTimestamp(item.timestamp)}
                </span>
            </div>
            {item.subject && (
                <p className="truncate text-caption text-neutral-500" title={item.subject}>
                    {item.subject}
                </p>
            )}
            <EventDetail item={item} eventType={eventType} />
        </li>
    );
}

function EventDetail({ item, eventType }: { item: HubEmailEventItem; eventType: HubEmailEventType }) {
    if (eventType === 'BOUNCE' && (item.bounceType || item.bounceSubType)) {
        return (
            <p className="text-caption text-danger-600">
                {[item.bounceType, item.bounceSubType].filter(Boolean).join(' · ')}
            </p>
        );
    }
    if (eventType === 'CLICK' && item.clickedLink) {
        return (
            <a
                href={item.clickedLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 truncate text-caption text-primary-500 hover:underline"
                title={item.clickedLink}
            >
                <ArrowSquareOut size={12} className="shrink-0" />
                <span className="truncate">{item.clickedLink}</span>
            </a>
        );
    }
    if (eventType === 'OPEN' && item.ipAddress) {
        return <p className="text-caption text-neutral-400">Opened from {item.ipAddress}</p>;
    }
    if (eventType === 'COMPLAINT' && item.complaintType) {
        return <p className="text-caption text-warning-600">{item.complaintType}</p>;
    }
    return null;
}

function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}
