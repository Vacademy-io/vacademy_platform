import { useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import {
    Plus,
    Trash,
    ClipboardText,
    WhatsappLogo,
    DownloadSimple,
    CheckCircle,
    EnvelopeSimple,
    CaretLeft,
    Eye,
    ArrowsClockwise,
} from '@phosphor-icons/react';

import { CURRENCIES, currencySymbols } from '@/constants/currencies';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Textarea } from '@/components/ui/textarea';
import SelectField from '@/components/design-system/select-field';
import { StatusChip } from '@/components/design-system/status-chips';
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from '@/components/ui/form';
import { DashboardLoader } from '@/components/core/dashboard-loader';

import { fetchInvoiceSettings } from '@/routes/settings/-components/Invoice/invoice-settings-service';
import {
    createAdminInvoice,
    previewAdminInvoice,
    type AdminCreateInvoiceRequest,
    type AdminInvoicePaymentLinkResponse,
    type InvoicePlaceholderValue,
} from '@/services/invoice-service';

// ─── Schema ──────────────────────────────────────────────────────────────────

const lineItemSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.coerce.number().min(1, 'Min 1'),
    unit_price: z.coerce.number().min(0.01, 'Must be > 0'),
    item_type: z.string().optional(),
});

const invoiceFormSchema = z.object({
    line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
    due_date: z.string().min(1, 'Due date is required'),
    currency: z.string().min(1, 'Currency is required'),
    notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

// ─── Currency options ────────────────────────────────────────────────────────

const CURRENCY_OPTIONS = CURRENCIES.map(({ code, name }) => ({
    _id: code,
    value: code,
    label: `${code} — ${name}`,
}));

const CURRENCY_SYMBOLS: Record<string, string> = currencySymbols;

// Ordered groups for the review panel (matches the backend PLACEHOLDER_META groups).
const GROUP_ORDER = ['INVOICE', 'BILL TO', 'INSTITUTE', 'TAX', 'AMOUNTS', 'NOTES'];

// ─── Props ───────────────────────────────────────────────────────────────────

interface CreateInvoiceDialogProps {
    userId: string;
    userName: string;
    instituteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string): string {
    const sym = CURRENCY_SYMBOLS[currency] ?? currency;
    return `${sym}${Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

// ─── Success view ────────────────────────────────────────────────────────────

function SuccessView({
    result,
    userName,
    onClose,
}: {
    result: AdminInvoicePaymentLinkResponse;
    userName: string;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(result.payment_link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Could not copy to clipboard');
        }
    };

    const whatsappText = encodeURIComponent(
        `Hi ${userName}, your invoice ${result.invoice_number} for ${fmt(result.total_amount, result.currency)} is ready. Pay here: ${result.payment_link}`
    );

    return (
        <div className="flex flex-col items-center gap-6 px-6 py-8 text-center">
            <StatusChip status="SUCCESS" text="Invoice Created!" textSize="text-subtitle" showIcon />

            <div className="w-full max-w-sm rounded-lg border border-success-200 bg-success-50 p-4 text-left">
                <div className="mb-1 flex items-center gap-2">
                    <CheckCircle className="size-5 text-success-600" weight="fill" />
                    <span className="text-body font-semibold text-success-700">{result.invoice_number}</span>
                </div>
                <p className="text-caption text-neutral-600">
                    Total:{' '}
                    <span className="font-semibold text-neutral-800">
                        {fmt(result.total_amount, result.currency)}
                    </span>
                </p>
            </div>

            {result.payment_link && (
                <div className="w-full max-w-sm space-y-2">
                    <p className="text-caption font-medium text-neutral-600">Payment Link</p>
                    <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <span className="flex-1 truncate text-caption text-neutral-700">
                            {result.payment_link}
                        </span>
                        <MyButton
                            buttonType={copied ? 'primary' : 'secondary'}
                            scale="small"
                            layoutVariant="icon"
                            onClick={handleCopy}
                            title="Copy payment link"
                        >
                            <ClipboardText className="size-3.5" />
                        </MyButton>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
                {result.payment_link && (
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => window.open(`https://wa.me/?text=${whatsappText}`, '_blank')}
                    >
                        <WhatsappLogo className="mr-1.5 size-4" />
                        Share on WhatsApp
                    </MyButton>
                )}
                {result.pdf_url && (
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => window.open(result.pdf_url!, '_blank')}
                    >
                        <DownloadSimple className="mr-1.5 size-4" />
                        Download PDF
                    </MyButton>
                )}
                <MyButton buttonType="primary" scale="small" onClick={onClose}>
                    Close
                </MyButton>
            </div>
        </div>
    );
}

// ─── Review & Preview step ─────────────────────────────────────────────────────

function ReviewStep({
    resolvedValues,
    overrides,
    reviewDates,
    previewHtml,
    previewLoading,
    previewError,
    onOverrideChange,
    onDateChange,
    onRetry,
}: {
    resolvedValues: InvoicePlaceholderValue[];
    overrides: Record<string, string>;
    reviewDates: Record<string, string>;
    previewHtml: string;
    previewLoading: boolean;
    previewError: string | null;
    onOverrideChange: (key: string, value: string) => void;
    onDateChange: (key: string, value: string) => void;
    onRetry: () => void;
}) {
    const grouped = GROUP_ORDER.map((group) => ({
        group,
        items: resolvedValues.filter((r) => r.group === group),
    })).filter((g) => g.items.length > 0);

    return (
        <div className="flex h-[68vh] min-h-0 flex-col md:flex-row"> {/* design-lint-ignore: viewport-relative preview height, no vh design token exists */}
            {/* ── Editable dynamic values ── */}
            <div className="w-full shrink-0 space-y-5 overflow-y-auto border-b border-neutral-200 px-6 py-5 md:w-2/5 md:border-b-0 md:border-r">
                <p className="text-caption text-neutral-500">
                    These values fill your invoice template. Edit anything before creating — the
                    preview updates live.
                </p>

                {grouped.map(({ group, items }) => (
                    <div key={group} className="space-y-3">
                        <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">
                            {group}
                        </p>
                        <div className="space-y-3">
                            {items.map((field) => {
                                if (!field.editable) {
                                    return (
                                        <div key={field.key} className="flex items-center justify-between gap-2">
                                            <span className="text-caption text-neutral-500">{field.label}</span>
                                            <span className="text-body font-medium text-neutral-700 tabular-nums">
                                                {field.value || '—'}
                                            </span>
                                        </div>
                                    );
                                }
                                if (field.input_type === 'date') {
                                    return (
                                        <MyInput
                                            key={field.key}
                                            inputType="date"
                                            label={field.label}
                                            inputPlaceholder=""
                                            input={reviewDates[field.key] ?? field.value ?? ''}
                                            onChangeFunction={(e) => onDateChange(field.key, e.target.value)}
                                            className="w-full"
                                        />
                                    );
                                }
                                if (field.input_type === 'textarea') {
                                    return (
                                        <div key={field.key} className="flex flex-col gap-1">
                                            <label className="text-subtitle font-regular text-neutral-700">
                                                {field.label}
                                            </label>
                                            <Textarea
                                                value={overrides[field.key] ?? field.value ?? ''}
                                                onChange={(e) => onOverrideChange(field.key, e.target.value)}
                                                className="text-body"
                                            />
                                        </div>
                                    );
                                }
                                return (
                                    <MyInput
                                        key={field.key}
                                        inputType="text"
                                        label={field.label}
                                        inputPlaceholder={field.label}
                                        input={overrides[field.key] ?? field.value ?? ''}
                                        onChangeFunction={(e) => onOverrideChange(field.key, e.target.value)}
                                        className="w-full"
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Live preview ── */}
            <div className="flex min-h-0 flex-1 flex-col bg-neutral-100">
                <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
                    <Eye className="size-4 text-neutral-500" />
                    <span className="text-caption font-medium text-neutral-600">Invoice preview</span>
                    {previewLoading && (
                        <ArrowsClockwise className="size-3.5 animate-spin text-primary-500" />
                    )}
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                    {previewError ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                            <p className="text-body text-danger-600">{previewError}</p>
                            <MyButton buttonType="secondary" scale="small" onClick={onRetry}>
                                <ArrowsClockwise className="mr-1.5 size-4" />
                                Retry
                            </MyButton>
                        </div>
                    ) : !previewHtml && previewLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <DashboardLoader />
                        </div>
                    ) : (
                        <iframe
                            title="Invoice preview"
                            srcDoc={previewHtml}
                            sandbox=""
                            className="size-full border-0 bg-white"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreateInvoiceDialog({
    userId,
    userName,
    instituteId,
    open,
    onOpenChange,
    onSuccess,
}: CreateInvoiceDialogProps) {
    const [successResult, setSuccessResult] = useState<AdminInvoicePaymentLinkResponse | null>(null);
    const [step, setStep] = useState<'items' | 'review'>('items');

    // Review-step state
    const [resolvedValues, setResolvedValues] = useState<InvoicePlaceholderValue[] | null>(null);
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const [reviewDates, setReviewDates] = useState<Record<string, string>>({});
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    // Skips exactly one debounced refresh right after seeding (its result is already shown).
    const skipNextPreviewRef = useRef(false);

    const { data: invoiceSettings, isLoading: isSettingsLoading } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: fetchInvoiceSettings,
        staleTime: 5 * 60 * 1000,
    });

    const defaultCurrency = invoiceSettings?.currency ?? 'INR';

    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceFormSchema),
        defaultValues: {
            line_items: [{ description: '', quantity: 1, unit_price: 0, item_type: 'SERVICE' }],
            due_date: '',
            currency: defaultCurrency,
            notes: '',
        },
    });

    // Sync currency default once settings load
    const formCurrency = form.watch('currency');
    if (invoiceSettings && !form.formState.isDirty && formCurrency !== defaultCurrency) {
        form.setValue('currency', defaultCurrency);
    }

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'line_items',
    });

    // useWatch subscribes to changes and triggers re-renders reliably
    const watchedLineItems = useWatch({ control: form.control, name: 'line_items' });
    const currency = useWatch({ control: form.control, name: 'currency' }) || defaultCurrency;

    const taxRate = invoiceSettings?.taxRate ?? 0;
    const taxLabel = invoiceSettings?.taxLabel ?? 'Tax';
    const taxIncluded = invoiceSettings?.taxIncluded ?? false;

    const subtotal = watchedLineItems.reduce((sum, item) => {
        return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    }, 0);
    const taxAmount = taxIncluded ? 0 : subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const handleClose = () => {
        form.reset();
        setSuccessResult(null);
        setStep('items');
        setResolvedValues(null);
        setOverrides({});
        setReviewDates({});
        setPreviewHtml('');
        setPreviewError(null);
        onOpenChange(false);
    };

    // Build the create/preview request from the items form + review edits.
    const buildRequest = (
        values: InvoiceFormValues,
        ov: Record<string, string>,
        dates: Record<string, string>
    ): AdminCreateInvoiceRequest => {
        // A cleared review date field is an empty string; treat that as "not overridden" and
        // fall back to the step-1 (zod-validated) due date so we never build an invalid date.
        const dueRaw = dates.due_date && dates.due_date !== '' ? dates.due_date : values.due_date;
        let due = new Date(dueRaw);
        if (Number.isNaN(due.getTime())) due = new Date(values.due_date);
        due.setHours(23, 59, 59, 0);
        // Send invoice_date as a NAIVE local date-time string (no toISOString): the backend field
        // is a LocalDateTime, and round-tripping local-midnight through toISOString() would shift
        // the calendar day back for UTC+ timezones (e.g. IST). An empty value falls back to the
        // server's now().
        const invoiceDate = dates.invoice_date ? `${dates.invoice_date}T00:00:00` : undefined;
        return {
            user_ids: [userId],
            institute_id: instituteId,
            line_items: values.line_items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                item_type: item.item_type || 'SERVICE',
            })),
            currency: values.currency,
            due_date: due.toISOString(),
            invoice_date: invoiceDate,
            notes: ov.notes || undefined,
            overrides: ov,
        };
    };

    // Render the preview. `seed=true` (re)initialises the editable fields from the
    // server's resolved values; `seed=false` re-renders using the current edits.
    const runPreview = async (seed: boolean) => {
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const values = form.getValues();
            const req = buildRequest(values, seed ? {} : overrides, seed ? {} : reviewDates);
            const res = await previewAdminInvoice(req);
            setPreviewHtml(res.html);
            setResolvedValues(res.resolved_values);
            if (seed) {
                const ov: Record<string, string> = {};
                const dates: Record<string, string> = {};
                res.resolved_values.forEach((rv) => {
                    if (!rv.editable) return;
                    if (rv.input_type === 'date') dates[rv.key] = rv.value;
                    else ov[rv.key] = rv.value;
                });
                setOverrides(ov);
                setReviewDates(dates);
                skipNextPreviewRef.current = true;
            }
        } catch {
            setPreviewError('Could not render the invoice preview. Please try again.');
        } finally {
            setPreviewLoading(false);
        }
    };

    // Debounced live refresh while editing dynamic values in the review step.
    useEffect(() => {
        if (step !== 'review' || !resolvedValues) return;
        if (skipNextPreviewRef.current) {
            skipNextPreviewRef.current = false;
            return;
        }
        const t = setTimeout(() => {
            void runPreview(false);
        }, 500);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overrides, reviewDates, step]);

    const handleNext = async () => {
        const ok = await form.trigger();
        if (!ok) return;
        const isSeed = resolvedValues === null;
        // Re-entry (Back → Next): setStep('review') re-triggers the debounce effect, which would
        // fire a second identical preview. Suppress that one — the direct runPreview(false) below
        // already refreshes. (On first entry, runPreview(true) sets this flag itself.)
        if (!isSeed) skipNextPreviewRef.current = true;
        setStep('review');
        // Seed on first entry; on re-entry just refresh so prior edits are kept.
        await runPreview(isSeed);
    };

    const handleCreate = async () => {
        const values = form.getValues();
        const results = await createAdminInvoice(buildRequest(values, overrides, reviewDates));
        const userResult = results.find((r) => r.user_id === userId) ?? results[0];
        if (!userResult) throw new Error('No invoice returned from server');
        setSuccessResult(userResult);
        onSuccess();
    };

    const itemsContent = (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(() => {})} className="flex flex-col overflow-hidden">
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                    {isSettingsLoading && (
                        <p className="text-caption text-neutral-500">Loading settings…</p>
                    )}

                    {/* ── Line Items ── */}
                    <div>
                        <p className="mb-3 text-body font-semibold text-neutral-700">Items</p>

                        {/* Table header */}
                        <div className="mb-1 grid grid-cols-12 gap-2 px-1">
                            <span className="col-span-5 text-caption font-medium text-neutral-500">Description</span>
                            <span className="col-span-2 text-caption font-medium text-neutral-500 text-right">Qty</span>
                            <span className="col-span-2 text-caption font-medium text-neutral-500 text-right">Price</span>
                            <span className="col-span-3 text-caption font-medium text-neutral-500 text-right">Amount</span>
                        </div>

                        <div className="space-y-2">
                            {fields.map((field, index) => {
                                const qty = Number(watchedLineItems[index]?.quantity) || 0;
                                const price = Number(watchedLineItems[index]?.unit_price) || 0;
                                const lineTotal = qty * price;

                                return (
                                    <div
                                        key={field.id}
                                        className="grid grid-cols-12 items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5"
                                    >
                                        {/* Description */}
                                        <FormField
                                            control={form.control}
                                            name={`line_items.${index}.description`}
                                            render={({ field: f }) => (
                                                <FormItem className="col-span-5 space-y-0.5">
                                                    <FormControl>
                                                        <MyInput
                                                            inputType="text"
                                                            inputPlaceholder="e.g. Course Fee"
                                                            input={f.value}
                                                            onChangeFunction={f.onChange}
                                                            className="w-full sm:w-full"
                                                            {...f}
                                                        />
                                                    </FormControl>
                                                    <FormMessage className="text-caption" />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Quantity */}
                                        <FormField
                                            control={form.control}
                                            name={`line_items.${index}.quantity`}
                                            render={({ field: f }) => (
                                                <FormItem className="col-span-2 space-y-0.5">
                                                    <FormControl>
                                                        <MyInput
                                                            inputType="number"
                                                            inputPlaceholder="1"
                                                            input={String(f.value)}
                                                            onChangeFunction={f.onChange}
                                                            className="w-full sm:w-full text-right"
                                                            {...f}
                                                        />
                                                    </FormControl>
                                                    <FormMessage className="text-caption" />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Unit Price */}
                                        <FormField
                                            control={form.control}
                                            name={`line_items.${index}.unit_price`}
                                            render={({ field: f }) => (
                                                <FormItem className="col-span-2 space-y-0.5">
                                                    <FormControl>
                                                        <MyInput
                                                            inputType="number"
                                                            inputPlaceholder="0"
                                                            input={String(f.value)}
                                                            onChangeFunction={f.onChange}
                                                            className="w-full sm:w-full text-right"
                                                            {...f}
                                                        />
                                                    </FormControl>
                                                    <FormMessage className="text-caption" />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Line total + delete */}
                                        <div className="col-span-3 flex items-center justify-end gap-1.5 pt-1.5">
                                            <span className="text-body font-semibold text-neutral-800 tabular-nums">
                                                {fmt(lineTotal, currency)}
                                            </span>
                                            {fields.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="shrink-0 rounded p-0.5 text-neutral-400 hover:text-danger-500"
                                                    title="Remove"
                                                >
                                                    <Trash className="size-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {form.formState.errors.line_items?.root && (
                            <p className="mt-1 text-caption text-danger-600">
                                {form.formState.errors.line_items.root.message}
                            </p>
                        )}

                        <MyButton
                            buttonType="text"
                            scale="small"
                            className="mt-2"
                            onClick={() =>
                                append({ description: '', quantity: 1, unit_price: 0, item_type: 'SERVICE' })
                            }
                        >
                            <Plus className="mr-1 size-3.5" />
                            Add Item
                        </MyButton>
                    </div>

                    {/* ── Summary ── */}
                    <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
                        <div className="space-y-1 text-body">
                            <div className="flex justify-between text-neutral-600">
                                <span>Subtotal</span>
                                <span className="tabular-nums">{fmt(subtotal, currency)}</span>
                            </div>
                            {taxRate > 0 && !taxIncluded && (
                                <div className="flex justify-between text-neutral-600">
                                    <span>{taxLabel} ({taxRate}%)</span>
                                    <span className="tabular-nums">{fmt(taxAmount, currency)}</span>
                                </div>
                            )}
                            {taxRate > 0 && taxIncluded && (
                                <p className="text-caption text-neutral-500">Incl. {taxRate}% {taxLabel}</p>
                            )}
                            <div className="flex justify-between border-t border-primary-200 pt-1.5 font-semibold">
                                <span className="text-neutral-700">Total</span>
                                <span className="text-primary-600 tabular-nums">{fmt(total, currency)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Email auto-send notice */}
                    {invoiceSettings?.sendInvoiceEmail && (
                        <div className="flex items-center gap-2 rounded-md border border-info-200 bg-info-50 px-3 py-2">
                            <EnvelopeSimple size={14} className="shrink-0 text-info-600" weight="fill" />
                            <p className="text-caption text-info-700">
                                Invoice email will be sent to the learner automatically after payment.
                            </p>
                        </div>
                    )}

                    {/* ── Due Date + Currency ── */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="due_date"
                            render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel className="text-caption text-neutral-600">
                                        Due Date <span className="text-danger-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="date"
                                            inputPlaceholder=""
                                            input={f.value}
                                            onChangeFunction={f.onChange}
                                            className="w-full"
                                            {...f}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <SelectField
                            label="Currency"
                            name="currency"
                            control={form.control}
                            options={CURRENCY_OPTIONS}
                            required
                        />
                    </div>
                </div>
            </form>
        </Form>
    );

    const dialogContent = (
        <div className="flex flex-col overflow-hidden">
            {successResult ? (
                <SuccessView result={successResult} userName={userName} onClose={handleClose} />
            ) : step === 'review' && resolvedValues ? (
                <>
                    <ReviewStep
                        resolvedValues={resolvedValues}
                        overrides={overrides}
                        reviewDates={reviewDates}
                        previewHtml={previewHtml}
                        previewLoading={previewLoading}
                        previewError={previewError}
                        onOverrideChange={(key, value) =>
                            setOverrides((prev) => ({ ...prev, [key]: value }))
                        }
                        onDateChange={(key, value) =>
                            setReviewDates((prev) => ({ ...prev, [key]: value }))
                        }
                        onRetry={() => void runPreview(false)}
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-6 py-4">
                        <MyButton buttonType="secondary" scale="medium" onClick={() => setStep('items')}>
                            <CaretLeft className="mr-1 size-4" />
                            Back
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onAsyncClick={handleCreate}
                            loadingText="Creating…"
                        >
                            Create Invoice
                        </MyButton>
                    </div>
                </>
            ) : (
                <>
                    {itemsContent}
                    <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
                        <MyButton buttonType="secondary" scale="medium" onClick={handleClose}>
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onAsyncClick={handleNext}
                            loadingText="Loading preview…"
                        >
                            Next: Review & Preview
                        </MyButton>
                    </div>
                </>
            )}
        </div>
    );

    const heading = successResult
        ? `Invoice — ${userName}`
        : step === 'review'
          ? `Review Invoice — ${userName}`
          : `Create Invoice — ${userName}`;

    return (
        <MyDialog
            open={open}
            onOpenChange={(o) => {
                if (!o) handleClose();
                else onOpenChange(true);
            }}
            heading={heading}
            // Review step needs room for the side-by-side edit + preview panes.
            dialogWidth={step === 'review' && !successResult ? 'max-w-6xl' : 'max-w-3xl'}
            content={dialogContent}
        />
    );
}
