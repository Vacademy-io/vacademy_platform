import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatCircleDots, Flag, UsersFour, ArrowLeft, Prohibit } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
    listConversations,
    getMessages,
    sendMessage as apiSendMessage,
    deleteMessage as apiDeleteMessage,
    markRead,
    getRules,
    acknowledgeRules,
    createReport,
    classifyChatSendError,
    type ChatConversationResponse,
    type ChatMessageResponse,
    type ChatRulesResponse,
    type SendChatMessageRequest,
    type ChatMessagePayload,
} from '@/services/chat/chatApi';
import { getChatUser } from '@/services/chat/getChatUser';
import { useChatStream } from '@/hooks/useChatStream';
import { useIsMobile } from '@/hooks/use-mobile';
import { ConversationList } from './ConversationList';
import { ChatThread, type ThreadMessage } from './ChatThread';
import { MessageComposer } from './MessageComposer';
import { NewChatModal } from './NewChatModal';
import { CommunityRulesPanel } from './CommunityRulesPanel';
import { RulesEditor } from './RulesEditor';
import { ReportsReviewQueue } from './ReportsReviewQueue';
import {
    getTerminology,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

const CONVERSATIONS_KEY = ['chat', 'conversations'] as const;

const conversationTitle = (c: ChatConversationResponse): string => {
    if (c.title) return c.title;
    if (c.type === 'COMMUNITY') return 'Community';
    if (c.type === 'BATCH_GROUP')
        return `${getTerminology(ContentTerms.Batch, SystemTerms.Batch)} Group`;
    return 'Direct Message';
};

const mergeById = (existing: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] => {
    const map = new Map<string, ThreadMessage>();
    for (const m of existing) map.set(m.id, m);
    for (const m of incoming) map.set(m.id, m);
    // Tiebreak on createdAt so rapid optimistic sends with near-equal seqs keep send order.
    return Array.from(map.values()).sort(
        (a, b) => a.seq - b.seq || a.createdAt.localeCompare(b.createdAt)
    );
};

export function ChatScreen({
    initialConversationId,
}: {
    /** Open this conversation on load (e.g. from a chat push deep-link ?conversationId=). */
    initialConversationId?: string;
} = {}) {
    const queryClient = useQueryClient();
    const deepLinkedRef = useRef(false);
    const isMobile = useIsMobile();
    const { userId } = useMemo(() => getChatUser(), []);

    const [showReports, setShowReports] = useState(false);
    const [search, setSearch] = useState('');
    const [activeId, setActiveId] = useState<string | undefined>(undefined);
    const [newChatOpen, setNewChatOpen] = useState(false);
    const [rulesEditorOpen, setRulesEditorOpen] = useState(false);

    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [rules, setRules] = useState<ChatRulesResponse | null>(null);
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [chatDisabled, setChatDisabled] = useState(false);

    // Report dialog state.
    const [reportTarget, setReportTarget] = useState<ChatMessageResponse | null>(null);
    const [reportReason, setReportReason] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    // Latest known seq for the open conversation — used for SSE resync.
    const latestSeqRef = useRef<number>(0);
    // Monotonic per-pending offset so rapid multi-sends keep their send order.
    const pendingSeqCounterRef = useRef<number>(0);
    const activeIdRef = useRef<string | undefined>(undefined);
    activeIdRef.current = activeId;

    // ── Conversations ────────────────────────────────────────────────────
    const {
        data: conversations = [],
        isLoading: conversationsLoading,
    } = useQuery({
        queryKey: CONVERSATIONS_KEY,
        queryFn: () => listConversations(),
        refetchOnWindowFocus: false,
    });

    const activeConversation = useMemo(
        () => conversations.find((c) => c.id === activeId),
        [conversations, activeId]
    );

    const refetchConversations = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    }, [queryClient]);

    // Patch a single conversation in the cached list (preview/unread/order) without a refetch.
    const patchConversation = useCallback(
        (conversationId: string, patch: (c: ChatConversationResponse) => ChatConversationResponse) => {
            queryClient.setQueryData<ChatConversationResponse[]>(CONVERSATIONS_KEY, (prev) => {
                const list = prev ?? [];
                const idx = list.findIndex((c) => c.id === conversationId);
                const current = list[idx];
                if (!current) return list;
                const updated = patch(current);
                const next = list.slice();
                next.splice(idx, 1);
                return [updated, ...next];
            });
        },
        [queryClient]
    );

    // ── Load messages + rules when the active conversation changes ────────
    const loadInitial = useCallback(
        async (conversation: ChatConversationResponse) => {
            setMessagesLoading(true);
            setMessages([]);
            setRules(null);
            setChatDisabled(false);
            latestSeqRef.current = 0;
            try {
                const page = await getMessages(conversation.id, { limit: 40 });
                const sorted = mergeById([], page.messages);
                setMessages(sorted);
                setHasMore(page.hasMore);
                latestSeqRef.current = page.latestSeq ?? sorted[sorted.length - 1]?.seq ?? 0;

                // Mark read up to the latest message, then clear the badge locally.
                const last = sorted[sorted.length - 1];
                if (last && conversation.unreadCount > 0) {
                    void markRead(conversation.id, last.id).catch(() => undefined);
                    patchConversation(conversation.id, (c) => ({ ...c, unreadCount: 0 }));
                }
            } catch (err) {
                if (classifyChatSendError(err)?.code === 'CHAT_DISABLED') {
                    setChatDisabled(true);
                } else {
                    toast.error('Failed to load messages.');
                }
            } finally {
                setMessagesLoading(false);
            }

            if (conversation.type === 'COMMUNITY') {
                try {
                    const r = await getRules(conversation.id);
                    setRules(r);
                } catch {
                    // Rules are non-fatal; the thread still works.
                }
            }
        },
        [patchConversation]
    );

    const handleSelect = useCallback(
        (conversation: ChatConversationResponse) => {
            setShowReports(false);
            setActiveId(conversation.id);
            void loadInitial(conversation);
        },
        [loadInitial]
    );

    // ── Load earlier (pagination) ─────────────────────────────────────────
    const handleLoadMore = useCallback(async () => {
        if (!activeId || messages.length === 0) return;
        const oldest = messages[0];
        if (!oldest) return;
        try {
            const page = await getMessages(activeId, { beforeCursor: oldest.seq, limit: 40 });
            const sorted = [...page.messages].sort((a, b) => a.seq - b.seq);
            setMessages((prev) => mergeById(sorted, prev));
            setHasMore(page.hasMore);
        } catch {
            toast.error('Failed to load earlier messages.');
        }
    }, [activeId, messages]);

    // ── Send (optimistic) ─────────────────────────────────────────────────
    // Performs the network send for an already-present optimistic row keyed by
    // tempId/dedupKey. Shared by first-send and retry.
    const dispatchSend = useCallback(
        async (conversationId: string, body: SendChatMessageRequest, dedupKey: string) => {
            const tempId = `temp-${dedupKey}`;
            try {
                const saved = await apiSendMessage(conversationId, {
                    ...body,
                    clientDedupKey: dedupKey,
                });
                // Reconcile: drop the optimistic temp row, add the server message.
                setMessages((prev) => {
                    const withoutTemp = prev.filter((m) => m.id !== tempId);
                    return mergeById(withoutTemp, [saved]);
                });
                latestSeqRef.current = Math.max(latestSeqRef.current, saved.seq);
                patchConversation(conversationId, (c) => ({
                    ...c,
                    lastMessagePreview: saved.content || 'Attachment',
                    lastMessageAt: saved.createdAt,
                    lastMessageSeq: saved.seq,
                    lastMessageSenderId: saved.senderId,
                }));
            } catch (err) {
                const rejection = classifyChatSendError(err);
                if (rejection) {
                    // Deterministic 4xx rule rejection — drop the optimistic bubble
                    // entirely (it will never be accepted) and surface the reason.
                    setMessages((prev) => prev.filter((m) => m.id !== tempId));
                    toast.error(rejection.message);
                } else {
                    // Transient error — keep the bubble, marked failed for retry.
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempId ? { ...m, pending: false, failed: true } : m
                        )
                    );
                    toast.error('Message failed to send.');
                }
            }
        },
        [patchConversation]
    );

    const handleSend = useCallback(
        async (body: SendChatMessageRequest) => {
            if (!activeId) return;
            const dedupKey = body.clientDedupKey ?? crypto.randomUUID();
            const tempId = `temp-${dedupKey}`;
            const user = getChatUser();
            const optimistic: ThreadMessage = {
                id: tempId,
                clientDedupKey: dedupKey,
                conversationId: activeId,
                senderId: userId,
                senderName: user.userName,
                senderRole: user.userRole,
                contentType: body.contentType ?? 'TEXT',
                content: body.text,
                attachmentUrl: body.attachmentUrl,
                attachmentName: body.attachmentName,
                attachmentMime: body.attachmentMime,
                attachmentSize: body.attachmentSize,
                // Monotonic offset keeps rapid sends in order; +0.001 per pending row.
                seq: (latestSeqRef.current || 0) + 0.001 * ++pendingSeqCounterRef.current,
                createdAt: new Date().toISOString(),
                pending: true,
            };
            setMessages((prev) => mergeById(prev, [optimistic]));
            await dispatchSend(activeId, body, dedupKey);
        },
        [activeId, userId, dispatchSend]
    );

    // ── Retry a failed send ───────────────────────────────────────────────
    const handleRetry = useCallback(
        (message: ThreadMessage) => {
            const conversationId = message.conversationId;
            const dedupKey = message.clientDedupKey;
            if (!dedupKey) return;
            // Re-mark the existing optimistic row as pending (not failed).
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === message.id ? { ...m, pending: true, failed: false } : m
                )
            );
            void dispatchSend(
                conversationId,
                {
                    contentType: message.contentType,
                    text: message.content,
                    attachmentUrl: message.attachmentUrl,
                    attachmentName: message.attachmentName,
                    attachmentMime: message.attachmentMime,
                    attachmentSize: message.attachmentSize,
                    replyToMessageId: message.replyToMessageId,
                },
                dedupKey
            );
        },
        [dispatchSend]
    );

    // ── Delete a message ──────────────────────────────────────────────────
    const handleDelete = useCallback(async (message: ThreadMessage) => {
        try {
            const updated = await apiDeleteMessage(message.conversationId, message.id);
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        } catch {
            toast.error('Failed to delete the message.');
        }
    }, []);

    // ── Acknowledge community rules ───────────────────────────────────────
    const handleAcknowledge = useCallback(async () => {
        if (!activeId) return;
        setIsAcknowledging(true);
        try {
            const updated = await acknowledgeRules(activeId);
            setRules(updated);
        } catch {
            toast.error('Could not accept the rules.');
        } finally {
            setIsAcknowledging(false);
        }
    }, [activeId]);

    // ── Report a message ──────────────────────────────────────────────────
    const handleReport = useCallback((message: ChatMessageResponse) => {
        setReportTarget(message);
        setReportReason('');
    }, []);

    const handleReportSubmit = useCallback(async () => {
        if (!activeId || !reportTarget) return;
        const trimmed = reportReason.trim();
        if (!trimmed) {
            toast.error('A reason is required to report.');
            return;
        }
        setReportSubmitting(true);
        try {
            await createReport({
                conversationId: activeId,
                messageId: reportTarget.id,
                reason: trimmed,
            });
            toast.success('Report submitted for review.');
            setReportTarget(null);
            setReportReason('');
        } catch {
            toast.error('Failed to submit the report.');
        } finally {
            setReportSubmitting(false);
        }
    }, [activeId, reportTarget, reportReason]);

    // ── SSE: receive new messages + read receipts ─────────────────────────
    const onStreamMessage = useCallback(
        (payload: ChatMessagePayload) => {
            const msg = payload.message;
            if (!msg) return;
            const isActive = payload.conversationId === activeIdRef.current;
            const isOwn = msg.senderId === userId;

            if (isActive) {
                setMessages((prev) => {
                    // Reconcile ONLY the optimistic temp row matching THIS message — matching by
                    // content + type so other in-flight sends from the same user aren't dropped.
                    // (The SSE payload doesn't carry the client dedup key.)
                    let replaced = false;
                    const withoutTemp = prev.filter((m) => {
                        if (
                            !replaced &&
                            m.id.startsWith('temp-') &&
                            m.senderId === msg.senderId &&
                            (m.content ?? '') === (msg.content ?? '') &&
                            m.contentType === msg.contentType
                        ) {
                            replaced = true;
                            return false;
                        }
                        return true;
                    });
                    return mergeById(withoutTemp, [msg]);
                });
                latestSeqRef.current = Math.max(latestSeqRef.current, msg.seq);
                // Only mark read for incoming messages from others while the thread is open.
                if (!isOwn) {
                    void markRead(payload.conversationId, msg.id).catch(() => undefined);
                }
            }

            // Update the single conversation's preview/unread in-place; only refetch the
            // whole list when the message belongs to a conversation we don't know yet.
            const known = (
                queryClient.getQueryData<ChatConversationResponse[]>(CONVERSATIONS_KEY) ?? []
            ).some((c) => c.id === payload.conversationId);
            if (!known) {
                refetchConversations();
                return;
            }
            patchConversation(payload.conversationId, (c) => ({
                ...c,
                lastMessagePreview: msg.content || 'Attachment',
                lastMessageAt: msg.createdAt,
                lastMessageSeq: msg.seq,
                lastMessageSenderId: msg.senderId,
                unreadCount: isActive || isOwn ? c.unreadCount : c.unreadCount + 1,
            }));
        },
        [userId, queryClient, refetchConversations, patchConversation]
    );

    const onStreamRead = useCallback(
        (payload: ChatMessagePayload) => {
            // Another of the user's sessions read up to a seq; clear our local badge.
            if (payload.readerUserId && payload.readerUserId === userId) {
                patchConversation(payload.conversationId, (c) => ({ ...c, unreadCount: 0 }));
            }
        },
        [userId, patchConversation]
    );

    const onStreamReconnect = useCallback(() => {
        // Catch the list up after a reconnect.
        refetchConversations();
        const id = activeIdRef.current;
        if (!id) return;
        // Catch up on anything missed while disconnected, reconciling against any
        // pending optimistic temp- rows so placeholders are replaced, not duplicated.
        void getMessages(id, { sinceCursor: latestSeqRef.current, limit: 40 })
            .then((page) => {
                if (page.messages.length === 0) return;
                const fresh = mergeById([], page.messages);
                setMessages((prev) => {
                    // Drop any pending optimistic temp- row that the fresh page already
                    // contains (matched by content + sender + type) so we don't duplicate.
                    let next = prev;
                    for (const m of fresh) {
                        let matched = false;
                        next = next.filter((p) => {
                            if (
                                !matched &&
                                p.id.startsWith('temp-') &&
                                p.senderId === m.senderId &&
                                (p.content ?? '') === (m.content ?? '') &&
                                p.contentType === m.contentType
                            ) {
                                matched = true;
                                return false;
                            }
                            return true;
                        });
                    }
                    return mergeById(next, fresh);
                });
                latestSeqRef.current = Math.max(
                    latestSeqRef.current,
                    page.latestSeq ?? fresh[fresh.length - 1]?.seq ?? 0
                );
            })
            .catch(() => undefined);
    }, [refetchConversations]);

    useChatStream({
        onMessage: onStreamMessage,
        onRead: onStreamRead,
        onReconnect: onStreamReconnect,
        enabled: Boolean(userId),
    });

    // Keep the active conversation's rules editor in sync after save.
    const handleRulesSaved = useCallback((updated: ChatRulesResponse) => {
        setRules(updated);
    }, []);

    // Auto-select the first conversation on first load — DESKTOP ONLY. On mobile
    // the list and thread share one column, so auto-selecting would trap the user
    // in a thread with the list hidden (mirrors the learner app behavior).
    useEffect(() => {
        if (activeId || showReports || conversations.length === 0) return;
        // A chat push deep-link takes precedence and opens even on mobile.
        if (initialConversationId && !deepLinkedRef.current) {
            const target = conversations.find((c) => c.id === initialConversationId);
            if (target) {
                deepLinkedRef.current = true;
                handleSelect(target);
                return;
            }
        }
        if (!isMobile) {
            const first = conversations[0];
            if (first) handleSelect(first);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversations, isMobile, initialConversationId]);

    const isCommunity = activeConversation?.type === 'COMMUNITY';
    const ackRequired = rules?.rules?.acknowledgement_required;
    const composerGated = Boolean(isCommunity && ackRequired && rules && !rules.acknowledged);
    const cannotPost = activeConversation ? !activeConversation.canPost : false;
    const allowAttachments = rules?.rules?.posting?.allow_attachments ?? true;

    const composerDisabledReason = composerGated
        ? 'Accept the community guidelines above to post.'
        : cannotPost
          ? 'You do not have permission to post in this conversation.'
          : undefined;

    const shellClass =
        'flex h-[calc(100vh-140px)] min-h-[520px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm'; // design-lint-ignore: viewport-relative chat height has no spacing token

    return (
        <div className={shellClass}>
            {/* Left: conversation list */}
            <aside
                className={cn(
                    'w-full shrink-0 border-r border-neutral-200 md:w-80',
                    activeId || showReports ? 'hidden md:block' : 'block'
                )}
            >
                <div className="flex h-full flex-col">
                    <button
                        type="button"
                        onClick={() => {
                            setShowReports(true);
                            setActiveId(undefined);
                        }}
                        className={cn(
                            'flex shrink-0 items-center gap-2 border-b border-neutral-200 px-4 py-3 text-sm font-medium transition-colors',
                            showReports
                                ? 'bg-primary-50 text-primary-600'
                                : 'text-neutral-600 hover:bg-neutral-50'
                        )}
                    >
                        <Flag size={16} weight="duotone" />
                        Reports
                    </button>
                    <div className="min-h-0 flex-1">
                        <ConversationList
                            conversations={conversations}
                            activeId={showReports ? undefined : activeId}
                            isLoading={conversationsLoading}
                            search={search}
                            onSearchChange={setSearch}
                            onSelect={handleSelect}
                            onNewChat={() => setNewChatOpen(true)}
                        />
                    </div>
                </div>
            </aside>

            {/* Right: thread / reports / empty */}
            <main
                className={cn(
                    'flex min-w-0 flex-1 flex-col',
                    !activeId && !showReports ? 'hidden md:flex' : 'flex'
                )}
            >
                {showReports ? (
                    <>
                        <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setShowReports(false)}
                                className="text-neutral-400 hover:text-neutral-600 md:hidden"
                                aria-label="Back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <Flag size={18} weight="duotone" className="text-danger-500" />
                            <h2 className="text-base font-semibold text-neutral-700">
                                Reports review
                            </h2>
                        </header>
                        <div className="min-h-0 flex-1">
                            <ReportsReviewQueue />
                        </div>
                    </>
                ) : activeConversation ? (
                    <>
                        <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setActiveId(undefined)}
                                className="text-neutral-400 hover:text-neutral-600 md:hidden"
                                aria-label="Back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div
                                className={cn(
                                    'flex size-9 items-center justify-center rounded-full',
                                    isCommunity
                                        ? 'bg-primary-100 text-primary-600'
                                        : 'bg-neutral-100 text-neutral-500'
                                )}
                            >
                                {isCommunity ? (
                                    <UsersFour size={18} weight="duotone" />
                                ) : (
                                    <ChatCircleDots size={18} weight="duotone" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-neutral-700">
                                    {conversationTitle(activeConversation)}
                                </div>
                                <div className="text-xs text-neutral-400">
                                    {activeConversation.type === 'DIRECT'
                                        ? 'Direct message'
                                        : activeConversation.type === 'BATCH_GROUP'
                                          ? `${getTerminology(ContentTerms.Batch, SystemTerms.Batch)} group`
                                          : 'Community channel'}
                                </div>
                            </div>
                        </header>

                        {chatDisabled ? (
                            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                                <Prohibit
                                    size={48}
                                    weight="duotone"
                                    className="mb-3 text-neutral-300"
                                />
                                <p className="text-sm font-medium text-neutral-600">
                                    Chat is currently disabled
                                </p>
                                <p className="mt-1 max-w-xs text-xs text-neutral-400">
                                    Chat has been turned off for this institute. Reach out to an
                                    administrator if you think this is a mistake.
                                </p>
                            </div>
                        ) : (
                            <>
                                {isCommunity && rules && (
                                    <CommunityRulesPanel
                                        rules={rules}
                                        isAcknowledging={isAcknowledging}
                                        onAcknowledge={handleAcknowledge}
                                        onEdit={
                                            rules.canEdit
                                                ? () => setRulesEditorOpen(true)
                                                : undefined
                                        }
                                    />
                                )}

                                <ChatThread
                                    conversation={activeConversation}
                                    messages={messages}
                                    currentUserId={userId}
                                    isLoading={messagesLoading}
                                    hasMore={hasMore}
                                    onLoadMore={handleLoadMore}
                                    onReport={handleReport}
                                    onRetry={handleRetry}
                                    onDelete={handleDelete}
                                />

                                <MessageComposer
                                    conversationId={activeConversation.id}
                                    disabled={composerGated || cannotPost}
                                    disabledReason={composerDisabledReason}
                                    allowAttachments={allowAttachments}
                                    onSend={handleSend}
                                />
                            </>
                        )}
                    </>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-center">
                        <ChatCircleDots
                            size={48}
                            weight="duotone"
                            className="mb-3 text-neutral-300"
                        />
                        <p className="text-sm text-neutral-500">
                            Select a conversation to start chatting.
                        </p>
                    </div>
                )}
            </main>

            <NewChatModal
                open={newChatOpen}
                onOpenChange={setNewChatOpen}
                onConversationReady={(conversation) => {
                    refetchConversations();
                    handleSelect(conversation);
                }}
            />

            {activeConversation && isCommunity && rules && (
                <RulesEditor
                    open={rulesEditorOpen}
                    onOpenChange={setRulesEditorOpen}
                    conversationId={activeConversation.id}
                    initial={rules}
                    onSaved={handleRulesSaved}
                />
            )}

            <Dialog
                open={reportTarget !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setReportTarget(null);
                        setReportReason('');
                    }
                }}
            >
                <DialogContent className="w-full max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-neutral-700">
                            Report message
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <label
                            htmlFor="chat-report-reason"
                            className="text-sm font-medium text-neutral-600"
                        >
                            Why are you reporting this message?
                        </label>
                        <Textarea
                            id="chat-report-reason"
                            autoFocus
                            rows={4}
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="Describe the issue..."
                        />
                    </div>
                    <DialogFooter>
                        <MyButton
                            buttonType="secondary"
                            onClick={() => {
                                setReportTarget(null);
                                setReportReason('');
                            }}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            disabled={!reportReason.trim() || reportSubmitting}
                            onClick={() => void handleReportSubmit()}
                        >
                            {reportSubmitting ? 'Submitting...' : 'Submit report'}
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
