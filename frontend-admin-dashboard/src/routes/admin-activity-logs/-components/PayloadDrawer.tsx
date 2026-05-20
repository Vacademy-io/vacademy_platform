import { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Copy, Check } from '@phosphor-icons/react';
import type { AdminActivityLog } from '@/services/admin-activity-logs/getActivityLogs';

interface Props {
    log: AdminActivityLog | null;
    open: boolean;
    onClose: () => void;
}

const ACTION_VARIANT: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    CREATE: 'default',
    UPDATE: 'secondary',
    DELETE: 'destructive',
    CANCEL: 'destructive',
    ENROLL: 'default',
};

const statusTone = (status: number | null | undefined): string => {
    if (status == null) return 'text-gray-500';
    if (status >= 200 && status < 300) return 'text-emerald-600';
    if (status >= 400 && status < 500) return 'text-amber-600';
    return 'text-red-600';
};

export function PayloadDrawer({ log, open, onClose }: Props) {
    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                {log && (
                    <>
                        <SheetHeader className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant={ACTION_VARIANT[log.action] || 'outline'}>
                                    {log.action}
                                </Badge>
                                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                    {log.entity_type}
                                </span>
                            </div>
                            <SheetTitle className="text-lg leading-tight">
                                {log.description || `${log.action.toLowerCase()}d ${log.entity_type.toLowerCase()}`}
                            </SheetTitle>
                            <SheetDescription>
                                <span className="font-medium text-gray-700">
                                    {log.actor_name || log.actor_email || 'Unknown user'}
                                </span>
                                {' · '}
                                {log.created_at && new Date(log.created_at).toLocaleString()}
                            </SheetDescription>
                        </SheetHeader>

                        <Separator className="my-4" />

                        <div className="space-y-5 text-sm">
                            <Section title="Actor">
                                <KeyValue label="Name" value={log.actor_name} />
                                <KeyValue label="Email" value={log.actor_email} />
                                <KeyValue label="User ID" value={log.actor_id} mono />
                            </Section>

                            <Section title="Request">
                                <KeyValue label="HTTP" value={log.http_method} />
                                <KeyValue label="Endpoint" value={log.endpoint} mono />
                                <KeyValue label="IP" value={log.ip_address} mono />
                                <KeyValue
                                    label="Status"
                                    value={log.response_status?.toString() ?? null}
                                    valueClassName={statusTone(log.response_status)}
                                />
                                <KeyValue
                                    label="Latency"
                                    value={
                                        log.response_time_ms != null
                                            ? `${log.response_time_ms} ms`
                                            : null
                                    }
                                />
                                {log.entity_id && (
                                    <KeyValue label="Entity ID" value={log.entity_id} mono />
                                )}
                            </Section>

                            {log.before_payload != null ? (
                                <Section title="Before → After">
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        <JsonBlock
                                            label="Before"
                                            value={log.before_payload}
                                            tone="muted"
                                        />
                                        <JsonBlock
                                            label="After (request)"
                                            value={log.request_payload}
                                            tone="accent"
                                        />
                                    </div>
                                </Section>
                            ) : (
                                <Section title="Payload">
                                    {log.request_payload != null ? (
                                        <JsonBlock value={log.request_payload} />
                                    ) : (
                                        <p className="text-xs italic text-gray-500">
                                            No payload captured.
                                        </p>
                                    )}
                                </Section>
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {title}
            </h3>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

function JsonBlock({
    value,
    label,
    tone = 'default',
}: {
    value: unknown;
    label?: string;
    tone?: 'default' | 'muted' | 'accent';
}) {
    const toneClasses =
        tone === 'accent'
            ? 'bg-blue-50/60 border-blue-200'
            : tone === 'muted'
              ? 'bg-gray-50 border-gray-200'
              : 'bg-gray-50 border-gray-200';

    const formatted = JSON.stringify(value, null, 2);
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(formatted);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard blocked — no-op */
        }
    };

    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                {label ? (
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        {label}
                    </span>
                ) : (
                    <span />
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-800"
                    onClick={copy}
                >
                    {copied ? (
                        <>
                            <Check className="mr-1 size-3.5" />
                            Copied
                        </>
                    ) : (
                        <>
                            <Copy className="mr-1 size-3.5" />
                            Copy
                        </>
                    )}
                </Button>
            </div>
            <ScrollArea className={`max-h-80 rounded border p-3 ${toneClasses}`}>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-snug text-gray-800">
                    {formatted}
                </pre>
            </ScrollArea>
        </div>
    );
}

function KeyValue({
    label,
    value,
    mono,
    valueClassName,
}: {
    label: string;
    value: string | null | undefined;
    mono?: boolean;
    valueClassName?: string;
}) {
    if (!value) return null;
    return (
        <div className="flex justify-between gap-3 text-sm">
            <span className="text-gray-500">{label}</span>
            <span
                className={`max-w-[60%] truncate text-right text-gray-800 ${
                    mono ? 'font-mono text-xs' : ''
                } ${valueClassName ?? ''}`}
                title={value}
            >
                {value}
            </span>
        </div>
    );
}
