import { useEffect, useRef, useState } from 'react';
import {
    EnvelopeSimple,
    ArrowUp,
    ArrowBendUpLeft,
    ArrowLeft,
    PaperPlaneTilt,
    ArrowFatDown,
} from '@phosphor-icons/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { EmailMessage } from '../../-services/email-inbox-api';

interface Props {
    selectedEmail: string | null;
    counterpartyName?: string;
    messages: EmailMessage[];
    loading: boolean;
    hasMore: boolean;
    onLoadOlder: () => void;
    /** Triggers the reply dialog. Hidden when not provided. */
    onReply?: () => void;
    /** Mobile-only: returns to the conversation list. */
    onBack?: () => void;
}

export function EmailThread({
    selectedEmail,
    counterpartyName,
    messages,
    loading,
    hasMore,
    onLoadOlder,
    onReply,
    onBack,
}: Props) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    if (!selectedEmail) {
        return <EmptyThread />;
    }

    const display = counterpartyName || selectedEmail;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-muted/30">
            <ThreadHeader
                display={display}
                email={selectedEmail}
                hasName={!!counterpartyName}
                onReply={onReply}
                onBack={onBack}
            />

            <ScrollArea className="flex-1">
                <div className="px-4 py-4 space-y-3">
                    {hasMore && (
                        <div className="flex justify-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onLoadOlder}
                                className="h-7 text-xs gap-1"
                            >
                                <ArrowUp size={12} /> Load older messages
                            </Button>
                        </div>
                    )}

                    {loading && messages.length === 0 ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-16 rounded-lg" />
                            ))}
                        </div>
                    ) : messages.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-8">
                            No messages in this conversation
                        </p>
                    ) : (
                        messages.map((m) => <MessageBubble key={m.id || m.timestamp} msg={m} />)
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
        </div>
    );
}

function ThreadHeader({
    display,
    email,
    hasName,
    onReply,
    onBack,
}: {
    display: string;
    email: string;
    hasName: boolean;
    onReply?: () => void;
    onBack?: () => void;
}) {
    return (
        <header className="px-4 py-3 border-b bg-background shrink-0 flex items-center gap-3">
            {onBack && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="md:hidden h-8 w-8 -ml-1 shrink-0"
                    title="Back to conversations"
                >
                    <ArrowLeft size={18} />
                </Button>
            )}
            <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="text-xs font-medium bg-muted text-muted-foreground">
                    {getInitials(display)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{display}</p>
                {hasName && (
                    <p className="text-xs text-muted-foreground truncate">{email}</p>
                )}
            </div>
            {onReply && (
                <Button
                    onClick={onReply}
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    title="Reply"
                >
                    <ArrowBendUpLeft size={14} weight="bold" />
                    Reply
                </Button>
            )}
        </header>
    );
}

function MessageBubble({ msg }: { msg: EmailMessage }) {
    const [open, setOpen] = useState(false);
    const outgoing = msg.direction === 'OUTGOING';

    return (
        <div className={cn('flex', outgoing ? 'justify-end' : 'justify-start')}>
            <Collapsible
                open={open}
                onOpenChange={setOpen}
                className={cn(
                    'max-w-[78%] rounded-lg border bg-card shadow-sm transition-shadow hover:shadow',
                    outgoing
                        ? 'border-primary/20 bg-primary/5'
                        : 'border-emerald-200/60 bg-emerald-50/30'
                )}
            >
                <CollapsibleTrigger asChild>
                    <button className="w-full text-left px-3 py-2.5 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <DirectionBadge outgoing={outgoing} />
                            {msg.subject && (
                                <p className="text-sm font-medium text-foreground truncate flex-1">
                                    {msg.subject}
                                </p>
                            )}
                        </div>
                        {!open && (
                            <p className="text-xs text-muted-foreground line-clamp-2 pl-0.5">
                                {msg.bodyPreview || '—'}
                            </p>
                        )}
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 pl-0.5">
                            <span>{formatFullTime(msg.timestamp)}</span>
                            {outgoing && msg.instituteAddress && (
                                <>
                                    <Separator orientation="vertical" className="h-2.5" />
                                    <span className="truncate">from {msg.instituteAddress}</span>
                                </>
                            )}
                            {msg.source && (
                                <>
                                    <Separator orientation="vertical" className="h-2.5" />
                                    <span className="truncate uppercase tracking-wide">
                                        {msg.source}
                                    </span>
                                </>
                            )}
                        </div>
                    </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    {msg.body && (
                        <>
                            <Separator />
                            <div className="px-3 py-2">
                                {outgoing ? (
                                    <iframe
                                        title={`email-${msg.id || msg.timestamp}`}
                                        className="w-full bg-background rounded border"
                                        // Tall enough that most marketing/transactional emails render in full
                                        // without an internal scrollbar after the zoom-to-fit CSS is applied.
                                        style={{ height: 520 }}
                                        sandbox=""
                                        srcDoc={buildEmailSrcDoc(msg.body)}
                                    />
                                ) : (
                                    <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                                        {msg.body}
                                    </pre>
                                )}
                            </div>
                        </>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

function DirectionBadge({ outgoing }: { outgoing: boolean }) {
    return outgoing ? (
        <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] gap-1 bg-primary/10 text-primary hover:bg-primary/10"
        >
            <PaperPlaneTilt size={10} weight="fill" /> Sent
        </Badge>
    ) : (
        <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
        >
            <ArrowFatDown size={10} weight="fill" /> Received
        </Badge>
    );
}

function EmptyThread() {
    return (
        <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center text-muted-foreground">
                <EnvelopeSimple size={56} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Select an email conversation</p>
                <p className="text-xs mt-1 opacity-70">
                    Click any row on the left to view its thread
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

/**
 * Wrap raw outbound email HTML in a document that fits the iframe width without forcing
 * the admin to scroll horizontally. We inject a stylesheet that:
 *  - Constrains images/tables/videos to 100% width (most marketing emails fix table widths
 *    to 600px, which overflows our ~400px-wide thread column).
 *  - Uses {@code zoom: 0.78} to shrink the rendered page so it fits within the iframe
 *    while preserving the email's intended proportions. {@code zoom} is supported in
 *    Chromium/WebKit and now Firefox 126+.
 *  - Adds {@code word-break} so long unbreakable strings (URLs) wrap rather than overflow.
 */
function buildEmailSrcDoc(html: string): string {
    if (!html) return '';
    // If the email already has a full <html> document, just inject our scaling stylesheet
    // into <head>. Otherwise wrap the snippet in a minimal document shell.
    const styleTag = `<style>
        html, body { margin: 0; padding: 8px; background: #ffffff; }
        body {
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
            font-size: 13px;
            color: #1f2937;
            line-height: 1.45;
            overflow-x: hidden;
            overflow-wrap: break-word;
            word-break: break-word;
            zoom: 0.78;
        }
        img, video, iframe { max-width: 100% !important; height: auto !important; }
        table, td, tr { max-width: 100% !important; }
        table { width: 100% !important; }
        * { box-sizing: border-box; }
        a { color: #2563eb; }
    </style>`;
    const meta = `<meta name="viewport" content="width=device-width, initial-scale=1">`;

    const hasHtmlTag = /<html[\s>]/i.test(html);
    if (hasHtmlTag) {
        // Inject the style + meta into <head> (or create one).
        if (/<head[\s>]/i.test(html)) {
            return html.replace(/<head([^>]*)>/i, `<head$1>${meta}${styleTag}`);
        }
        return html.replace(/<html([^>]*)>/i, `<html$1><head>${meta}${styleTag}</head>`);
    }
    return `<!doctype html><html><head>${meta}${styleTag}</head><body>${html}</body></html>`;
}

function formatFullTime(timestamp: string): string {
    try {
        const d = new Date(timestamp);
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return timestamp;
    }
}
