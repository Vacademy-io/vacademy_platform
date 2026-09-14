import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    EnvelopeSimple,
    ArrowUp,
    ArrowBendUpLeft,
    ArrowLeft,
    PaperPlaneTilt,
    ArrowFatDown,
    Warning,
    CaretDown,
    CaretUp,
} from '@phosphor-icons/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
import { groupMessagesByDay } from '../../../inbox/-utils/day-labels';
import { isSystemMessage, resolveOrigin, splitQuotedReply } from '../../-utils/email-text';

/** Bounce bodies longer than this start collapsed behind "Show details". */
const BOUNCE_DETAILS_COLLAPSE_AT = 300;

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
    /** The counterparty is a mail-system sender (bounce daemon) — replying is pointless. */
    system?: boolean;
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
    system = false,
}: Props) {
    // communicationDayLabels feeds formatDayLabel() ("Today" / "Yesterday") through the i18next
    // singleton; binding it here makes the hook re-render once that catalog lands.
    const { t } = useTranslation(['communicationEmailThread', 'communicationDayLabels']);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    if (!selectedEmail) {
        return <EmptyThread />;
    }

    const display = counterpartyName || latestCounterpartyName(messages) || selectedEmail;
    // Not memoised on purpose: the day labels read the lazily loaded catalog at call time, and a
    // memo keyed only on `messages` would freeze raw keys from the first render.
    const dayGroups = groupMessagesByDay(messages);

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-muted/30">
            <ThreadHeader
                display={display}
                email={selectedEmail}
                hasName={display !== selectedEmail}
                viaAddress={latestInstituteAddress(messages)}
                system={system}
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
                                <ArrowUp size={12} /> {t('loadOlderMessages')}
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
                            {t('noMessages')}
                        </p>
                    ) : (
                        dayGroups.map((group) => (
                            <div key={group.key || 'undated'} className="space-y-3">
                                {group.label && <DaySeparator label={group.label} />}
                                {group.messages.map((m) => (
                                    <MessageBubble key={m.id || m.timestamp} msg={m} />
                                ))}
                            </div>
                        ))
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
    viaAddress,
    system,
    onReply,
    onBack,
}: {
    display: string;
    email: string;
    hasName: boolean;
    viaAddress?: string;
    system: boolean;
    onReply?: () => void;
    onBack?: () => void;
}) {
    const { t } = useTranslation('communicationEmailThread');
    return (
        <header className="px-4 py-3 border-b bg-background shrink-0 flex items-center gap-3">
            {onBack && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="md:hidden h-8 w-8 -ml-1 shrink-0"
                    title={t('backToConversations')}
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
                {viaAddress && (
                    <p className="text-2xs text-muted-foreground truncate">
                        {t('viaAddress', { address: viaAddress })}
                    </p>
                )}
            </div>
            {system && !onReply && (
                <span className="text-xs text-muted-foreground italic text-right max-w-xs">
                    {t('automatedSender')}
                </span>
            )}
            {onReply && (
                <Button
                    onClick={onReply}
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    title={t('reply')}
                >
                    <ArrowBendUpLeft size={14} weight="bold" />
                    {t('reply')}
                </Button>
            )}
        </header>
    );
}

function DaySeparator({ label }: { label: string }) {
    return (
        <div className="flex justify-center py-1">
            <span className="rounded-full border bg-background px-3 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground shadow-sm">
                {label}
            </span>
        </div>
    );
}

function MessageBubble({ msg }: { msg: EmailMessage }) {
    if (isSystemMessage(msg)) return <BounceBubble msg={msg} />;
    return msg.direction === 'OUTGOING' ? (
        <OutgoingBubble msg={msg} />
    ) : (
        <IncomingBubble msg={msg} />
    );
}

/**
 * Something WE sent. Right-aligned in the brand tint so it reads as "ours" at a glance, with the
 * subject as the headline and the raw HTML kept behind an explicit "Open email" button (the card
 * itself is not a button, so the admin can select and copy text from it).
 */
function OutgoingBubble({ msg }: { msg: EmailMessage }) {
    const { t, i18n } = useTranslation('communicationEmailThread');
    const [open, setOpen] = useState(false);
    const origin = resolveOrigin(msg);

    return (
        <div className="flex justify-end">
            <Collapsible
                open={open}
                onOpenChange={setOpen}
                className={cn(
                    'max-w-[78%] min-w-0 rounded-lg rounded-tr-sm border border-primary/20 bg-primary/10 shadow-sm',
                    open && 'w-full'
                )}
            >
                <div className="px-3 py-2.5 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            <PaperPlaneTilt size={11} weight="fill" className="text-primary" />
                            {t('you')}
                        </span>
                        {msg.instituteAddress && (
                            <span className="truncate">
                                · {t('fromAddress', { address: msg.instituteAddress })}
                            </span>
                        )}
                        <OriginChip label={t(`origin.${origin}`)} tone="primary" />
                    </div>
                    <SubjectLine subject={msg.subject} t={t} />
                    {!open && msg.bodyPreview && (
                        <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                            {msg.bodyPreview}
                        </p>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-2xs text-muted-foreground">
                            {formatFullTime(msg.timestamp, i18n.language)}
                        </span>
                        {msg.body && (
                            <CollapsibleTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-2xs gap-1 text-primary hover:text-primary"
                                >
                                    {open ? <CaretUp size={11} /> : <CaretDown size={11} />}
                                    {open ? t('collapseEmail') : t('openEmail')}
                                </Button>
                            </CollapsibleTrigger>
                        )}
                    </div>
                </div>

                <CollapsibleContent>
                    {msg.body && (
                        <>
                            <Separator />
                            <div className="px-3 py-2">
                                <iframe
                                    title={`email-${msg.id || msg.timestamp}`}
                                    className="w-full bg-background rounded border"
                                    // Tall enough that most marketing/transactional emails render in full
                                    // without an internal scrollbar after the zoom-to-fit CSS is applied.
                                    style={{ height: 520 }}
                                    sandbox=""
                                    srcDoc={buildEmailSrcDoc(msg.body)}
                                />
                            </div>
                        </>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

/**
 * Something a person sent us. Left-aligned on a plain card with a green accent; the text they
 * typed is always visible and the quoted chain their mail client appended sits behind a toggle.
 */
function IncomingBubble({ msg }: { msg: EmailMessage }) {
    const { t, i18n } = useTranslation('communicationEmailThread');
    const [showQuoted, setShowQuoted] = useState(false);
    const origin = resolveOrigin(msg);
    const who = msg.counterpartyName || msg.counterpartyEmail;
    const { main, quoted, quotedLineCount } = splitQuotedReply(msg.body || msg.bodyPreview || '');

    return (
        <div className="flex justify-start">
            <div className="max-w-[78%] min-w-0 rounded-lg rounded-tl-sm border border-l-2 border-l-emerald-400 bg-card shadow-sm px-3 py-2.5 space-y-1">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-muted-foreground">
                    <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="text-2xs font-medium bg-emerald-100 text-emerald-700">
                            {getInitials(who)}
                        </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-foreground truncate">{who}</span>
                    <OriginChip
                        label={t(origin === 'REPLY' ? 'origin.REPLY' : 'origin.INCOMING')}
                        tone="emerald"
                    />
                </div>
                <SubjectLine subject={msg.subject} t={t} />
                <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {main || '—'}
                </p>
                {quoted && (
                    <div className="pt-0.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowQuoted((v) => !v)}
                            className="h-6 px-1.5 text-2xs gap-1 text-muted-foreground"
                        >
                            {showQuoted ? <CaretUp size={11} /> : <CaretDown size={11} />}
                            {showQuoted
                                ? t('hideQuotedText')
                                : t('showQuotedText', { count: quotedLineCount })}
                        </Button>
                        {showQuoted && (
                            <pre className="mt-1 border-l-2 border-muted-foreground/30 pl-2 text-xs text-muted-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
                                {quoted}
                            </pre>
                        )}
                    </div>
                )}
                <p className="text-2xs text-muted-foreground pt-0.5">
                    {formatFullTime(msg.timestamp, i18n.language)}
                </p>
            </div>
        </div>
    );
}

/**
 * A bounce / mail-system notice. Amber so it never reads as a person writing to us, and with the
 * daemon's long diagnostic text tucked behind "Show details".
 */
function BounceBubble({ msg }: { msg: EmailMessage }) {
    const { t, i18n } = useTranslation('communicationEmailThread');
    const [showDetails, setShowDetails] = useState(false);
    const details = (msg.body || msg.bodyPreview || '').trim();
    const long = details.length > BOUNCE_DETAILS_COLLAPSE_AT;

    return (
        <div className="flex justify-start">
            <div className="max-w-[78%] min-w-0 rounded-lg rounded-tl-sm border border-amber-200 bg-amber-50 shadow-sm px-3 py-2.5 space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                    <Warning size={16} weight="fill" className="text-amber-600 shrink-0" />
                    {t('deliveryFailed')}
                </p>
                <p className="text-xs text-amber-700">{t('deliveryFailedHint')}</p>
                {msg.subject && (
                    <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                )}
                {details && (
                    <div className="pt-0.5">
                        {long && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDetails((v) => !v)}
                                className="h-6 px-1.5 text-2xs gap-1 text-amber-700 hover:text-amber-800"
                            >
                                {showDetails ? <CaretUp size={11} /> : <CaretDown size={11} />}
                                {showDetails ? t('hideDetails') : t('showDetails')}
                            </Button>
                        )}
                        {(!long || showDetails) && (
                            <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
                                {details}
                            </pre>
                        )}
                    </div>
                )}
                <p className="text-2xs text-muted-foreground pt-0.5">
                    {formatFullTime(msg.timestamp, i18n.language)}
                </p>
            </div>
        </div>
    );
}

function SubjectLine({ subject, t }: { subject?: string; t: TFunction }) {
    return subject ? (
        <p className="text-sm font-medium text-foreground break-words">{subject}</p>
    ) : (
        <p className="text-sm text-muted-foreground italic">{t('noSubject')}</p>
    );
}

function OriginChip({ label, tone }: { label: string; tone: 'primary' | 'emerald' }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-px text-2xs font-medium',
                tone === 'primary'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-emerald-100 text-emerald-700'
            )}
        >
            {tone === 'emerald' && <ArrowFatDown size={9} weight="fill" />}
            {label}
        </span>
    );
}

/** The institute address the newest message went out from / came in to — for the header. */
function latestInstituteAddress(messages: EmailMessage[]): string | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
        const address = messages[i]?.instituteAddress;
        if (address) return address;
    }
    return undefined;
}

/** The counterparty's display name as the newest inbound message reported it. */
function latestCounterpartyName(messages: EmailMessage[]): string | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
        const name = messages[i]?.counterpartyName;
        if (name) return name;
    }
    return undefined;
}

function EmptyThread() {
    const { t } = useTranslation('communicationEmailThread');
    return (
        <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center text-muted-foreground">
                <EnvelopeSimple size={56} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">{t('selectConversation')}</p>
                <p className="text-xs mt-1 opacity-70">
                    {t('selectConversationHint')}
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

function formatFullTime(timestamp: string, locale: string): string {
    try {
        const d = new Date(timestamp);
        return d.toLocaleString(locale, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return timestamp;
    }
}
