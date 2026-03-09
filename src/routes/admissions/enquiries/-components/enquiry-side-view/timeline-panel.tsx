import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    handleFetchTimelineEvents,
    createTimelineEvent,
    timelineQueryKeys,
    type TimelineEvent,
    type CreateTimelineEventPayload,
} from '../../../-services/timeline-services';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    NotePencil,
    ArrowsClockwise,
    User,
    ClipboardText,
    ArrowRight,
    Phone,
    EnvelopeSimple,
    CurrencyCircleDollar,
    Buildings,
    PushPin,
} from '@phosphor-icons/react';

// ─── Action Type Icons & Colors ──────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: ReactNode; color: string; bgColor: string }> = {
    NOTE_ADDED: {
        icon: <NotePencil weight="fill" className="size-4" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
    },
    STATUS_CHANGE: {
        icon: <ArrowsClockwise weight="fill" className="size-4" />,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
    },
    COUNSELOR_ASSIGNED: {
        icon: <User weight="fill" className="size-4" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
    },
    APPLICATION_SUBMITTED: {
        icon: <ClipboardText weight="fill" className="size-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
    },
    APPLICATION_TRANSITIONED: {
        icon: <ArrowRight weight="bold" className="size-4" />,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100',
    },
    PHONE_CALL: {
        icon: <Phone weight="fill" className="size-4" />,
        color: 'text-teal-600',
        bgColor: 'bg-teal-100',
    },
    EMAIL_SENT: {
        icon: <EnvelopeSimple weight="fill" className="size-4" />,
        color: 'text-sky-600',
        bgColor: 'bg-sky-100',
    },
    PAYMENT_SUCCESS: {
        icon: <CurrencyCircleDollar weight="fill" className="size-4" />,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
    },
    CAMPUS_VISIT: {
        icon: <Buildings weight="fill" className="size-4" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
    },
    DEFAULT: {
        icon: <PushPin weight="fill" className="size-4" />,
        color: 'text-neutral-600',
        bgColor: 'bg-neutral-100',
    },
};

const DEFAULT_CONFIG = {
    icon: <PushPin weight="fill" className="size-4" />,
    color: 'text-neutral-600',
    bgColor: 'bg-neutral-100',
};

const getActionConfig = (actionType: string): { icon: ReactNode; color: string; bgColor: string } =>
    ACTION_CONFIG[actionType] ?? DEFAULT_CONFIG;

// ─── Note Action Types ───────────────────────────────────────────────────────

const NOTE_ACTION_TYPES = [
    { value: 'NOTE_ADDED', label: 'Note', icon: <NotePencil weight="fill" className="size-3.5" /> },
    {
        value: 'PHONE_CALL',
        label: 'Phone Call',
        icon: <Phone weight="fill" className="size-3.5" />,
    },
    {
        value: 'EMAIL_SENT',
        label: 'Email Sent',
        icon: <EnvelopeSimple weight="fill" className="size-3.5" />,
    },
    {
        value: 'CAMPUS_VISIT',
        label: 'Campus Visit',
        icon: <Buildings weight="fill" className="size-3.5" />,
    },
];

// ─── Timeline Event Item ─────────────────────────────────────────────────────

const TimelineEventItem = ({ event }: { event: TimelineEvent }) => {
    const config = getActionConfig(event.action_type);
    const [isTextExpanded, setIsTextExpanded] = useState(false);

    const formatTime = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'd MMM yyyy, h:mm a');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="group relative flex gap-3 pb-6 last:pb-0">
            {/* Vertical line connector */}
            <div className="absolute -bottom-0 left-[17px] top-[36px] w-px bg-neutral-200 group-last:hidden" />

            {/* Icon circle */}
            <div
                className={`z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm ${config.bgColor} ${config.color}`}
            >
                {config.icon}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium leading-tight text-neutral-800">
                        {event.title}
                    </h4>
                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-neutral-400">
                        {formatTime(event.created_at)}
                    </span>
                </div>

                {event.description && (
                    <div className="mt-1">
                        <p className="whitespace-pre-wrap break-all text-sm leading-relaxed text-neutral-600 sm:break-normal">
                            {isTextExpanded || event.description.length <= 100
                                ? event.description
                                : `${event.description.slice(0, 100).trim()}...`}
                        </p>
                        {event.description.length > 100 && (
                            <button
                                onClick={() => setIsTextExpanded(!isTextExpanded)}
                                className="mt-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700 hover:underline"
                            >
                                {isTextExpanded ? 'View less' : 'View more'}
                            </button>
                        )}
                    </div>
                )}

                {/* Actor info */}
                {event.actor_name && (
                    <p className="mt-1.5 text-[11px] text-neutral-400">
                        by <span className="font-medium text-neutral-500">{event.actor_name}</span>
                    </p>
                )}

                {/* Metadata badges */}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(event.metadata).map(([key, value]) => (
                            <span
                                key={key}
                                className="inline-flex items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-500"
                            >
                                <span className="font-medium text-neutral-600">
                                    {key.replace(/_/g, ' ')}:
                                </span>
                                {String(value)}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Add Note Form ───────────────────────────────────────────────────────────

interface AddNoteFormProps {
    entityType: 'ENQUIRY' | 'APPLICANT';
    entityId: string;
}

const AddNoteForm = ({ entityType, entityId }: AddNoteFormProps) => {
    const [noteText, setNoteText] = useState('');
    const [actionType, setActionType] = useState('NOTE_ADDED');
    const [isExpanded, setIsExpanded] = useState(false);
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: createTimelineEvent,
        onSuccess: () => {
            toast.success('Note added successfully');
            setNoteText('');
            setIsExpanded(false);
            queryClient.invalidateQueries({
                queryKey: timelineQueryKeys.events(entityType, entityId),
            });
        },
        onError: () => {
            toast.error('Failed to add note. Please try again.');
        },
    });

    const handleSubmit = () => {
        if (!noteText.trim()) {
            toast.warning('Please enter a note');
            return;
        }

        const actionLabel = NOTE_ACTION_TYPES.find((t) => t.value === actionType)?.label || 'Note';

        const payload: CreateTimelineEventPayload = {
            type: entityType,
            type_id: entityId,
            action_type: actionType,
            title: `${actionLabel}`,
            description: noteText.trim(),
        };

        createMutation.mutate(payload);
    };

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-500 transition-all duration-200 hover:border-primary-300 hover:bg-primary-50/30 hover:text-primary-600"
            >
                <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add a note or log activity…
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            {/* Action type selector */}
            <div className="mb-2 flex items-center gap-1.5">
                {NOTE_ACTION_TYPES.map((type) => (
                    <button
                        key={type.value}
                        onClick={() => setActionType(type.value)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all
                            ${
                                actionType === type.value
                                    ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                                    : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                            }`}
                    >
                        {type.icon}
                        {type.label}
                    </button>
                ))}
            </div>

            {/* Note input */}
            <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type your note here…"
                rows={3}
                autoFocus
                className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleSubmit();
                    }
                }}
            />

            {/* Actions */}
            <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-neutral-400">Ctrl+Enter to submit</span>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-neutral-500"
                        onClick={() => {
                            setIsExpanded(false);
                            setNoteText('');
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        className="h-7 bg-primary-500 px-3 text-xs text-white hover:bg-primary-600"
                        onClick={handleSubmit}
                        disabled={createMutation.isPending || !noteText.trim()}
                    >
                        {createMutation.isPending ? 'Saving…' : 'Add Note'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Timeline Panel ─────────────────────────────────────────────────────

interface TimelinePanelProps {
    entityType: 'ENQUIRY' | 'APPLICANT';
    entityId: string;
}

export const TimelinePanel = ({ entityType, entityId }: TimelinePanelProps) => {
    const [page, setPage] = useState(0);
    const pageSize = 5;

    const { data, isLoading, error } = useQuery(
        handleFetchTimelineEvents(entityType, entityId, page, pageSize)
    );
    return (
        <div className="flex flex-col gap-4">
            {/* Section Header */}
            <div className="flex items-center gap-2">
                <div className="h-3.5 w-1 rounded-full bg-primary-500" />
                <h4 className="text-sm font-semibold text-neutral-700">Activity & Notes</h4>
                {data?.totalElements !== undefined && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                        {data.totalElements}
                    </span>
                )}
            </div>

            {/* Add Note Form */}
            <AddNoteForm entityType={entityType} entityId={entityId} />

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <div className="size-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                        Loading activity…
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    Failed to load activity timeline.
                </div>
            )}

            {/* Events List */}
            {data && data.content.length > 0 && (
                <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
                    {data.content.map((event) => (
                        <TimelineEventItem key={event.id} event={event} />
                    ))}

                    {/* Pagination */}
                    {data.totalPages > 1 && (
                        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                            <span className="text-[11px] text-neutral-400">
                                Page {page + 1} of {data.totalPages}
                            </span>
                            <div className="flex gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={() =>
                                        setPage((p) => Math.min(data.totalPages - 1, p + 1))
                                    }
                                    disabled={page >= data.totalPages - 1}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {data && data.content.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-8 text-center">
                    <ClipboardText weight="fill" className="size-8 text-neutral-400" />
                    <p className="text-sm font-medium text-neutral-500">No activity yet</p>
                    <p className="text-xs text-neutral-400">
                        Notes, status changes, and other events will appear here
                    </p>
                </div>
            )}
        </div>
    );
};
