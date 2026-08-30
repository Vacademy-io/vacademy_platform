import { useInboxStore } from '../-stores/inbox-store';
import { InboxConversation, InboxFilter } from '../-services/inbox-api';
import { MagnifyingGlass, WarningCircle, HandWaving } from '@phosphor-icons/react';

interface Props {
    onLoadMore: () => void;
}

const FILTERS: Array<{ key: InboxFilter; label: string; title: string }> = [
    { key: 'ALL', label: 'All', title: 'Every conversation' },
    {
        key: 'UNANSWERED',
        label: 'Unanswered',
        title: 'The chatbot handed these over and nobody has replied yet',
    },
    {
        key: 'FAILED',
        label: 'Not delivered',
        title: 'Conversations where a message was refused by WhatsApp',
    },
];

export function ConversationList({ onLoadMore }: Props) {
    const conversations = useInboxStore((s) => s.conversations);
    const selectedPhone = useInboxStore((s) => s.selectedPhone);
    const selectPhone = useInboxStore((s) => s.selectPhone);
    const searchQuery = useInboxStore((s) => s.searchQuery);
    const setSearchQuery = useInboxStore((s) => s.setSearchQuery);
    const filter = useInboxStore((s) => s.filter);
    const setFilter = useInboxStore((s) => s.setFilter);
    const isLoading = useInboxStore((s) => s.isLoadingConversations);
    const hasMore = useInboxStore((s) => s.hasMoreConversations);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !isLoading) {
            onLoadMore();
        }
    };

    return (
        <div
            className={`w-full md:w-80 shrink-0 border-r flex-col bg-white ${
                selectedPhone ? 'hidden md:flex' : 'flex'
            }`}
        >
            {/* Search */}
            <div className="p-3 border-b">
                <div className="relative">
                    <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by phone or name..."
                        className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                    />
                </div>

                {/* Filters — hidden while searching, since search spans every conversation */}
                {!searchQuery && (
                    <div className="mt-2 flex gap-1">
                        {FILTERS.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                title={f.title}
                                className={`flex-1 rounded-md px-2 py-1 text-caption font-medium transition ${
                                    filter === f.key
                                        ? 'bg-green-100 text-green-700'
                                        : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
                {conversations.length === 0 && !isLoading ? (
                    <p className="p-4 text-sm text-gray-400 text-center">{emptyText(filter)}</p>
                ) : (
                    conversations.map((c) => (
                        <button
                            key={c.phone}
                            onClick={() => selectPhone(c.phone)}
                            className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition ${
                                selectedPhone === c.phone ? 'bg-green-50 border-l-2 border-l-green-500' : ''
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                        {c.senderName || c.phone}
                                    </p>
                                    {c.senderName && (
                                        <p className="text-xs text-gray-400 truncate">{c.phone}</p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end ml-2 shrink-0">
                                    <span className="text-[10px] text-gray-400">
                                        {c.lastMessageTime ? formatTime(c.lastMessageTime) : ''}
                                    </span>
                                    {(c.unreadCount ?? 0) > 0 && (
                                        <span className="mt-1 bg-green-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                            {c.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* State badges: the bot handed over, or a message never landed */}
                            {(c.awaitingReply || (c.failedCount ?? 0) > 0) && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {c.awaitingReply && (
                                        <span
                                            title={escalationTitle(c)}
                                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-px text-caption font-medium text-amber-700"
                                        >
                                            <HandWaving size={10} /> Unanswered
                                        </span>
                                    )}
                                    {(c.failedCount ?? 0) > 0 && (
                                        <span
                                            title={`${c.failedCount} message(s) were not delivered`}
                                            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-px text-caption font-medium text-red-600"
                                        >
                                            <WarningCircle size={10} />
                                            {c.failedCount === 1
                                                ? 'Not delivered'
                                                : `${c.failedCount} not delivered`}
                                        </span>
                                    )}
                                </div>
                            )}

                            <p className="text-xs text-gray-500 mt-1 truncate">
                                {c.lastMessageType === 'OUTGOING' && (
                                    <span className="text-green-600">✓ </span>
                                )}
                                {c.lastMessage || ''}
                            </p>
                        </button>
                    ))
                )}
                {isLoading && (
                    <p className="p-3 text-xs text-gray-400 text-center">Loading...</p>
                )}
            </div>
        </div>
    );
}

function emptyText(filter: InboxFilter): string {
    if (filter === 'UNANSWERED') return 'Nobody is waiting for a reply';
    if (filter === 'FAILED') return 'Every message was delivered';
    return 'No conversations yet';
}

/** Tooltip explaining why the bot stepped aside on this conversation. */
function escalationTitle(c: InboxConversation): string {
    const why =
        c.escalationReason === 'MAX_TURNS'
            ? 'The conversation reached its automated reply limit'
            : c.escalationReason === 'AI_ERROR'
              ? 'The assistant could not generate a reply'
              : c.escalationReason === 'MANUAL'
                ? 'Handed over by an admin'
                : "The assistant didn't have the information to answer";
    return c.escalationMessage ? `${why}\n\nThey asked: ${c.escalationMessage}` : why;
}

function formatTime(timestamp: string): string {
    try {
        const d = new Date(timestamp);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}
