import { useInboxStore } from '../-stores/inbox-store';
import { MagnifyingGlass } from '@phosphor-icons/react';

interface Props {
    onLoadMore: () => void;
}

export function ConversationList({ onLoadMore }: Props) {
    const conversations = useInboxStore((s) => s.conversations);
    const selectedPhone = useInboxStore((s) => s.selectedPhone);
    const selectPhone = useInboxStore((s) => s.selectPhone);
    const searchQuery = useInboxStore((s) => s.searchQuery);
    const setSearchQuery = useInboxStore((s) => s.setSearchQuery);
    const isLoading = useInboxStore((s) => s.isLoadingConversations);
    const hasMore = useInboxStore((s) => s.hasMoreConversations);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !isLoading) {
            onLoadMore();
        }
    };

    return (
        <div className="w-80 shrink-0 border-r flex flex-col bg-white">
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
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
                {conversations.length === 0 && !isLoading ? (
                    <p className="p-4 text-sm text-gray-400 text-center">No conversations yet</p>
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
