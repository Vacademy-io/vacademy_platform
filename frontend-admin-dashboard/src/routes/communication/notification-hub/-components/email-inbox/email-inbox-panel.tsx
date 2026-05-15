import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowClockwise,
    PaperPlaneTilt,
    ArrowFatDown,
    Tray,
} from '@phosphor-icons/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import {
    getEmailConversations,
    getEmailMessages,
    getInstituteSenders,
    searchEmailConversations,
    type EmailConversation,
    type EmailDirectionFilter,
    type EmailInboxFilters,
    type EmailMessage,
} from '../../-services/email-inbox-api';
import { EmailConversationList } from './email-conversation-list';
import { EmailThread } from './email-thread';
import { EmailReplyComposer } from './email-reply-composer';

const POLL_INTERVAL = 20000;
const PAGE_SIZE = 30;
const ALL_SENDERS = '__all__';

export function EmailInboxPanel() {
    const instituteId = getInstituteId() || '';

    const [senders, setSenders] = useState<string[]>([]);
    const [senderFilter, setSenderFilter] = useState<string>(ALL_SENDERS);
    const [directionFilter, setDirectionFilter] = useState<EmailDirectionFilter>('ALL');

    const [conversations, setConversations] = useState<EmailConversation[]>([]);
    // Cursor for infinite scroll: number of items already fetched. Reset to 0 on filter/search change.
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    // Guard against rapid IntersectionObserver re-fires while a request is in flight.
    const loadingMoreRef = useRef(false);

    const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
    const [messages, setMessages] = useState<EmailMessage[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);

    // Reply dialog is hidden by default. Opened explicitly via the Reply button in the thread
    // header so the composer never covers the email body the admin is reading.
    const [replyOpen, setReplyOpen] = useState(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const filters: EmailInboxFilters = useMemo(
        () => ({
            instituteAddress: senderFilter === ALL_SENDERS ? undefined : senderFilter,
            direction: directionFilter,
        }),
        [senderFilter, directionFilter]
    );

    // ---------- Sender dropdown ----------
    useEffect(() => {
        if (!instituteId) return;
        let cancelled = false;
        getInstituteSenders(instituteId)
            .then((s) => {
                if (!cancelled) setSenders(s);
            })
            .catch((err) => console.error('Failed to load institute senders', err));
        return () => {
            cancelled = true;
        };
    }, [instituteId]);

    // ---------- Conversation list — first page ----------
    // Re-runs whenever the search query or filters change. Wipes the current list and resets offset.
    const loadFirstPage = useCallback(async () => {
        if (!instituteId) return;
        setLoadingConversations(true);
        try {
            const data = searchQuery
                ? await searchEmailConversations(instituteId, searchQuery, 0, PAGE_SIZE, filters)
                : await getEmailConversations(instituteId, 0, PAGE_SIZE, filters);
            setConversations(data);
            setOffset(data.length);
            setHasMore(data.length >= PAGE_SIZE);
        } catch (err) {
            console.error('Failed to load email conversations', err);
        } finally {
            setLoadingConversations(false);
        }
    }, [instituteId, searchQuery, filters]);

    // ---------- Conversation list — additional pages (infinite scroll) ----------
    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current || !hasMore || !instituteId) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        try {
            const data = searchQuery
                ? await searchEmailConversations(
                      instituteId,
                      searchQuery,
                      offset,
                      PAGE_SIZE,
                      filters
                  )
                : await getEmailConversations(instituteId, offset, PAGE_SIZE, filters);
            if (data.length === 0) {
                setHasMore(false);
            } else {
                // Dedup defensively (poll/loadMore race could re-include a row briefly).
                setConversations((prev) => {
                    const seen = new Set(prev.map((c) => c.email));
                    const additions = data.filter((c) => !seen.has(c.email));
                    return [...prev, ...additions];
                });
                setOffset((prev) => prev + data.length);
                setHasMore(data.length >= PAGE_SIZE);
            }
        } catch (err) {
            console.error('Failed to load more conversations', err);
        } finally {
            setLoadingMore(false);
            loadingMoreRef.current = false;
        }
    }, [hasMore, instituteId, offset, searchQuery, filters]);

    // ---------- Messages for selected conversation ----------
    const loadMessages = useCallback(
        async (email: string, cursor?: string) => {
            if (!instituteId || !email) return;
            setLoadingMessages(true);
            try {
                const data = await getEmailMessages(email, instituteId, cursor, 50, filters);
                if (cursor) {
                    setMessages((prev) => [...data.reverse(), ...prev]);
                } else {
                    setMessages(data.reverse());
                }
                setHasMoreMessages(data.length >= 50);
            } catch (err) {
                console.error('Failed to load email messages', err);
            } finally {
                setLoadingMessages(false);
            }
        },
        [instituteId, filters]
    );

    // Re-fetch first page whenever filters/search change. loadFirstPage already
    // depends on those, so this single effect captures both triggers.
    useEffect(() => {
        loadFirstPage();
    }, [loadFirstPage]);

    useEffect(() => {
        if (selectedEmail) {
            loadMessages(selectedEmail);
        } else {
            setMessages([]);
        }
    }, [selectedEmail, loadMessages]);

    // Background poll — refreshes ONLY the first page so we get new conversations without
    // wiping the user's scroll position past the first page. Keeps it lightweight.
    useEffect(() => {
        pollRef.current = setInterval(() => {
            if (!loadingMoreRef.current) {
                // Don't poll while a load-more is in flight to avoid clobbering the list.
                refreshFirstPageIntoExisting();
            }
        }, POLL_INTERVAL);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
        // refreshFirstPageIntoExisting is stable via the latest-closure pattern below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instituteId, searchQuery, filters]);

    // Quietly fetches page 0 and merges it on top of the existing list (no scroll reset).
    const refreshFirstPageIntoExisting = useCallback(async () => {
        if (!instituteId) return;
        try {
            const data = searchQuery
                ? await searchEmailConversations(instituteId, searchQuery, 0, PAGE_SIZE, filters)
                : await getEmailConversations(instituteId, 0, PAGE_SIZE, filters);
            setConversations((prev) => {
                const byEmail = new Map(prev.map((c) => [c.email, c]));
                data.forEach((c) => byEmail.set(c.email, c));
                // Preserve order: newest first across both sets, by lastMessageTime.
                return Array.from(byEmail.values()).sort((a, b) => {
                    const ta = a.lastMessageTime ? Date.parse(a.lastMessageTime) : 0;
                    const tb = b.lastMessageTime ? Date.parse(b.lastMessageTime) : 0;
                    return tb - ta;
                });
            });
        } catch (err) {
            console.error('Polling refresh failed', err);
        }
    }, [instituteId, searchQuery, filters]);

    const selectedConvo = conversations.find((c) => c.email === selectedEmail);

    const handleRefresh = () => {
        loadFirstPage();
        if (selectedEmail) loadMessages(selectedEmail);
    };

    const handleLoadOlder = () => {
        if (messages.length === 0 || !selectedEmail) return;
        const oldest = messages[0]?.timestamp;
        if (oldest) loadMessages(selectedEmail, oldest);
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <HeaderBar
                senders={senders}
                senderFilter={senderFilter}
                onSenderChange={(v) => {
                    setSenderFilter(v);
                    setSelectedEmail(null);
                }}
                directionFilter={directionFilter}
                onDirectionChange={setDirectionFilter}
                onRefresh={handleRefresh}
            />

            <div className="flex flex-1 min-h-0 overflow-hidden">
                <EmailConversationList
                    conversations={conversations}
                    selectedEmail={selectedEmail}
                    onSelect={setSelectedEmail}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    loading={loadingConversations}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    loadingMore={loadingMore}
                />
                <div className="flex flex-col flex-1 min-h-0">
                    <EmailThread
                        selectedEmail={selectedEmail}
                        counterpartyName={selectedConvo?.name}
                        messages={messages}
                        loading={loadingMessages}
                        hasMore={hasMoreMessages}
                        onLoadOlder={handleLoadOlder}
                        onReply={selectedEmail ? () => setReplyOpen(true) : undefined}
                    />
                </div>
            </div>

            {/* Reply dialog — rendered once, controlled by replyOpen. Prefills subject as
                "Re: <subject of the latest inbound or outbound message>" when available. */}
            <EmailReplyComposer
                open={replyOpen}
                onOpenChange={setReplyOpen}
                instituteId={instituteId}
                toEmail={selectedEmail}
                defaultSubject={buildReplySubject(messages)}
                onSent={(msg) => {
                    setMessages((prev) => [...prev, msg]);
                    refreshFirstPageIntoExisting();
                }}
            />
        </div>
    );
}

/**
 * Build "Re: <subject>" from the latest message in the thread that has a subject.
 * Avoids prefixing with "Re:" twice. Returns empty string when nothing useful is available.
 */
function buildReplySubject(messages: EmailMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const subj = msg?.subject?.trim();
        if (subj) {
            return /^re:/i.test(subj) ? subj : `Re: ${subj}`;
        }
    }
    return '';
}

function HeaderBar({
    senders,
    senderFilter,
    onSenderChange,
    directionFilter,
    onDirectionChange,
    onRefresh,
}: {
    senders: string[];
    senderFilter: string;
    onSenderChange: (v: string) => void;
    directionFilter: EmailDirectionFilter;
    onDirectionChange: (v: EmailDirectionFilter) => void;
    onRefresh: () => void;
}) {
    return (
        <header className="px-4 py-3 border-b bg-card shrink-0">
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <Tray size={20} className="text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">Email Inbox</h3>
                        <p className="text-xs text-muted-foreground truncate">
                            Conversations grouped by audience email, scoped to your configured senders
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRefresh}
                    className="h-8 w-8 shrink-0"
                    title="Refresh"
                >
                    <ArrowClockwise size={16} />
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <SenderSelect
                    senders={senders}
                    value={senderFilter}
                    onChange={onSenderChange}
                />
                <Separator orientation="vertical" className="h-6" />
                <DirectionFilter value={directionFilter} onChange={onDirectionChange} />
            </div>
        </header>
    );
}

function SenderSelect({
    senders,
    value,
    onChange,
}: {
    senders: string[];
    value: string;
    onChange: (v: string) => void;
}) {
    const empty = senders.length === 0;
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Inbox for</span>
            <Select value={value} onValueChange={onChange} disabled={empty}>
                <SelectTrigger className="h-8 text-xs w-[260px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL_SENDERS} className="text-xs">
                        {empty ? 'No senders configured' : `All senders (${senders.length})`}
                    </SelectItem>
                    {senders.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                            {s}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function DirectionFilter({
    value,
    onChange,
}: {
    value: EmailDirectionFilter;
    onChange: (v: EmailDirectionFilter) => void;
}) {
    const options: { value: EmailDirectionFilter; label: string; icon: React.ReactNode }[] = [
        { value: 'ALL', label: 'All', icon: null },
        { value: 'SENT', label: 'Sent', icon: <PaperPlaneTilt size={12} weight="fill" /> },
        {
            value: 'RECEIVED',
            label: 'Received',
            icon: <ArrowFatDown size={12} weight="fill" />,
        },
    ];
    return (
        <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    onClick={() => onChange(o.value)}
                    className={cn(
                        'flex items-center gap-1 px-2.5 h-7 text-xs rounded transition',
                        value === o.value
                            ? 'bg-background text-foreground shadow-sm border border-border'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {o.icon}
                    {o.label}
                </button>
            ))}
        </div>
    );
}
