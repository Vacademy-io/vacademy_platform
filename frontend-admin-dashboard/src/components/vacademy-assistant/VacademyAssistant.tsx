import { useEffect, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import {
    ArrowClockwise,
    ChatCircleDots,
    PaperPlaneRight,
    Sparkle,
    SpinnerGap,
    Warning,
    X,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { getTokenFromCookie, isTokenExpired } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useVacademyAssistant } from './useVacademyAssistant';
import type { AssistantMessage } from './types';

// Routes where no authenticated shell exists — the widget must stay hidden even
// if a stale token lingers. Mirrors the public routes in routes/__root.tsx.
const PUBLIC_PREFIXES = [
    '/login',
    '/signup',
    '/landing',
    '/pricing',
    '/content',
    '/evaluator-ai',
    '/vim/onboarding',
    '/vim/login',
    '/vim/waitlist',
];

const SUGGESTIONS = [
    'How do I create a course?',
    'Where do I add a learner to a batch?',
    'How do I invite a team member?',
];

export function VacademyAssistant() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const { messages, status, error, sendMessage, reset } = useVacademyAssistant();
    const scrollEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, status]);

    const token = getTokenFromCookie(TokenKey.accessToken);
    const isAuthed = !!token && !isTokenExpired(token);
    const onPublicRoute = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isAuthed || onPublicRoute) return null;

    const isBusy = status === 'connecting' || status === 'streaming';
    const lastMessage = messages[messages.length - 1];
    const awaitingFirstToken =
        status === 'connecting' ||
        (status === 'streaming' && (!lastMessage || lastMessage.role === 'user'));

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isBusy) return;
        sendMessage(input.trim());
        setInput('');
    };

    const handleSuggestion = (text: string) => {
        if (isBusy) return;
        sendMessage(text);
    };

    if (!open) {
        return (
            <button
                type="button"
                aria-label="Open Vacademy Assistant"
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-colors hover:bg-primary-600"
            >
                <Sparkle size={26} weight="fill" />
            </button>
        );
    }

    return (
        <div className="fixed inset-x-4 bottom-6 top-20 z-50 flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl sm:inset-x-auto sm:right-6 sm:top-24 sm:w-96">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-primary-500 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
                        <Sparkle size={18} weight="fill" />
                    </div>
                    <div>
                        <p className="text-body font-semibold leading-tight">Vacademy Assistant</p>
                        <p className="text-caption text-white/80">
                            {isBusy ? 'Thinking…' : 'Here to help'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {messages.length > 0 && (
                        <button
                            type="button"
                            aria-label="Start a new chat"
                            onClick={reset}
                            className="flex size-8 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/20"
                        >
                            <ArrowClockwise size={18} />
                        </button>
                    )}
                    <button
                        type="button"
                        aria-label="Close assistant"
                        onClick={() => setOpen(false)}
                        className="flex size-8 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/20"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-3 p-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <div className="flex size-12 items-center justify-center rounded-full bg-primary-50">
                                <ChatCircleDots
                                    size={26}
                                    weight="duotone"
                                    className="text-primary-500"
                                />
                            </div>
                            <p className="text-body font-semibold text-neutral-700">
                                Hi! How can I help?
                            </p>
                            <p className="text-caption text-neutral-500">
                                Ask me how or where to do anything in Vacademy.
                            </p>
                            <div className="mt-1 flex flex-col gap-2">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => handleSuggestion(s)}
                                        className="rounded-md border border-neutral-200 px-3 py-2 text-caption text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                    ))}

                    {awaitingFirstToken && (
                        <div className="flex items-center gap-2 py-1 text-neutral-500">
                            <SpinnerGap size={18} className="animate-spin text-primary-500" />
                            <span className="text-caption">Looking that up…</span>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 px-3 py-2">
                            <Warning size={18} className="mt-0.5 shrink-0 text-danger-500" />
                            <span className="text-caption text-danger-700">{error}</span>
                        </div>
                    )}

                    <div ref={scrollEndRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <form
                onSubmit={handleSend}
                className="flex shrink-0 items-center gap-2 border-t border-neutral-200 p-3"
            >
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask the assistant…"
                    className="flex-1"
                />
                <MyButton
                    type="submit"
                    buttonType="primary"
                    scale="medium"
                    layoutVariant="icon"
                    disable={!input.trim() || isBusy}
                    aria-label="Send message"
                >
                    <PaperPlaneRight size={18} weight="fill" />
                </MyButton>
            </form>
        </div>
    );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
    const isUser = message.role === 'user';
    return (
        <div className={cn('flex', isUser ? 'justify-end pl-8' : 'justify-start pr-8')}>
            <div
                className={cn(
                    'w-fit whitespace-pre-wrap rounded-lg px-3 py-2 text-body',
                    isUser
                        ? 'bg-primary-500 text-white'
                        : 'border border-neutral-200 bg-neutral-50 text-neutral-800'
                )}
            >
                {message.content}
                {message.streaming && !message.content && (
                    <span className="text-neutral-400">…</span>
                )}
            </div>
        </div>
    );
}
