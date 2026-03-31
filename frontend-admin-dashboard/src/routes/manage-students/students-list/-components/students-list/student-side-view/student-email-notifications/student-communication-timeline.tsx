import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getUserCommunications,
    type CommunicationItem,
    type StatusEvent,
} from '@/services/communication-timeline-service';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { formatDistanceToNow, format } from 'date-fns';
import {
    Mail,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    ArrowUpRight,
    ArrowDownLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Envelope, WhatsappLogo, ChatCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';

// ─── Channel Config ─────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<
    string,
    { icon: React.ElementType; color: string; bg: string; border: string; label: string }
> = {
    EMAIL: {
        icon: Envelope,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        label: 'Email',
    },
    WHATSAPP: {
        icon: WhatsappLogo,
        color: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-200',
        label: 'WhatsApp',
    },
    PUSH: {
        icon: Bell,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        label: 'Push',
    },
    SMS: {
        icon: ChatCircle,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        label: 'SMS',
    },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    PENDING: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' },
    SENT: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Sent' },
    DELIVERED: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Delivered' },
    READ: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Read' },
    CLICKED: { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Clicked' },
    FAILED: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Failed' },
    BOUNCED: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Bounced' },
    COMPLAINT: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Complaint' },
    RECEIVED: { color: 'bg-teal-100 text-teal-800 border-teal-200', label: 'Received' },
};

const FILTER_OPTIONS = [
    { key: 'ALL', label: 'All' },
    { key: 'EMAIL', label: 'Email' },
    { key: 'WHATSAPP', label: 'WhatsApp' },
    { key: 'PUSH', label: 'Push' },
] as const;

// ─── Status Mini Timeline ───────────────────────────────────────────────────

const STATUS_FLOW_EMAIL = ['SENT', 'DELIVERED', 'READ', 'CLICKED'];

function StatusMiniTimeline({ events, status }: { events: StatusEvent[]; status: string }) {
    const flow = STATUS_FLOW_EMAIL;
    const achieved = new Set(events.map((e) => e.status));
    // Also mark the current status
    achieved.add(status);

    return (
        <div className="mt-1.5 flex items-center gap-1">
            {flow.map((step, i) => {
                const active = achieved.has(step);
                return (
                    <div key={step} className="flex items-center gap-1">
                        <div
                            className={`size-2 rounded-full transition-colors ${
                                active ? 'bg-green-500' : 'bg-neutral-200'
                            }`}
                            title={step}
                        />
                        {i < flow.length - 1 && (
                            <div
                                className={`h-px w-3 ${active ? 'bg-green-300' : 'bg-neutral-200'}`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Date Separator ─────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: Date }) {
    return (
        <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs font-medium text-neutral-500">
                {format(date, 'MMM d, yyyy')}
            </span>
            <div className="h-px flex-1 bg-neutral-200" />
        </div>
    );
}

// ─── Timeline Item ──────────────────────────────────────────────────────────

function TimelineItem({ item }: { item: CommunicationItem }) {
    const [expanded, setExpanded] = useState(false);
    const channel = CHANNEL_CONFIG[item.channel] ?? CHANNEL_CONFIG.EMAIL!;
    const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING!;
    const isInbound = item.direction === 'INBOUND';
    const ChannelIcon = channel!.icon as React.ComponentType<{ className?: string; weight?: string }>;

    return (
        <div
            className={`group relative flex gap-3 ${isInbound ? 'flex-row' : 'flex-row-reverse'}`}
        >
            {/* Timeline spine icon */}
            <div className="flex flex-col items-center">
                <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${channel!.bg} ${channel!.border} border`}
                >
                    <ChannelIcon className={`size-4 ${channel!.color}`} weight="bold" />
                </div>
                <div className="w-px flex-1 bg-neutral-200" />
            </div>

            {/* Message card */}
            <div
                className={`mb-3 min-w-0 flex-1 cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md ${
                    isInbound
                        ? 'border-l-2 border-l-green-400 border-t-neutral-200 border-r-neutral-200 border-b-neutral-200'
                        : 'border-r-2 border-r-blue-400 border-t-neutral-200 border-l-neutral-200 border-b-neutral-200'
                }`}
                onClick={() => setExpanded(!expanded)}
            >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1.5">
                            {isInbound ? (
                                <ArrowDownLeft className="size-3 shrink-0 text-green-500" />
                            ) : (
                                <ArrowUpRight className="size-3 shrink-0 text-blue-500" />
                            )}
                            <span className="text-[10px] font-medium uppercase text-neutral-400">
                                {isInbound ? 'Received' : 'Sent'} via {channel!.label}
                            </span>
                        </div>
                        <h4 className="truncate text-sm font-semibold text-neutral-900">
                            {item.title || 'No subject'}
                        </h4>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <Badge
                            variant="outline"
                            className={`text-[10px] font-medium ${statusCfg!.color}`}
                        >
                            {statusCfg!.label}
                        </Badge>
                        {expanded ? (
                            <ChevronUp className="size-3.5 text-neutral-400" />
                        ) : (
                            <ChevronDown className="size-3.5 text-neutral-400" />
                        )}
                    </div>
                </div>

                {/* Body preview */}
                {!expanded && item.bodyPreview && (
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                        {item.bodyPreview}
                    </p>
                )}

                {/* Timestamp + mini timeline */}
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </span>
                    {item.channel === 'EMAIL' && !isInbound && (
                        <StatusMiniTimeline
                            events={item.statusTimeline || []}
                            status={item.status}
                        />
                    )}
                </div>

                {/* Expanded details */}
                {expanded && (
                    <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
                        {/* Full body */}
                        {item.fullBody && (
                            <div className="rounded-md bg-neutral-50 p-2.5">
                                <p className="text-xs font-medium text-neutral-500">Message</p>
                                {item.channel === 'EMAIL' ? (
                                    <div
                                        className="mt-1 max-h-40 overflow-y-auto text-xs text-neutral-700"
                                        dangerouslySetInnerHTML={{ __html: item.fullBody }}
                                    />
                                ) : (
                                    <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-neutral-700">
                                        {item.fullBody}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Template name */}
                        {item.templateName && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-neutral-500">Template:</span>
                                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700">
                                    {item.templateName}
                                </span>
                            </div>
                        )}

                        {/* Sender / Recipient */}
                        <div className="space-y-1 text-xs">
                            {item.senderInfo && (
                                <div className="flex gap-2">
                                    <span className="font-medium text-neutral-500">From:</span>
                                    <span className="text-neutral-700">{item.senderInfo}</span>
                                </div>
                            )}
                            {item.recipientInfo && (
                                <div className="flex gap-2">
                                    <span className="font-medium text-neutral-500">To:</span>
                                    <span className="text-neutral-700">{item.recipientInfo}</span>
                                </div>
                            )}
                            {item.source && (
                                <div className="flex gap-2">
                                    <span className="font-medium text-neutral-500">Source:</span>
                                    <span className="text-neutral-700">{item.source}</span>
                                </div>
                            )}
                        </div>

                        {/* Status timeline */}
                        {item.statusTimeline && item.statusTimeline.length > 0 && (
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-neutral-500">
                                    Delivery Timeline
                                </p>
                                <div className="space-y-1.5">
                                    {item.statusTimeline.map((event, i) => {
                                        const evtCfg =
                                            STATUS_CONFIG[event.status] ?? STATUS_CONFIG.PENDING!;
                                        return (
                                            <div
                                                key={`${event.status}-${event.timestamp}-${i}`}
                                                className="flex items-center gap-2 text-xs"
                                            >
                                                <div className="size-1.5 rounded-full bg-neutral-400" />
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] ${evtCfg!.color}`}
                                                >
                                                    {evtCfg!.label}
                                                </Badge>
                                                <span className="text-neutral-500">
                                                    {format(
                                                        new Date(event.timestamp),
                                                        'MMM d, h:mm a'
                                                    )}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const StudentCommunicationTimeline = () => {
    const { selectedStudent } = useStudentSidebar();
    const [page, setPage] = useState(0);
    const [channelFilter, setChannelFilter] = useState<string>('ALL');
    const pageSize = 20;
    const { openIndividualSendEmailDialog, openIndividualSendMessageDialog } = useDialogStore();

    const {
        data: timelineData,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['communication-timeline', selectedStudent?.user_id, page, channelFilter],
        queryFn: () =>
            getUserCommunications(selectedStudent?.user_id || '', {
                page,
                size: pageSize,
                channels: channelFilter === 'ALL' ? undefined : [channelFilter],
            }),
        enabled: !!selectedStudent?.user_id,
        staleTime: 30000,
    });

    // ─── Empty / Loading / Error states ─────────────────────────────────────

    if (!selectedStudent?.user_id) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="mb-3 rounded-full bg-neutral-100 p-4">
                    <Mail className="size-8 text-neutral-400" />
                </div>
                <p className="text-sm font-medium text-neutral-600">No student selected</p>
                <p className="mt-1 text-xs text-neutral-500">
                    Select a student to view their communications
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="mb-4 flex gap-2">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-7 w-16 rounded-full" />
                    ))}
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                        <Skeleton className="size-8 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-2 rounded-lg border p-3">
                            <Skeleton className="h-3 w-1/3" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="mb-4 rounded-full bg-red-100 p-4">
                    <AlertCircle className="size-8 text-red-500" />
                </div>
                <p className="mb-2 text-sm font-medium text-red-600">
                    Failed to load communications
                </p>
                <button
                    onClick={() => refetch()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white transition-colors duration-200 hover:bg-red-700"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const communications = timelineData?.content || [];

    // Group by date for separators
    const groupedItems: Array<{ type: 'date'; date: Date } | { type: 'item'; item: CommunicationItem }> = [];
    let lastDate: string | null = null;

    for (const item of communications) {
        const itemDate = new Date(item.timestamp);
        const dateKey = format(itemDate, 'yyyy-MM-dd');
        if (dateKey !== lastDate) {
            groupedItems.push({ type: 'date', date: itemDate });
            lastDate = dateKey;
        }
        groupedItems.push({ type: 'item', item });
    }

    // Count by channel for stats
    const channelCounts = communications.reduce(
        (acc, item) => {
            acc[item.channel] = (acc[item.channel] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    return (
        <div className="space-y-4">
            {/* Send Notification Bar */}
            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                <div className="mb-2 flex items-center gap-2.5">
                    <div className="rounded-md bg-gradient-to-br from-blue-50 to-blue-100 p-1.5">
                        <Bell className="size-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-xs font-medium text-neutral-700">Send Notification</h4>
                        <p className="text-[10px] text-neutral-500">Email or WhatsApp message</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={false}
                        onClick={() => {
                            if (selectedStudent) openIndividualSendEmailDialog(selectedStudent);
                        }}
                        className="group flex flex-1 cursor-pointer items-center justify-center gap-1.5 border border-blue-200 bg-white text-xs text-blue-700 transition-all duration-200 hover:scale-100 hover:border-blue-300 hover:bg-blue-50"
                        style={{ pointerEvents: 'auto', zIndex: 10 }}
                    >
                        <Envelope className="size-3 transition-transform duration-200 group-hover:scale-110" />
                        Email
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={false}
                        onClick={() => {
                            if (selectedStudent) openIndividualSendMessageDialog(selectedStudent);
                        }}
                        className="group flex flex-1 cursor-pointer items-center justify-center gap-1.5 border border-green-200 bg-white text-xs text-green-700 transition-all duration-200 hover:scale-100 hover:border-green-300 hover:bg-green-50"
                        style={{ pointerEvents: 'auto', zIndex: 10 }}
                    >
                        <WhatsappLogo className="size-3 transition-transform duration-200 group-hover:scale-110" />
                        WhatsApp
                    </MyButton>
                </div>
            </div>

            {/* Channel Filter Chips */}
            <div className="flex items-center gap-2">
                {FILTER_OPTIONS.map((opt) => (
                    <button
                        key={opt.key}
                        onClick={() => {
                            setChannelFilter(opt.key);
                            setPage(0);
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                            channelFilter === opt.key
                                ? 'bg-primary-500 text-white shadow-sm'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                    >
                        {opt.label}
                        {opt.key !== 'ALL' && channelCounts[opt.key] ? (
                            <span className="ml-1 opacity-75">({channelCounts[opt.key]})</span>
                        ) : null}
                    </button>
                ))}
            </div>

            {/* Stats Summary */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
                    <h3 className="text-base font-semibold text-neutral-800">Communications</h3>
                </div>
                <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-xs font-medium text-blue-700"
                >
                    {timelineData?.totalElements || 0} total
                </Badge>
            </div>

            {/* Timeline */}
            {communications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="mb-4 rounded-full bg-neutral-100 p-6">
                        <Mail className="size-12 text-neutral-400" />
                    </div>
                    <p className="mb-1 text-sm font-medium text-neutral-600">
                        No communications found
                    </p>
                    <p className="text-center text-xs text-neutral-500">
                        {channelFilter !== 'ALL'
                            ? `No ${channelFilter.toLowerCase()} messages yet. Try selecting "All" to see other channels.`
                            : "No messages have been sent to or received from this student yet."}
                    </p>
                </div>
            ) : (
                <div className="relative">
                    {groupedItems.map((entry) => {
                        if (entry.type === 'date') {
                            return <DateSeparator key={`date-${entry.date.toISOString()}`} date={entry.date} />;
                        }
                        return <TimelineItem key={entry.item.id} item={entry.item} />;
                    })}
                </div>
            )}

            {/* Pagination */}
            {timelineData && timelineData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-neutral-200 pt-4">
                    <button
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                        className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 transition-all duration-200 hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2">
                        <span className="text-xs font-medium text-neutral-600">
                            Page {page + 1} of {timelineData.totalPages}
                        </span>
                    </div>
                    <button
                        onClick={() => setPage(Math.min(timelineData.totalPages - 1, page + 1))}
                        disabled={page >= timelineData.totalPages - 1}
                        className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 transition-all duration-200 hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};
