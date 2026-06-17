import { useEffect, useRef } from 'react';
import { Flag, ChatCircleDots, ArrowClockwise, Trash } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type {
    ChatConversationResponse,
    ChatMessageResponse,
} from '@/services/chat/chatApi';

export interface ThreadMessage extends ChatMessageResponse {
    /** Local-only dedup key threaded through the optimistic send for reconciliation/retry. */
    clientDedupKey?: string;
    /** Local-only flag for optimistic messages awaiting server reconciliation. */
    pending?: boolean;
    /** Local-only flag for messages whose send failed. */
    failed?: boolean;
}

/** Roles allowed to delete any message in a conversation (not just their own). */
const MODERATOR_ROLES = new Set(['MODERATOR', 'OWNER', 'ADMIN']);

interface ChatThreadProps {
    conversation: ChatConversationResponse;
    messages: ThreadMessage[];
    currentUserId: string;
    isLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onReport: (message: ChatMessageResponse) => void;
    onRetry: (message: ThreadMessage) => void;
    onDelete: (message: ThreadMessage) => void;
}

const dayLabel = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

const dayKey = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toDateString();
};

const timeLabel = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export function ChatThread({
    conversation,
    messages,
    currentUserId,
    isLoading,
    hasMore,
    onLoadMore,
    onReport,
    onRetry,
    onDelete,
}: ChatThreadProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const showSenderNames = conversation.type !== 'DIRECT';
    const canModerate = MODERATOR_ROLES.has((conversation.memberRole ?? '').toUpperCase());

    // Auto-scroll to the newest message when the count grows.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    let lastDay = '';

    return (
        <div className="flex-1 overflow-y-auto bg-neutral-50 px-4 py-4">
            {hasMore && (
                <div className="mb-3 flex justify-center">
                    <button
                        type="button"
                        onClick={onLoadMore}
                        className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                        Load earlier messages
                    </button>
                </div>
            )}

            {isLoading && messages.length === 0 && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                'h-12 w-2/3 animate-pulse rounded-2xl bg-neutral-200',
                                i % 2 === 0 ? '' : 'ml-auto'
                            )}
                        />
                    ))}
                </div>
            )}

            {!isLoading && messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                    <ChatCircleDots size={40} weight="duotone" className="mb-3 text-neutral-300" />
                    <p className="text-sm text-neutral-500">
                        No messages yet. Say hello to start the conversation.
                    </p>
                </div>
            )}

            <div
                className="flex flex-col gap-1"
                role="log"
                aria-live="polite"
                aria-label="Messages"
            >
                {messages.map((m) => {
                    const isOwn = m.senderId === currentUserId;
                    // Only persisted (non-temp), non-deleted, settled messages can be deleted.
                    const isLocalOnly = m.id.startsWith('temp-') || m.pending || m.failed;
                    const canDelete = !m.isDeleted && !isLocalOnly && (isOwn || canModerate);
                    const key = dayKey(m.createdAt);
                    const showDay = key !== lastDay;
                    lastDay = key;

                    return (
                        <div key={m.id}>
                            {showDay && (
                                <div className="my-3 flex justify-center">
                                    <span className="rounded-full bg-neutral-200 px-3 py-1 text-caption font-medium text-neutral-600">
                                        {dayLabel(m.createdAt)}
                                    </span>
                                </div>
                            )}

                            <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                                <div
                                    className={cn(
                                        'group relative max-w-[78%] rounded-2xl px-3 py-2 shadow-sm', // design-lint-ignore: percentage bubble width has no spacing token
                                        isOwn
                                            ? 'rounded-br-sm bg-primary-500 text-white'
                                            : 'rounded-bl-sm border border-neutral-200 bg-white text-neutral-700'
                                    )}
                                >
                                    {showSenderNames && !isOwn && (
                                        <div className="mb-0.5 text-xs font-semibold text-primary-600">
                                            {m.senderName || 'Member'}
                                        </div>
                                    )}

                                    {m.isDeleted ? (
                                        <div className="whitespace-pre-wrap break-words text-sm italic leading-relaxed opacity-60">
                                            This message was deleted
                                        </div>
                                    ) : (
                                        <>
                                            {m.attachmentUrl && (
                                                <a
                                                    href={m.attachmentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mb-1 block"
                                                >
                                                    <img
                                                        src={m.attachmentUrl}
                                                        alt={m.attachmentName || 'attachment'}
                                                        className="max-h-60 w-full max-w-xs rounded-md object-cover"
                                                    />
                                                </a>
                                            )}

                                            {m.content && (
                                                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                                    {m.content}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div
                                        className={cn(
                                            'mt-0.5 flex items-center justify-end gap-1 text-caption',
                                            isOwn ? 'text-white/70' : 'text-neutral-400'
                                        )}
                                    >
                                        {m.isFlagged && <Flag size={11} weight="fill" />}
                                        {m.failed ? (
                                            <button
                                                type="button"
                                                onClick={() => onRetry(m)}
                                                className="flex items-center gap-1 font-medium text-danger-200 underline hover:text-danger-100"
                                                aria-label="Message failed to send. Tap to retry."
                                            >
                                                <ArrowClockwise size={11} weight="bold" />
                                                Failed — retry
                                            </button>
                                        ) : m.pending ? (
                                            <span aria-label="Sending message">Sending...</span>
                                        ) : (
                                            <span>{timeLabel(m.createdAt)}</span>
                                        )}
                                    </div>

                                    {!isOwn && !m.pending && !m.isDeleted && (
                                        <button
                                            type="button"
                                            onClick={() => onReport(m)}
                                            className="absolute -right-7 top-1 hidden text-neutral-300 hover:text-danger-500 group-hover:block"
                                            aria-label="Report message"
                                            title="Report message"
                                        >
                                            <Flag size={14} />
                                        </button>
                                    )}

                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={() => onDelete(m)}
                                            className="absolute -right-7 bottom-1 hidden text-neutral-300 hover:text-danger-500 group-hover:block"
                                            aria-label="Delete message"
                                            title="Delete message"
                                        >
                                            <Trash size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
