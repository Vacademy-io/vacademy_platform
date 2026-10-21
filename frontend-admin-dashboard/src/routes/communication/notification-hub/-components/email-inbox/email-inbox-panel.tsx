import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { MyButton } from '@/components/design-system/button';
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
import { isSystemMessage, isSystemSender, resolveOrigin } from '../../-utils/email-text';
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
    // A bounce daemon / postmaster thread: nothing a human will ever read a reply to. The row may
    // be absent from the list (direction filter / search narrowed it away) or come from a backend
    // that predates `system`, so the same sender rule the backend uses is applied here too.
    const selectedIsSystem =
        selectedConvo?.system ??
        isSystemSender(selectedEmail ?? undefined, selectedConvo?.lastMessageSubject);

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
        <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
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

            {/* Two-pane layout. On mobile only one pane shows at a time (driven by selectedEmail). */}
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
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
                <div
                    className={cn(
                        'flex-col flex-1 min-h-0 min-w-0',
                        selectedEmail ? 'flex' : 'hidden md:flex'
                    )}
                >
                    <EmailThread
                        selectedEmail={selectedEmail}
                        counterpartyName={selectedConvo?.name}
                        messages={messages}
                        loading={loadingMessages}
                        hasMore={hasMoreMessages}
                        onLoadOlder={handleLoadOlder}
                        onReply={
                            selectedEmail && !selectedIsSystem
                                ? () => setReplyOpen(true)
                                : undefined
                        }
                        onBack={() => setSelectedEmail(null)}
                        system={selectedIsSystem}
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
 * Build "Re: <subject>" for the composer. Prefers the subject the PERSON last wrote in (their
 * latest non-bounce inbound message), then our own latest inbox reply, and only then any other
 * outgoing subject — otherwise a campaign or OTP sent after their question would prefill
 * "Re: <our campaign title>". Avoids prefixing with "Re:" twice; empty when nothing is usable.
 */
function buildReplySubject(messages: EmailMessage[]): string {
    const passes: ((msg: EmailMessage) => boolean)[] = [
        (msg) => msg.direction === 'INCOMING' && !isSystemMessage(msg),
        (msg) => msg.direction === 'OUTGOING' && resolveOrigin(msg) === 'INBOX_REPLY',
        () => true,
    ];
    for (const matches of passes) {
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (!msg || !matches(msg)) continue;
            const subj = msg.subject?.trim();
            if (subj) {
                return /^re:/i.test(subj) ? subj : `Re: ${subj}`;
            }
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
    const { t } = useTranslation('communicationEmailInboxPanel');
    return (
        <header className="flex shrink-0 flex-wrap items-center gap-3">
            <SenderSelect senders={senders} value={senderFilter} onChange={onSenderChange} />
            <DirectionFilter value={directionFilter} onChange={onDirectionChange} />
            <p className="hidden min-w-0 flex-1 items-center gap-1.5 truncate text-caption text-neutral-500 lg:flex">
                <Tray size={14} className="shrink-0 text-neutral-400" />
                <span className="truncate">{t('subtitle')}</span>
            </p>
            <MyButton
                buttonType="secondary"
                scale="medium"
                layoutVariant="icon"
                onClick={onRefresh}
                className="ml-auto shrink-0 lg:ml-0"
                title={t('refresh')}
                aria-label={t('refresh')}
            >
                <ArrowClockwise size={16} />
            </MyButton>
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
    const { t } = useTranslation('communicationEmailInboxPanel');
    const empty = senders.length === 0;
    return (
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none">
            <span className="shrink-0 text-xs font-medium text-neutral-500">{t('inboxFor')}</span>
            <Select value={value} onValueChange={onChange} disabled={empty}>
                <SelectTrigger className="h-9 w-full bg-white text-xs sm:w-64">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL_SENDERS} className="text-xs">
                        {empty ? t('noSendersConfigured') : t('allSenders', { count: senders.length })}
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
    const { t } = useTranslation('communicationEmailInboxPanel');
    const options: { value: EmailDirectionFilter; label: string; icon: React.ReactNode }[] = [
        { value: 'ALL', label: t('direction.all'), icon: null },
        { value: 'SENT', label: t('direction.sent'), icon: <PaperPlaneTilt size={12} weight="fill" /> },
        {
            value: 'RECEIVED',
            label: t('direction.received'),
            icon: <ArrowFatDown size={12} weight="fill" />,
        },
    ];
    return (
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    onClick={() => onChange(o.value)}
                    type="button"
                    aria-pressed={value === o.value}
                    className={cn(
                        'flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition',
                        value === o.value
                            ? 'bg-primary-500 text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                    )}
                >
                    {o.icon}
                    {o.label}
                </button>
            ))}
        </div>
    );
}
