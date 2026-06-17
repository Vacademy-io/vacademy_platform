import { cn } from '@/lib/utils';
import {
    ChatCircleDots,
    UsersThree,
    UsersFour,
    User as UserIcon,
    MagnifyingGlass,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import type { ChatConversationResponse, ChatConversationType } from '@/services/chat/chatApi';

interface ConversationListProps {
    conversations: ChatConversationResponse[];
    activeId?: string;
    isLoading: boolean;
    search: string;
    onSearchChange: (value: string) => void;
    onSelect: (conversation: ChatConversationResponse) => void;
    onNewChat: () => void;
}

const typeIcon = (type: ChatConversationType) => {
    switch (type) {
        case 'COMMUNITY':
            return UsersFour;
        case 'BATCH_GROUP':
            return UsersThree;
        default:
            return UserIcon;
    }
};

const conversationTitle = (c: ChatConversationResponse): string => {
    if (c.title) return c.title;
    if (c.type === 'COMMUNITY') return 'Community';
    if (c.type === 'BATCH_GROUP') {
        return `${getTerminology(ContentTerms.Batch, SystemTerms.Batch)} Group`;
    }
    return 'Direct Message';
};

const formatTime = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) {
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

export function ConversationList({
    conversations,
    activeId,
    isLoading,
    search,
    onSearchChange,
    onSelect,
    onNewChat,
}: ConversationListProps) {
    const batchPlural = getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch);
    const filtered = conversations.filter((c) =>
        conversationTitle(c).toLowerCase().includes(search.trim().toLowerCase())
    );

    return (
        <div className="flex h-full w-full flex-col bg-white">
            {/* Header */}
            <div className="shrink-0 border-b border-neutral-200 p-3">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-neutral-700">Messages</h2>
                    <Button size="sm" onClick={onNewChat} className="bg-primary-500 hover:bg-primary-600">
                        New message
                    </Button>
                </div>
                <div className="relative">
                    <MagnifyingGlass
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={`Search ${batchPlural.toLowerCase()}, people...`}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && (
                    <div className="space-y-2 p-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-14 w-full animate-pulse rounded-md bg-neutral-100"
                            />
                        ))}
                    </div>
                )}

                {!isLoading && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <ChatCircleDots size={36} weight="duotone" className="mb-3 text-neutral-300" />
                        <p className="text-sm text-neutral-500">
                            {search ? 'No conversations match your search.' : 'No conversations yet.'}
                        </p>
                    </div>
                )}

                {!isLoading &&
                    filtered.map((c) => {
                        const Icon = typeIcon(c.type);
                        const isActive = c.id === activeId;
                        return (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => onSelect(c)}
                                className={cn(
                                    'flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-3 text-left transition-colors hover:bg-neutral-50',
                                    isActive && 'bg-primary-50 hover:bg-primary-50'
                                )}
                            >
                                <div
                                    className={cn(
                                        'flex size-10 shrink-0 items-center justify-center rounded-full',
                                        c.type === 'COMMUNITY'
                                            ? 'bg-primary-100 text-primary-600'
                                            : c.type === 'BATCH_GROUP'
                                              ? 'bg-info-50 text-info-600'
                                              : 'bg-neutral-100 text-neutral-500'
                                    )}
                                >
                                    <Icon size={20} weight="duotone" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-medium text-neutral-700">
                                            {conversationTitle(c)}
                                        </span>
                                        <span className="shrink-0 text-xs text-neutral-400">
                                            {formatTime(c.lastMessageAt)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-xs text-neutral-500">
                                            {c.lastMessagePreview || 'No messages yet'}
                                        </span>
                                        {c.unreadCount > 0 && (
                                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-500 px-1.5 text-caption font-semibold text-white">
                                                {c.unreadCount > 99 ? '99+' : c.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
            </div>
        </div>
    );
}
