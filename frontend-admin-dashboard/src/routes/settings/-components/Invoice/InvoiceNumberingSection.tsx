import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Warning, Info, Hash } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    fetchInvoiceNumberTokens,
    previewInvoiceNumbering,
    type InvoiceNumberingConfig,
    type InvoiceNumberPreview,
    type InvoiceNumberToken,
    type InvoiceSeqScope,
} from './invoice-settings-service';

const SCOPE_OPTIONS: Array<{ value: InvoiceSeqScope; label: string; hint: string }> = [
    { value: 'NEVER', label: 'Never', hint: 'One counter that keeps growing forever' },
    { value: 'YEARLY', label: 'Every year', hint: 'Counter restarts each January' },
    { value: 'MONTHLY', label: 'Every month', hint: 'Counter restarts on the 1st' },
    { value: 'DAILY', label: 'Every day', hint: 'Counter restarts at midnight' },
];

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const GROUP_LABELS: Record<InvoiceNumberToken['group'], string> = {
    SEQUENCE: 'Sequence',
    INSTITUTE: 'Institute',
    LEARNER: 'Learner',
    DATE: 'Date',
    TRANSACTION: 'Payment & course',
};

const GROUP_ORDER: Array<InvoiceNumberToken['group']> = [
    'SEQUENCE',
    'INSTITUTE',
    'DATE',
    'LEARNER',
    'TRANSACTION',
];

/** A few formats worth starting from, so admins rarely need to compose one by hand. */
const PRESETS: Array<{ label: string; format: string; scope: InvoiceSeqScope }> = [
    { label: 'INV-20260805-0001', format: 'INV-{{YYYYMMDD}}-{{seq}}', scope: 'DAILY' },
    { label: 'ACME/2026/0001', format: '{{institute_code}}/{{YYYY}}/{{seq}}', scope: 'YEARLY' },
    { label: 'ACME/2026-27/0001', format: '{{institute_code}}/{{FY}}/{{seq}}', scope: 'YEARLY' },
    { label: 'INV-202608-0001', format: 'INV-{{YYYYMM}}-{{seq}}', scope: 'MONTHLY' },
];

interface Props {
    value: InvoiceNumberingConfig;
    onChange: (patch: Partial<InvoiceNumberingConfig>) => void;
}

/**
 * The invoice-number format builder.
 *
 * <p>Validation and preview both come from the backend, which renders through the very same
 * formatter that issues real numbers — so what an admin sees here cannot disagree with what
 * gets stamped on an invoice. Previewing never consumes a sequence number.
 */
export function InvoiceNumberingSection({ value, onChange }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<InvoiceNumberPreview | null>(null);
    const [previewing, setPreviewing] = useState(false);

    const { data: tokens = [] } = useQuery({
        queryKey: ['invoice-number-tokens'],
        queryFn: fetchInvoiceNumberTokens,
        staleTime: 60 * 60 * 1000, // static catalogue; only changes on deploy
    });

    // Debounced so typing in the format field doesn't fire a request per keystroke.
    useEffect(() => {
        let cancelled = false;
        setPreviewing(true);
        const timer = setTimeout(() => {
            previewInvoiceNumbering(value)
                .then((result) => {
                    if (!cancelled) setPreview(result);
                })
                .catch(() => {
                    if (!cancelled) setPreview(null);
                })
                .finally(() => {
                    if (!cancelled) setPreviewing(false);
                });
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [value]);

    const grouped = useMemo(() => {
        const map = new Map<InvoiceNumberToken['group'], InvoiceNumberToken[]>();
        tokens.forEach((token) => {
            const list = map.get(token.group) ?? [];
            list.push(token);
            map.set(token.group, list);
        });
        return map;
    }, [tokens]);

    /**
     * Insert at the caret rather than appending, and restore the caret afterwards —
     * appending would force admins to retype separators when editing mid-format.
     */
    const insertToken = (key: string) => {
        const input = inputRef.current;
        const token = `{{${key}}}`;
        if (!input) {
            onChange({ format: `${value.format}${token}` });
            return;
        }
        const start = input.selectionStart ?? value.format.length;
        const end = input.selectionEnd ?? value.format.length;
        const next = value.format.slice(0, start) + token + value.format.slice(end);
        onChange({ format: next });
        requestAnimationFrame(() => {
            input.focus();
            const caret = start + token.length;
            input.setSelectionRange(caret, caret);
        });
    };

    const usesFinancialYear = /\{\{\s*F(Y|YY|Q)\s*\}\}/.test(value.format);
    const errors = preview?.errors ?? [];
    const warnings = preview?.warnings ?? [];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Invoice number format</CardTitle>
                    <CardDescription>
                        Build the format from the values below. Every invoice number must include
                        a sequence number so it stays unique.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Presets */}
                    <div className="space-y-1.5">
                        <Label>Start from a common format</Label>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map((preset) => (
                                <Button
                                    key={preset.format}
                                    type="button"
                                    variant={value.format === preset.format ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() =>
                                        onChange({ format: preset.format, seqScope: preset.scope })
                                    }
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Format field */}
                    <div className="space-y-1.5">
                        <Label htmlFor="invoice-number-format">Format</Label>
                        <Input
                            id="invoice-number-format"
                            ref={inputRef}
                            value={value.format}
                            spellCheck={false}
                            onChange={(e) => onChange({ format: e.target.value })}
                            className={cn('font-mono', errors.length > 0 && 'border-danger-500')}
                            placeholder="INV-{{YYYYMMDD}}-{{seq}}"
                        />
                        <p className="text-caption text-neutral-500">
                            Anything outside {'{{ }}'} is used as-is. Letters, digits and - / _ .
                            are allowed.
                        </p>
                    </div>

                    {/* Preview */}
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <Hash className="size-4 text-neutral-500" />
                            <span className="text-body font-medium text-neutral-700">
                                Next invoice numbers
                            </span>
                        </div>
                        {errors.length > 0 ? (
                            <ul className="space-y-1">
                                {errors.map((error) => (
                                    <li
                                        key={error}
                                        className="flex items-start gap-2 text-caption text-danger-600"
                                    >
                                        <Warning className="mt-0.5 size-3.5 shrink-0" weight="fill" />
                                        <span>{error}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : preview?.samples?.length ? (
                            <div className="flex flex-wrap gap-2">
                                {preview.samples.map((sample) => (
                                    <code
                                        key={sample}
                                        className="rounded bg-white px-2 py-1 font-mono text-caption text-neutral-700 ring-1 ring-neutral-200"
                                    >
                                        {sample}
                                    </code>
                                ))}
                            </div>
                        ) : (
                            <p className="text-caption text-neutral-500">
                                {previewing ? 'Checking…' : 'No preview available.'}
                            </p>
                        )}
                        {preview && errors.length === 0 && (
                            <p className="mt-2 text-caption text-neutral-500">
                                Up to {preview.maxLength} characters (limit 100). Previewing does
                                not use up a number.
                            </p>
                        )}
                    </div>

                    {warnings.map((warning) => (
                        <div
                            key={warning}
                            className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 p-3"
                        >
                            <Warning
                                className="mt-0.5 size-4 shrink-0 text-warning-600"
                                weight="fill"
                            />
                            <p className="text-caption text-warning-700">{warning}</p>
                        </div>
                    ))}

                    {/* Token palette */}
                    <div className="space-y-3">
                        <Label>Insert a value</Label>
                        {GROUP_ORDER.filter((group) => grouped.has(group)).map((group) => (
                            <div key={group} className="space-y-1.5">
                                <p className="text-caption font-medium text-neutral-500">
                                    {GROUP_LABELS[group]}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(grouped.get(group) ?? []).map((token) => (
                                        <button
                                            key={token.key}
                                            type="button"
                                            onClick={() => insertToken(token.key)}
                                            title={`${token.label} — e.g. ${token.example}`}
                                            className={cn(
                                                'rounded-md border px-2 py-1 text-caption transition-colors',
                                                'border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50',
                                                token.riskyForTax && 'border-warning-200 bg-warning-50'
                                            )}
                                        >
                                            <span className="font-mono">{token.label}</span>
                                            <span className="ml-1.5 text-neutral-400">
                                                {token.example}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div className="flex items-start gap-2 text-caption text-neutral-500">
                            <Info className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                                Shorten any value with <code className="font-mono">:4</code> (first
                                4 characters) or <code className="font-mono">:initials</code> — for
                                example <code className="font-mono">{'{{learner_name:initials}}'}</code>.
                                Values highlighted in amber make numbering non-sequential.
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Counter</CardTitle>
                    <CardDescription>
                        Controls the sequence number. Existing invoices are never renumbered, and
                        a number is never reused.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-seq-scope">Restart the counter</Label>
                            <Select
                                value={value.seqScope}
                                onValueChange={(v) => onChange({ seqScope: v as InvoiceSeqScope })}
                            >
                                <SelectTrigger id="invoice-seq-scope">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SCOPE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label} — {option.hint}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-seq-padding">Minimum digits</Label>
                            <Input
                                id="invoice-seq-padding"
                                type="number"
                                min={1}
                                max={12}
                                value={value.seqPadding}
                                onChange={(e) =>
                                    onChange({
                                        seqPadding: Math.max(
                                            1,
                                            Math.min(12, Number(e.target.value) || 1)
                                        ),
                                    })
                                }
                            />
                            <p className="text-caption text-neutral-500">
                                4 digits shows invoice 42 as 0042.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-institute-code">Institute code</Label>
                            <Input
                                id="invoice-institute-code"
                                value={value.instituteCode}
                                maxLength={12}
                                onChange={(e) => onChange({ instituteCode: e.target.value })}
                                placeholder="Derived from the institute name"
                            />
                            <p className="text-caption text-neutral-500">
                                Used by the Institute code value.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-start-from">Start next invoice at</Label>
                            <Input
                                id="invoice-start-from"
                                type="number"
                                min={0}
                                value={value.startFrom || ''}
                                placeholder={`Currently next: #${preview?.nextSequence ?? 1}`}
                                onChange={(e) =>
                                    onChange({ startFrom: Math.max(0, Number(e.target.value) || 0) })
                                }
                            />
                            <p className="text-caption text-neutral-500">
                                For continuing a series from another accounting system. Leave
                                blank to carry on from #{preview?.nextSequence ?? 1}. This can only
                                move numbering forward — a lower value is ignored so issued
                                numbers are never reused.
                            </p>
                        </div>

                        {usesFinancialYear && (
                            <div className="space-y-1.5">
                                <Label htmlFor="invoice-fy-start">Financial year starts in</Label>
                                <Select
                                    value={String(value.fyStartMonth)}
                                    onValueChange={(v) => onChange({ fyStartMonth: Number(v) })}
                                >
                                    <SelectTrigger id="invoice-fy-start">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map((month, index) => (
                                            <SelectItem key={month} value={String(index + 1)}>
                                                {month}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-caption text-neutral-500">
                                    April for India and the UK, July for Australia.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
                        <div className="space-y-0.5 pr-4">
                            <Label htmlFor="invoice-sanitize">Clean up text values</Label>
                            <p className="text-caption text-neutral-500">
                                Converts names to capitals and removes spaces, accents and
                                punctuation — &ldquo;Rahul Sharma&rdquo; becomes RAHULSHARMA.
                            </p>
                        </div>
                        <Switch
                            id="invoice-sanitize"
                            checked={value.sanitizeTokens}
                            onCheckedChange={(checked) => onChange({ sanitizeTokens: checked })}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
