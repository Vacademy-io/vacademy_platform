import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MagnifyingGlass, ArrowFatDown, PaperPlaneTilt, EnvelopeSimple } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { EmailConversation } from '../../-services/email-inbox-api';

interface Props {
    conversations: EmailConversation[];
    selectedEmail: string | null;
    onSelect: (email: string) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    loading: boolean;
    /** True when there are more pages to load. Hides the sentinel + "Loading more" footer when false. */
    hasMore: boolean;
    /** Called when the bottom sentinel scrolls into view. Should be debounced/dedup'd by the caller. */
    onLoadMore: () => void;
    /** True while a load-more request is in flight (renders a footer skeleton). */
    loadingMore: boolean;
}

export function EmailConversationList({
    conversations,
    selectedEmail,
    onSelect,
    searchQuery,
    onSearchChange,
    loading,
    hasMore,
    onLoadMore,
    loadingMore,
}: Props) {
    const { t, i18n } = useTranslation('communicationEmailConversationList');
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Infinite scroll — fire onLoadMore the moment the bottom sentinel enters view.
    // Re-binds whenever hasMore/onLoadMore change so the latest closure is observed.
    useEffect(() => {
        const target = sentinelRef.current;
        if (!target || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting) {
                    onLoadMore();
                }
            },
            // `root: null` -> uses nearest scroll ancestor (the ScrollArea viewport)
            { root: null, rootMargin: '120px', threshold: 0 }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, onLoadMore]);

    return (
        <aside
            className={cn(
                'w-full md:w-80 shrink-0 border-r flex-col bg-card',
                selectedEmail ? 'hidden md:flex' : 'flex'
            )}
        >
            <div className="p-3 border-b">
                <div className="relative">
                    <MagnifyingGlass
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={t('searchPlaceholder')}
                        className="pl-8 h-9"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                {loading && conversations.length === 0 ? (
                    <div className="p-3 space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-16 rounded-md" />
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <EmptyState />
                ) : (
                    <>
                        <ul className="divide-y divide-border">
                            {conversations.map((c) => (
                                <ConversationRow
                                    key={c.email}
                                    conversation={c}
                                    selected={selectedEmail === c.email}
                                    onClick={() => onSelect(c.email)}
                                    t={t}
                                    locale={i18n.language}
                                />
                            ))}
                        </ul>

                        {/* Infinite-scroll sentinel + loading footer */}
                        {hasMore && (
                            <div
                                ref={sentinelRef}
                                className="p-3"
                                aria-hidden
                            >
                                {loadingMore ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <Skeleton key={i} className="h-14 rounded-md" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-6" />
                                )}
                            </div>
                        )}
                        {!hasMore && conversations.length > 0 && (
                            <p className="text-center text-[11px] text-muted-foreground py-3">
                                {t('endOfConversations')}
                            </p>
                        )}
                    </>
                )}
            </ScrollArea>
        </aside>
    );
}

function ConversationRow({
    conversation: c,
    selected,
    onClick,
    t,
    locale,
}: {
    conversation: EmailConversation;
    selected: boolean;
    onClick: () => void;
    t: TFunction;
    locale: string;
}) {
    const display = c.name || c.email;
    const initials = getInitials(display);
    const unread = c.unreadCount ?? 0;
    const isOutgoing = c.lastMessageDirection === 'OUTGOING';

    return (
        <li>
            <button
                onClick={onClick}
                className={cn(
                    'w-full text-left px-3 py-3 flex items-start gap-3 transition-colors',
                    selected
                        ? 'bg-primary/5 border-l-2 border-l-primary'
                        : 'border-l-2 border-l-transparent hover:bg-muted/60'
                )}
            >
                <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-muted text-muted-foreground">
                        {initials}
                    </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <p
                            className={cn(
                                'text-sm truncate',
                                unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                            )}
                        >
                            {display}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                            {c.lastMessageTime ? formatTime(c.lastMessageTime, t, locale) : ''}
                        </span>
                    </div>

                    {c.name && (
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                        <p
                            className={cn(
                                'text-xs truncate flex items-center gap-1.5 min-w-0',
                                unread > 0 ? 'text-foreground' : 'text-muted-foreground'
                            )}
                        >
                            <DirectionIcon outgoing={isOutgoing} />
                            <span className="truncate">{c.lastMessagePreview || '—'}</span>
                        </p>
                        {unread > 0 && (
                            <Badge
                                variant="default"
                                className="h-5 min-w-[20px] px-1.5 text-[10px] flex items-center justify-center"
                            >
                                {unread > 99 ? '99+' : unread}
                            </Badge>
                        )}
                    </div>
                </div>
            </button>
        </li>
    );
}

function DirectionIcon({ outgoing }: { outgoing: boolean }) {
    return outgoing ? (
        <PaperPlaneTilt size={12} className="text-primary shrink-0" weight="fill" />
    ) : (
        <ArrowFatDown size={12} className="text-emerald-600 shrink-0" weight="fill" />
    );
}

function EmptyState() {
    const { t } = useTranslation('communicationEmailConversationList');
    return (
        <div className="h-full flex items-center justify-center py-12 px-6">
            <div className="text-center text-muted-foreground">
                <EnvelopeSimple size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('noConversations')}</p>
                <p className="text-xs mt-1 opacity-70">
                    {t('noConversationsHint')}
                </p>
            </div>
        </div>
    );
}

function getInitials(s: string): string {
    if (!s) return '?';
    const parts = s.split(/[\s@.]+/).filter(Boolean);
    if (parts.length === 0) return s.charAt(0).toUpperCase();
    if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatTime(timestamp: string, t: TFunction, locale: string): string {
    try {
        const d = new Date(timestamp);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        }
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return t('yesterday');
        return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}
