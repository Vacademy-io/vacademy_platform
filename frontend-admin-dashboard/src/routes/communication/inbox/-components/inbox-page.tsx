import { useEffect, useCallback, useRef } from 'react';
import { getInstituteId } from '@/constants/helper';
import { useInboxStore } from '../-stores/inbox-store';
import { getConversations, getMessages, searchConversations } from '../-services/inbox-api';
import { ConversationList } from './conversation-list';
import { ChatPanel } from './chat-panel';
import { ArrowClockwise } from '@phosphor-icons/react';

const POLL_INTERVAL = 20000; // 20 seconds

export function InboxPage() {
    const instituteId = getInstituteId() || '';
    const {
        selectedPhone,
        searchQuery,
        setConversations,
        appendConversations,
        setMessages,
        setIsLoadingConversations,
        setIsLoadingMessages,
        setHasMoreConversations,
        setHasMoreMessages,
        conversationOffset,
        incrementOffset,
        resetOffset,
    } = useInboxStore();

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadConversations = useCallback(async (reset = false) => {
        setIsLoadingConversations(true);
        try {
            const offset = reset ? 0 : conversationOffset;
            if (reset) resetOffset();

            const data = searchQuery
                ? await searchConversations(instituteId, searchQuery)
                : await getConversations(instituteId, offset);

            if (reset || searchQuery) {
                setConversations(data);
            } else {
                appendConversations(data);
            }
            setHasMoreConversations(data.length >= 30);
        } catch (err) {
            console.error('Failed to load conversations', err);
        } finally {
            setIsLoadingConversations(false);
        }
    }, [instituteId, searchQuery, conversationOffset]);

    const loadMessages = useCallback(async (phone: string, cursor?: string) => {
        setIsLoadingMessages(true);
        try {
            const data = await getMessages(phone, instituteId, cursor);
            if (cursor) {
                // Loading older messages — prepend (data is newest-first, reverse for display)
                useInboxStore.getState().prependMessages(data.reverse());
            } else {
                // Initial load — reverse for chronological display
                setMessages(data.reverse());
            }
            setHasMoreMessages(data.length >= 50);
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            setIsLoadingMessages(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadConversations(true);
    }, [instituteId, searchQuery]);

    // Load messages when phone selected
    useEffect(() => {
        if (selectedPhone) {
            loadMessages(selectedPhone);
        }
    }, [selectedPhone, loadMessages]);

    // Polling — refresh conversation list only (lightweight).
    // Messages for the selected phone are NOT replaced to preserve scroll position.
    // User clicks "Refresh" or switches phones to get latest messages.
    useEffect(() => {
        pollRef.current = setInterval(() => {
            loadConversations(true);
        }, POLL_INTERVAL);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [loadConversations]);

    const handleRefresh = () => {
        loadConversations(true);
        if (selectedPhone) loadMessages(selectedPhone);
    };

    const handleLoadMore = () => {
        incrementOffset();
        loadConversations(false);
    };

    const handleLoadOlderMessages = () => {
        const messages = useInboxStore.getState().messages;
        if (messages.length > 0) {
            const oldestTimestamp = messages[0]?.timestamp;
            if (selectedPhone && oldestTimestamp) {
                loadMessages(selectedPhone, oldestTimestamp);
            }
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">WhatsApp Inbox</h2>
                    <p className="text-xs text-gray-400">View and reply to WhatsApp conversations</p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="p-2 rounded hover:bg-gray-100 text-gray-500"
                    title="Refresh"
                >
                    <ArrowClockwise size={18} />
                </button>
            </div>

            {/* Main content: conversation list + chat panel */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                <ConversationList
                    onLoadMore={handleLoadMore}
                />
                <ChatPanel
                    onLoadOlder={handleLoadOlderMessages}
                />
            </div>
        </div>
    );
}
