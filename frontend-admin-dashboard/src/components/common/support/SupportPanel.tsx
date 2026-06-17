import React, { useRef, useState } from 'react';
import {
    ArrowSquareOut,
    CaretLeft,
    ChatCircleDots,
    CheckCircle,
    CircleNotch,
    Clock,
    DiscordLogo,
    EnvelopeSimple,
    Paperclip,
    PaperPlaneTilt,
    Plus,
    Star,
    Warning,
    WhatsappLogo,
    X,
} from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { cn, goToMailSupport, goToWhatsappSupport } from '@/lib/utils';
import { toast } from 'sonner';
import {
    ACCEPTED_ATTACHMENT_TYPES,
    checkAttachment,
    uploadSupportAttachment,
    useCreateTicket,
    useMyTickets,
    useReplyToTicket,
    useSetTicketStatus,
    useSupportConfig,
    useTicket,
    type SupportAttachment,
    type SupportMessageDto,
    type SupportTicketDto,
    type TicketCategory,
    type TicketPriority,
    type TicketStatus,
} from '@/services/support';

const DISCORD_URL = 'https://discord.gg/6WAnpqbsU';
const TRUSTPILOT_URL = 'https://www.trustpilot.com/review/vacademy.io';

const STATUS_META: Record<TicketStatus, { label: string; cls: string }> = {
    OPEN: { label: 'Open', cls: 'bg-warning-50 text-warning-700 border-warning-100' },
    IN_PROGRESS: { label: 'In progress', cls: 'bg-info-50 text-info-700 border-info-100' },
    WAITING_ON_CUSTOMER: {
        label: 'Your reply needed',
        cls: 'bg-info-50 text-info-700 border-info-100',
    },
    RESOLVED: { label: 'Resolved', cls: 'bg-success-50 text-success-700 border-success-100' },
    CLOSED: { label: 'Closed', cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
};
const PRIORITY_META: Record<TicketPriority, { label: string; cls: string }> = {
    MAJOR: { label: 'Major', cls: 'bg-danger-50 text-danger-700 border-danger-100' },
    MINOR: { label: 'Minor', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
};
const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
    { value: 'QUESTION', label: 'Question / how-to' },
    { value: 'BUG', label: 'Something is broken' },
    { value: 'BILLING', label: 'Billing' },
    { value: 'FEATURE_REQUEST', label: 'Feature request' },
    { value: 'OTHER', label: 'Other' },
];

function fmt(date: string | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function Chip({ label, cls }: { label: string; cls: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
                cls
            )}
        >
            {label}
        </span>
    );
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|avi|mkv|m4v|ogv)$/i;

function AttachmentInput({
    value,
    onChange,
}: {
    value: SupportAttachment[];
    onChange: (next: SupportAttachment[]) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        const added: SupportAttachment[] = [];
        for (const file of Array.from(files)) {
            const check = checkAttachment(file);
            if (!check.ok) {
                toast.error(check.reason ?? 'Unsupported file.');
                continue;
            }
            try {
                added.push(await uploadSupportAttachment(file));
            } catch {
                toast.error(`Could not upload ${file.name}.`);
            }
        }
        if (added.length) onChange([...value, ...added]);
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="flex flex-col gap-2">
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_ATTACHMENT_TYPES}
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
            />
            <MyButton
                type="button"
                buttonType="secondary"
                scale="small"
                onClick={() => inputRef.current?.click()}
                disable={uploading}
            >
                {uploading ? (
                    <CircleNotch size={15} className="animate-spin" />
                ) : (
                    <Paperclip size={15} />
                )}
                Attach image / video
            </MyButton>
            {value.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {value.map((a, i) => (
                        <span
                            key={a.fileId || i}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600"
                        >
                            <Paperclip size={12} />
                            {a.fileName || 'attachment'}
                            <button
                                type="button"
                                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                                className="text-neutral-400 hover:text-danger-600"
                                aria-label="Remove attachment"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            ) : null}
            <p className="text-xs text-neutral-400">Images &amp; videos, up to 50 MB each.</p>
        </div>
    );
}

function AttachmentView({ attachment }: { attachment: SupportAttachment }) {
    const name = attachment.fileName ?? '';
    // Only trust http(s) URLs — never render javascript:/data: into href/src.
    const url = /^https?:\/\//i.test(attachment.url ?? '') ? (attachment.url as string) : '';
    if (!url) {
        return name ? <span className="text-xs text-neutral-400">{name}</span> : null;
    }
    if (IMAGE_EXT.test(name)) {
        return (
            <a href={url} target="_blank" rel="noreferrer">
                <img
                    src={url}
                    alt={name}
                    className="max-h-40 rounded-md border border-neutral-200"
                />
            </a>
        );
    }
    if (VIDEO_EXT.test(name)) {
        return (
            <video src={url} controls className="max-h-40 rounded-md border border-neutral-200" />
        );
    }
    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs underline"
        >
            <Paperclip size={12} /> {name || 'attachment'}
        </a>
    );
}

type View = { name: 'home' } | { name: 'new' } | { name: 'thread'; id: string };

export function SupportPanel({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const [view, setView] = useState<View>({ name: 'home' });

    // Reset to home whenever the panel is freshly opened.
    React.useEffect(() => {
        if (open) setView({ name: 'home' });
    }, [open]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                <SheetHeader className="border-b border-neutral-200 px-4 py-3">
                    <SheetTitle className="flex items-center gap-2 text-neutral-700">
                        {view.name !== 'home' && (
                            <button
                                type="button"
                                onClick={() => setView({ name: 'home' })}
                                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                                aria-label="Back"
                            >
                                <CaretLeft size={18} />
                            </button>
                        )}
                        <ChatCircleDots size={20} className="text-primary-500" />
                        {view.name === 'new'
                            ? 'New issue'
                            : view.name === 'thread'
                              ? 'Conversation'
                              : 'Support'}
                    </SheetTitle>
                </SheetHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {view.name === 'home' && (
                        <HomeView
                            onNew={() => setView({ name: 'new' })}
                            onOpenTicket={(id) => setView({ name: 'thread', id })}
                        />
                    )}
                    {view.name === 'new' && (
                        <NewIssueView
                            onCreated={(id) => setView({ name: 'thread', id })}
                            onCancel={() => setView({ name: 'home' })}
                        />
                    )}
                    {view.name === 'thread' && <ThreadView ticketId={view.id} />}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function HomeView({
    onNew,
    onOpenTicket,
}: {
    onNew: () => void;
    onOpenTicket: (id: string) => void;
}) {
    const config = useSupportConfig();
    const tickets = useMyTickets();
    const plan = config.data?.plan;

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* Plan card */}
            <div className="rounded-lg border border-primary-100 bg-primary-50 p-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-700">
                        Your support plan
                    </span>
                    {plan ? (
                        <Chip
                            label={plan.displayName}
                            cls="bg-white text-primary-600 border-primary-100"
                        />
                    ) : null}
                </div>
                {plan ? (
                    <>
                        <p className="mt-1 text-xs text-neutral-600">{plan.description}</p>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-neutral-600">
                            <span className="flex items-center gap-1">
                                <Clock size={13} /> {plan.hoursOfOperation}
                            </span>
                            <span>
                                Major issues: <strong>{plan.majorSlaText}</strong> · Minor:{' '}
                                <strong>{plan.minorSlaText}</strong>
                            </span>
                            {config.data?.dedicatedEngineerNames?.length ? (
                                <span className="flex items-center gap-1 text-primary-600">
                                    <Star size={13} weight="fill" /> Dedicated:{' '}
                                    {config.data.dedicatedEngineerNames.join(', ')}
                                </span>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <p className="mt-1 text-xs text-neutral-500">Loading your plan…</p>
                )}
            </div>

            {/* Primary actions */}
            <MyButton buttonType="primary" scale="medium" className="w-full" onClick={onNew}>
                <Plus size={16} /> Raise a new issue
            </MyButton>
            <div className="grid grid-cols-2 gap-2">
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    className="w-full"
                    onClick={goToWhatsappSupport}
                >
                    <WhatsappLogo size={16} /> WhatsApp
                </MyButton>
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    className="w-full"
                    onClick={goToMailSupport}
                >
                    <EnvelopeSimple size={16} /> Mail us
                </MyButton>
            </div>

            {/* My issues */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-700">My issues</span>
                    {config.data?.openTicketCount ? (
                        <span className="text-xs text-neutral-500">
                            {config.data.openTicketCount} open
                        </span>
                    ) : null}
                </div>
                <div className="flex flex-col gap-2">
                    {tickets.isLoading ? (
                        <p className="py-4 text-center text-xs text-neutral-400">Loading…</p>
                    ) : (tickets.data?.content?.length ?? 0) === 0 ? (
                        <p className="rounded-md border border-dashed border-neutral-200 py-6 text-center text-xs text-neutral-400">
                            No issues yet. Raise one and we will help you out.
                        </p>
                    ) : (
                        tickets.data!.content.map((t) => (
                            <TicketRow key={t.id} ticket={t} onClick={() => onOpenTicket(t.id)} />
                        ))
                    )}
                </div>
            </div>

            {/* Footer: community + rating */}
            <div className="mt-2 flex flex-col gap-2 border-t border-neutral-200 pt-4">
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    className="w-full"
                    onClick={() => window.open(DISCORD_URL, '_blank', 'noopener')}
                >
                    <DiscordLogo size={16} /> Join our Discord community
                </MyButton>
                <MyButton
                    buttonType="text"
                    scale="medium"
                    className="w-full"
                    onClick={() => window.open(TRUSTPILOT_URL, '_blank', 'noopener')}
                >
                    <Star size={16} weight="fill" /> Rate us on Trustpilot
                    <ArrowSquareOut size={14} />
                </MyButton>
            </div>
        </div>
    );
}

function TicketRow({ ticket, onClick }: { ticket: SupportTicketDto; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full flex-col gap-1 rounded-md border border-neutral-200 p-2 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-neutral-700">
                    {ticket.subject}
                </span>
                <span className="shrink-0 text-xs text-neutral-400">
                    {fmt(ticket.lastMessageAt)}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
                <Chip
                    label={STATUS_META[ticket.status].label}
                    cls={STATUS_META[ticket.status].cls}
                />
                <Chip
                    label={PRIORITY_META[ticket.priority].label}
                    cls={PRIORITY_META[ticket.priority].cls}
                />
            </div>
        </button>
    );
}

function NewIssueView({
    onCreated,
    onCancel,
}: {
    onCreated: (id: string) => void;
    onCancel: () => void;
}) {
    const create = useCreateTicket();
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState<TicketCategory>('QUESTION');
    const [priority, setPriority] = useState<TicketPriority>('MINOR');
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<SupportAttachment[]>([]);

    const submit = async () => {
        if (!subject.trim() || !message.trim()) {
            toast.error('Please add a subject and a description.');
            return;
        }
        try {
            const ticket = await create.mutateAsync({
                subject: subject.trim(),
                category,
                priority,
                message: message.trim(),
                attachments,
            });
            toast.success('Issue raised — our team has been notified.');
            onCreated(ticket.id);
        } catch {
            toast.error('Could not raise the issue. Please try again.');
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4">
            <MyInput
                inputType="text"
                label="Subject"
                required
                inputPlaceholder="Brief summary of the issue"
                input={subject}
                onChangeFunction={(e) => setSubject((e.target as HTMLInputElement).value)}
                className="w-full"
            />

            <div className="flex flex-col gap-1.5">
                <span className="text-subtitle font-regular text-neutral-600">Category</span>
                <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CATEGORY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-subtitle font-regular text-neutral-600">Priority</span>
                <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="MINOR">Minor — not blocking</SelectItem>
                        <SelectItem value="MAJOR">Major — blocking / urgent</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-subtitle font-regular text-neutral-600">Description</span>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Tell us what's happening, with steps if you can."
                    className="w-full resize-none rounded-md border border-neutral-300 bg-white p-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none"
                />
            </div>

            <AttachmentInput value={attachments} onChange={setAttachments} />

            <div className="flex items-center justify-end gap-2">
                <MyButton buttonType="secondary" scale="medium" onClick={onCancel}>
                    Cancel
                </MyButton>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={submit}
                    disable={create.isPending}
                >
                    {create.isPending ? (
                        <CircleNotch size={16} className="animate-spin" />
                    ) : (
                        <PaperPlaneTilt size={16} />
                    )}
                    Submit
                </MyButton>
            </div>
        </div>
    );
}

function ThreadView({ ticketId }: { ticketId: string }) {
    const { data: ticket, isLoading } = useTicket(ticketId);
    const reply = useReplyToTicket();
    const setStatus = useSetTicketStatus();
    const [draft, setDraft] = useState('');
    const [draftFiles, setDraftFiles] = useState<SupportAttachment[]>([]);

    if (isLoading || !ticket) {
        return (
            <div className="flex items-center justify-center py-10">
                <CircleNotch size={24} className="animate-spin text-neutral-400" />
            </div>
        );
    }

    const send = async () => {
        if (!draft.trim() && draftFiles.length === 0) return;
        try {
            await reply.mutateAsync({
                id: ticket.id,
                body: draft.trim() || 'Shared an attachment.',
                attachments: draftFiles,
            });
            setDraft('');
            setDraftFiles([]);
        } catch {
            toast.error('Could not send your reply.');
        }
    };

    const resolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

    return (
        <div className="flex h-full flex-col">
            {/* Ticket header */}
            <div className="border-b border-neutral-200 p-4">
                <h3 className="text-sm font-semibold text-neutral-700">{ticket.subject}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Chip
                        label={STATUS_META[ticket.status].label}
                        cls={STATUS_META[ticket.status].cls}
                    />
                    <Chip
                        label={PRIORITY_META[ticket.priority].label}
                        cls={PRIORITY_META[ticket.priority].cls}
                    />
                </div>
                <div className="mt-2 text-xs">
                    {ticket.firstRespondedAt ? (
                        <span className="flex items-center gap-1 text-success-600">
                            <CheckCircle size={13} /> First responded {fmt(ticket.firstRespondedAt)}
                        </span>
                    ) : ticket.firstResponseDueAt ? (
                        <span
                            className={cn(
                                'flex items-center gap-1',
                                ticket.overdue ? 'text-danger-600' : 'text-neutral-500'
                            )}
                        >
                            {ticket.overdue ? <Warning size={13} /> : <Clock size={13} />}
                            We will respond by {fmt(ticket.firstResponseDueAt)}
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-4">
                {(ticket.messages ?? []).map((m) => (
                    <Bubble key={m.id} message={m} />
                ))}
            </div>

            {/* Composer */}
            <div className="border-t border-neutral-200 p-3">
                {resolved ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-center text-xs text-neutral-500">
                            This issue is {STATUS_META[ticket.status].label.toLowerCase()}.
                        </p>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            className="w-full"
                            onClick={() => setStatus.mutate({ id: ticket.id, status: 'OPEN' })}
                        >
                            Reopen issue
                        </MyButton>
                    </div>
                ) : (
                    <>
                        <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={3}
                            placeholder="Write a reply…"
                            className="w-full resize-none rounded-md border border-neutral-300 bg-white p-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
                            }}
                        />
                        <div className="mt-2">
                            <AttachmentInput value={draftFiles} onChange={setDraftFiles} />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() =>
                                    setStatus.mutate({ id: ticket.id, status: 'RESOLVED' })
                                }
                            >
                                <CheckCircle size={15} /> Mark resolved
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onClick={send}
                                disable={
                                    (!draft.trim() && draftFiles.length === 0) || reply.isPending
                                }
                            >
                                {reply.isPending ? (
                                    <CircleNotch size={15} className="animate-spin" />
                                ) : (
                                    <PaperPlaneTilt size={15} />
                                )}
                                Send
                            </MyButton>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Bubble({ message }: { message: SupportMessageDto }) {
    if (message.senderType === 'SYSTEM') {
        return (
            <div className="flex justify-center">
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500">
                    {message.body}
                </span>
            </div>
        );
    }
    const isSupport = message.senderType === 'SUPPORT';
    return (
        <div className={cn('flex', isSupport ? 'justify-start' : 'justify-end')}>
            <div
                className={cn(
                    'max-w-xs rounded-lg px-3 py-2 text-sm',
                    isSupport
                        ? 'border border-neutral-200 bg-white text-neutral-700'
                        : 'bg-primary-500 text-white'
                )}
            >
                <div
                    className={cn(
                        'mb-0.5 text-xs',
                        isSupport ? 'text-neutral-400' : 'text-primary-100'
                    )}
                >
                    {isSupport ? message.senderName || 'Support' : 'You'} · {fmt(message.createdAt)}
                </div>
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                {message.attachments?.length ? (
                    <div className="mt-2 flex flex-col gap-2">
                        {message.attachments.map((a, i) => (
                            <AttachmentView key={a.fileId || i} attachment={a} />
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
