import { useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState } from 'react';
import {
    Plus,
    Trash,
    ClipboardText,
    WhatsappLogo,
    DownloadSimple,
    CheckCircle,
    EnvelopeSimple,
} from '@phosphor-icons/react';

import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
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
import { cn } from '@/lib/utils';

import { fetchInvoiceSettings } from '@/routes/settings/-components/Invoice/invoice-settings-service';
import {
    createAdminInvoice,
    type AdminInvoicePaymentLinkResponse,
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

const CURRENCY_OPTIONS = [
    { _id: 'INR', value: 'INR', label: 'INR — Indian Rupee' },
    { _id: 'USD', value: 'USD', label: 'USD — US Dollar' },
    { _id: 'EUR', value: 'EUR', label: 'EUR — Euro' },
    { _id: 'GBP', value: 'GBP', label: 'GBP — British Pound' },
    { _id: 'AED', value: 'AED', label: 'AED — UAE Dirham' },
    { _id: 'SGD', value: 'SGD', label: 'SGD — Singapore Dollar' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$',
};

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
        onOpenChange(false);
    };

    const handleSubmit = async (values: InvoiceFormValues) => {
        const dueDate = new Date(values.due_date);
        dueDate.setHours(23, 59, 59, 0);

        const results = await createAdminInvoice({
            user_ids: [userId],
            institute_id: instituteId,
            line_items: values.line_items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                item_type: item.item_type || 'SERVICE',
            })),
            currency: values.currency,
            due_date: dueDate.toISOString(),
            notes: values.notes || undefined,
        });

        const userResult = results.find((r) => r.user_id === userId) ?? results[0];
        if (!userResult) throw new Error('No invoice returned from server');

        setSuccessResult(userResult);
        onSuccess();
    };

    const dialogContent = (
        <div className="flex flex-col overflow-hidden">
            {successResult ? (
                <SuccessView result={successResult} userName={userName} onClose={handleClose} />
            ) : (
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(() => {})}
                        className="flex flex-col overflow-hidden"
                    >
                        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                            {isSettingsLoading && (
                                <p className="text-caption text-neutral-500">Loading settings…</p>
                            )}

                            {/* ── Line Items ── */}
                            <div>
                                <p className="mb-3 text-body font-semibold text-neutral-700">
                                    Items
                                </p>

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
                                                                    className="w-full"
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
                                                                    className="w-full text-right"
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
                                                                    className="w-full text-right"
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
                            <div className="grid grid-cols-2 gap-4">
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

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
                            <MyButton buttonType="secondary" scale="medium" onClick={handleClose}>
                                Cancel
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onAsyncClick={form.handleSubmit(handleSubmit)}
                                loadingText="Creating…"
                            >
                                Create Invoice
                            </MyButton>
                        </div>
                    </form>
                </Form>
            )}
        </div>
    );

    return (
        <MyDialog
            open={open}
            onOpenChange={(o) => {
                if (!o) handleClose();
                else onOpenChange(true);
            }}
            heading={`Create Invoice — ${userName}`}
            dialogWidth="max-w-xl"
            content={dialogContent}
        />
    );
}
