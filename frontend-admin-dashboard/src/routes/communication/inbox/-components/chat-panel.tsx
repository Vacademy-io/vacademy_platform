import { useEffect, useRef } from 'react';
import { useInboxStore } from '../-stores/inbox-store';
import type { InboxMessage } from '../-services/inbox-api';
import { ReplyBox } from './reply-box';
import {
    ChatCircle,
    User,
    Robot,
    ArrowUp,
    ArrowLeft,
    FileText,
    HandWaving,
    WarningCircle,
} from '@phosphor-icons/react';

interface Props {
    onLoadOlder: () => void;
}

export function ChatPanel({ onLoadOlder }: Props) {
    const selectedPhone = useInboxStore((s) => s.selectedPhone);
    const selectPhone = useInboxStore((s) => s.selectPhone);
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
            <div className="flex-1 hidden md:flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                    <ChatCircle size={56} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">Select a conversation</p>
                    <p className="text-xs mt-1">Choose a contact from the left to view messages</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#e5ddd5] min-w-0">
            {/* Chat header */}
            <div className="px-4 py-2.5 bg-white border-b flex items-center gap-3 shrink-0">
                <button
                    onClick={() => selectPhone(null)}
                    className="md:hidden p-1 -ml-1 rounded hover:bg-gray-100 text-gray-500 shrink-0"
                    title="Back to conversations"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <User size={18} className="text-green-700" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                        {selectedConvo?.senderName || selectedPhone}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                        {selectedConvo?.senderName ? selectedPhone : ''}
                        {selectedConvo?.userId && (
                            <span className="ml-2 text-blue-500">ID: {selectedConvo.userId}</span>
                        )}
                    </p>
                </div>
            </div>

            {/* The chatbot stepped aside on this conversation — say so, and say why, so the
                admin knows what they are answering before scrolling the thread. */}
            {selectedConvo?.awaitingReply && (
                <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 shrink-0">
                    <HandWaving size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="min-w-0 text-xs text-amber-800">
                        <p className="font-medium">Waiting for your reply</p>
                        <p className="text-amber-700">{escalationReasonText(selectedConvo.escalationReason)}</p>
                        {selectedConvo.escalationMessage && (
                            <p className="mt-0.5 italic text-amber-700">
                                They asked: “{selectedConvo.escalationMessage}”
                            </p>
                        )}
                    </div>
                </div>
            )}

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
                                msg.deliveryStatus === 'FAILED'
                                    ? 'bg-red-50 border border-red-200 rounded-tr-none'
                                    : msg.direction === 'OUTGOING'
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

                            {/* Template header media (image / video / document) actually sent */}
                            {msg.headerMediaUrl && (
                                <MessageHeaderMedia
                                    type={msg.headerType}
                                    url={msg.headerMediaUrl}
                                />
                            )}

                            {/* Message body — the actual template text the recipient received */}
                            {msg.body && (
                                <p className="whitespace-pre-wrap break-words text-gray-800">
                                    {msg.body}
                                </p>
                            )}

                            {/* Template context: which template it came from + any send failure */}
                            {msg.templateName && (
                                <p className="text-caption text-gray-500 mt-1 flex flex-wrap items-center gap-1">
                                    <span className="italic">via template “{msg.templateName}”</span>
                                    {msg.provider && (
                                        <span className="px-1 py-px rounded bg-black/5 uppercase tracking-wide">
                                            {msg.provider}
                                        </span>
                                    )}
                                    {msg.deliveryStatus === 'FAILED' && (
                                        <span className="px-1 py-px rounded bg-red-100 text-red-600 font-medium">
                                            Failed
                                        </span>
                                    )}
                                </p>
                            )}
                            {/* Non-template sends carry no "via template" line, so the failure
                                needs its own label — otherwise a red bubble has no explanation. */}
                            {msg.deliveryStatus === 'FAILED' && !msg.templateName && (
                                <p className="text-caption mt-1 flex flex-wrap items-center gap-1 text-red-600">
                                    <WarningCircle size={11} />
                                    <span className="font-medium">Not delivered</span>
                                    {msg.attemptedType && msg.attemptedType !== 'text' && (
                                        <span className="rounded bg-red-100 px-1 py-px uppercase tracking-wide">
                                            {msg.attemptedType}
                                        </span>
                                    )}
                                </p>
                            )}
                            {msg.deliveryStatus === 'FAILED' && msg.error && (
                                <p className="text-caption text-red-500 mt-0.5 break-words">{msg.error}</p>
                            )}

                            {/* Timestamp + status */}
                            <p className={`text-[10px] mt-1 text-right ${
                                msg.direction === 'OUTGOING' ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                                {msg.timestamp ? formatTime(msg.timestamp) : ''}
                                {msg.direction === 'OUTGOING' && msg.deliveryStatus !== 'FAILED' && (
                                    <span className="ml-1" title={msg.deliveryStatus}>
                                        {deliveryTicks(msg)}
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

/**
 * WhatsApp-style ticks. deliveryStatus is WhatsApp's own verdict from its status webhook; msg.status
 * is only the log row type ("WHATSAPP_MESSAGE_OUTGOING"), which never contains READ or DELIVERED —
 * so before the webhook was reconciled onto the row, every outgoing message showed a single tick.
 */
function deliveryTicks(msg: InboxMessage): string {
    const seen = (value?: string) =>
        !!value && (value.includes('READ') || value.includes('DELIVERED'));
    // Both, not one or the other: the msg.status check is the pre-existing rule and stays exactly as
    // it was, deliveryStatus only adds the cases it could never see.
    return seen(msg.deliveryStatus) || seen(msg.status) ? '✓✓' : '✓';
}

function formatTime(timestamp: string): string {
    try {
        return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

/** Plain-language version of why the chatbot handed this conversation over. */
function escalationReasonText(reason?: string): string {
    switch (reason) {
        case 'MAX_TURNS':
            return 'The conversation reached its automated reply limit.';
        case 'AI_ERROR':
            return 'The assistant could not generate a reply.';
        case 'MANUAL':
            return 'Handed over by an admin.';
        default:
            return "The assistant didn't have the information to answer, so it said it would check with the team.";
    }
}

/** Renders the template header attachment (image/video/document) actually sent with the message. */
function MessageHeaderMedia({ type, url }: { type?: string; url: string }) {
    const t = (type || 'IMAGE').toUpperCase();

    if (t === 'VIDEO') {
        return (
            <video
                src={url}
                controls
                className="mb-1.5 max-h-64 w-full rounded-md bg-black/5"
            />
        );
    }

    if (t === 'DOCUMENT') {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-1.5 flex items-center gap-1.5 rounded-md bg-black/5 px-2 py-1.5 text-caption text-blue-600 hover:underline"
            >
                <FileText size={14} /> View document
            </a>
        );
    }

    // IMAGE (default) — clickable to open full size; hides itself if the URL is dead/expired.
    return (
        <a href={url} target="_blank" rel="noopener noreferrer">
            <img
                src={url}
                alt="attachment"
                loading="lazy"
                onError={(e) => {
                    const anchor = e.currentTarget.closest('a');
                    if (anchor) anchor.style.display = 'none';
                }}
                className="mb-1.5 max-h-64 w-full rounded-md bg-black/5 object-contain"
            />
        </a>
    );
}
