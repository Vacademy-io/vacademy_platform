import { useEffect, useRef } from 'react';
import { useInboxStore } from '../-stores/inbox-store';
import { ReplyBox } from './reply-box';
import { ChatCircle, User, Robot, ArrowUp } from '@phosphor-icons/react';

interface Props {
    onLoadOlder: () => void;
}

export function ChatPanel({ onLoadOlder }: Props) {
    const selectedPhone = useInboxStore((s) => s.selectedPhone);
    const messages = useInboxStore((s) => s.messages);
    const conversations = useInboxStore((s) => s.conversations);
    const isLoading = useInboxStore((s) => s.isLoadingMessages);
    const hasMore = useInboxStore((s) => s.hasMoreMessages);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const selectedConvo = conversations.find((c) => c.phone === selectedPhone);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    if (!selectedPhone) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                    <ChatCircle size={56} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">Select a conversation</p>
                    <p className="text-xs mt-1">Choose a contact from the left to view messages</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#e5ddd5]">
            {/* Chat header */}
            <div className="px-4 py-2.5 bg-white border-b flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                    <User size={18} className="text-green-700" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-800">
                        {selectedConvo?.senderName || selectedPhone}
                    </p>
                    <p className="text-xs text-gray-400">
                        {selectedConvo?.senderName ? selectedPhone : ''}
                        {selectedConvo?.userId && (
                            <span className="ml-2 text-blue-500">ID: {selectedConvo.userId}</span>
                        )}
                    </p>
                </div>
            </div>

            {/* Messages area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {/* Load older button */}
                {hasMore && (
                    <div className="text-center py-2">
                        <button
                            onClick={onLoadOlder}
                            disabled={isLoading}
                            className="text-xs px-3 py-1 bg-white rounded-full shadow text-gray-500 hover:bg-gray-50 inline-flex items-center gap-1"
                        >
                            <ArrowUp size={12} />
                            {isLoading ? 'Loading...' : 'Load older messages'}
                        </button>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={msg.id || i}
                        className={`flex ${msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[65%] px-3 py-2 rounded-lg text-sm shadow-sm ${
                                msg.direction === 'OUTGOING'
                                    ? 'bg-[#dcf8c6] rounded-tr-none'
                                    : 'bg-white rounded-tl-none'
                            }`}
                        >
                            {/* Sender label */}
                            {msg.direction === 'INCOMING' && msg.senderName && (
                                <p className="text-xs font-medium text-green-700 mb-0.5">{msg.senderName}</p>
                            )}
                            {msg.direction === 'OUTGOING' && (
                                <p className="text-xs font-medium text-blue-600 mb-0.5 flex items-center gap-0.5">
                                    <Robot size={10} /> Bot
                                </p>
                            )}

                            {/* Message body */}
                            <p className="whitespace-pre-wrap break-words text-gray-800">{msg.body}</p>

                            {/* Timestamp + status */}
                            <p className={`text-[10px] mt-1 text-right ${
                                msg.direction === 'OUTGOING' ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                                {msg.timestamp ? formatTime(msg.timestamp) : ''}
                                {msg.direction === 'OUTGOING' && (
                                    <span className="ml-1">
                                        {msg.status?.includes('READ') ? '✓✓' : msg.status?.includes('DELIVERED') ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            <ReplyBox phone={selectedPhone} />
        </div>
    );
}

function formatTime(timestamp: string): string {
    try {
        return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}
