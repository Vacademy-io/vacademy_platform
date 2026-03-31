import { create } from 'zustand';
import { InboxConversation, InboxMessage } from '../-services/inbox-api';

interface InboxState {
    conversations: InboxConversation[];
    selectedPhone: string | null;
    messages: InboxMessage[];
    searchQuery: string;
    isLoadingConversations: boolean;
    isLoadingMessages: boolean;
    hasMoreConversations: boolean;
    hasMoreMessages: boolean;
    conversationOffset: number;

    setConversations: (conversations: InboxConversation[]) => void;
    appendConversations: (conversations: InboxConversation[]) => void;
    selectPhone: (phone: string | null) => void;
    setMessages: (messages: InboxMessage[]) => void;
    prependMessages: (messages: InboxMessage[]) => void;
    appendMessage: (message: InboxMessage) => void;
    setSearchQuery: (query: string) => void;
    setIsLoadingConversations: (loading: boolean) => void;
    setIsLoadingMessages: (loading: boolean) => void;
    setHasMoreConversations: (hasMore: boolean) => void;
    setHasMoreMessages: (hasMore: boolean) => void;
    incrementOffset: () => void;
    resetOffset: () => void;

    // Update conversation's last message when a new message is sent/received
    updateConversationLastMessage: (phone: string, message: string, type: string) => void;
}

export const useInboxStore = create<InboxState>((set) => ({
    conversations: [],
    selectedPhone: null,
    messages: [],
    searchQuery: '',
    isLoadingConversations: false,
    isLoadingMessages: false,
    hasMoreConversations: true,
    hasMoreMessages: true,
    conversationOffset: 0,

    setConversations: (conversations) => set({ conversations }),
    appendConversations: (newConvos) =>
        set((state) => {
            // Deduplicate by phone
            const existing = new Set(state.conversations.map((c) => c.phone));
            const unique = newConvos.filter((c) => !existing.has(c.phone));
            return { conversations: [...state.conversations, ...unique] };
        }),
    selectPhone: (phone) => set({ selectedPhone: phone, messages: [], hasMoreMessages: true }),
    setMessages: (messages) => set({ messages }),
    prependMessages: (olderMessages) =>
        set((state) => ({ messages: [...olderMessages, ...state.messages] })),
    appendMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setIsLoadingConversations: (loading) => set({ isLoadingConversations: loading }),
    setIsLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
    setHasMoreConversations: (hasMore) => set({ hasMoreConversations: hasMore }),
    setHasMoreMessages: (hasMore) => set({ hasMoreMessages: hasMore }),
    incrementOffset: () => set((state) => ({ conversationOffset: state.conversationOffset + 30 })),
    resetOffset: () => set({ conversationOffset: 0 }),

    updateConversationLastMessage: (phone, message, type) =>
        set((state) => ({
            conversations: state.conversations.map((c) =>
                c.phone === phone
                    ? {
                          ...c,
                          lastMessage: message.substring(0, 60),
                          lastMessageType: type,
                          lastMessageTime: new Date().toISOString(),
                          unreadCount: type === 'INCOMING' ? (c.unreadCount || 0) + 1 : 0,
                      }
                    : c
            ),
        })),
}));
