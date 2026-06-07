import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowsClockwise,
    CheckCircle,
    CircleNotch,
    CreditCard,
    Eye,
    EyeSlash,
    Info,
    PencilSimple,
    Plus,
    Trash,
    WarningCircle,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { getInstituteId } from '@/constants/helper';
import {
    PaymentGatewayMapping,
    PaymentVendor,
    SECRET_MASK_PREFIX,
    createPaymentGateway,
    deactivatePaymentGateway,
    isMaskedSecret,
    listPaymentGateways,
    updatePaymentGateway,
} from '../-services/payment-gateway-service';

// ─── Vendor schemas ──────────────────────────────────────────────────────────
// What the backend's per-vendor payment manager expects to find in
// `payment_gateway_specific_data`. The `secret` flag controls whether the
// field is rendered as a password input and whether masked values coming back
// from the server are treated as "leave unchanged" on submit.

interface VendorFieldSchema {
    key: string;
    label: string;
    placeholder?: string;
    secret?: boolean;
    required?: boolean;
    helper?: string;
}

interface VendorSchema {
    vendor: PaymentVendor;
    label: string;
    description: string;
    docsUrl?: string;
    fields: VendorFieldSchema[];
}

const VENDOR_SCHEMAS: VendorSchema[] = [
    {
        vendor: 'STRIPE',
        label: 'Stripe',
        description: 'Global card payments and subscriptions.',
        docsUrl: 'https://dashboard.stripe.com/apikeys',
        fields: [
            {
                key: 'apiKey',
                label: 'Secret Key',
                placeholder: 'sk_live_…',
                secret: true,
                required: true,
                helper: 'Stripe Secret API Key. Never shown again after saving.',
            },
            {
                key: 'publishableKey',
                label: 'Publishable Key',
                placeholder: 'pk_live_…',
                secret: true,
                required: true,
                helper: 'Used by the learner checkout in the browser.',
            },
            {
                key: 'webhookSecret',
                label: 'Webhook Signing Secret',
                placeholder: 'whsec_…',
                secret: true,
                helper: 'Optional. Used to verify incoming webhook callbacks.',
            },
        ],
    },
    {
        vendor: 'RAZORPAY',
        label: 'Razorpay',
        description: 'Card / UPI / netbanking for Indian businesses.',
        docsUrl: 'https://dashboard.razorpay.com/app/keys',
        fields: [
            {
                key: 'keyId',
                label: 'Key ID',
                placeholder: 'rzp_live_…',
                required: true,
                helper: 'Razorpay Key ID (public; visible in checkout).',
            },
            {
                key: 'keySecret',
                label: 'Key Secret',
                placeholder: 'Your Razorpay key secret',
                secret: true,
                required: true,
            },
            {
                key: 'webhookSecret',
                label: 'Webhook Secret',
                placeholder: 'Webhook signing secret',
                secret: true,
                helper:
                    'Set this on the Razorpay Webhooks page. Without it, payment status callbacks are rejected with 404 and async confirmation never reaches the platform.',
            },
        ],
    },
    {
        vendor: 'PHONEPE',
        label: 'PhonePe',
        description: 'PhonePe PG for Indian merchants.',
        fields: [
            {
                key: 'clientId',
                label: 'Merchant ID',
                placeholder: 'PGTEST… or your live merchant id',
                required: true,
            },
            {
                key: 'clientSecret',
                label: 'Salt Key',
                placeholder: 'Your salt key',
                secret: true,
                required: true,
            },
            {
                key: 'baseUrl',
                label: 'API Base URL',
                placeholder: 'https://api.phonepe.com/apis/hermes',
                required: true,
            },
            {
                key: 'payBaseUrl',
                label: 'Pay Base URL',
                placeholder: 'https://api.phonepe.com/apis/pg-sandbox',
            },
        ],
    },
    {
        vendor: 'CASHFREE',
        label: 'Cashfree',
        description: 'Cashfree Payments for India.',
        fields: [
            {
                key: 'clientId',
                label: 'App ID',
                placeholder: 'TEST… or live app id',
                required: true,
            },
            {
                key: 'clientSecret',
                label: 'Secret Key',
                secret: true,
                required: true,
            },
            {
                key: 'baseUrl',
                label: 'API Base URL',
                placeholder: 'https://api.cashfree.com/pg',
                required: true,
            },
        ],
    },
    {
        vendor: 'EWAY',
        label: 'Eway',
        description: 'Eway Payments (AU / NZ).',
        fields: [
            {
                key: 'apiKey',
                label: 'API Key',
                secret: true,
                required: true,
            },
            {
                key: 'password',
                label: 'Password',
                secret: true,
                required: true,
            },
            {
                key: 'publicKey',
                label: 'Public API Key',
                helper: 'Used by the learner checkout in the browser.',
            },
            {
                key: 'encryptionKey',
                label: 'Encryption Key',
                secret: true,
            },
            {
                key: 'baseUrl',
                label: 'API Base URL',
                placeholder: 'https://api.ewaypayments.com',
                required: true,
            },
        ],
    },
];

const findSchema = (vendor: string): VendorSchema | undefined =>
    VENDOR_SCHEMAS.find((s) => s.vendor === vendor);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const vendorBadgeClass = (vendor: string): string => {
    switch (vendor) {
        case 'STRIPE':
            return 'border-violet-200 bg-violet-50 text-violet-700';
        case 'RAZORPAY':
            return 'border-blue-200 bg-blue-50 text-blue-700';
        case 'PHONEPE':
            return 'border-indigo-200 bg-indigo-50 text-indigo-700';
        case 'CASHFREE':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'EWAY':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        default:
            return 'border-slate-200 bg-slate-50 text-slate-700';
    }
};

const StatusBadge = ({ status }: { status: string }) =>
    status === 'ACTIVE' ? (
        <Badge className="gap-1 border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <CheckCircle className="size-3" />
            Active
        </Badge>
    ) : (
        <Badge variant="secondary" className="gap-1">
            <WarningCircle className="size-3" />
            Inactive
        </Badge>
    );

// ─── Add/Edit Dialog ─────────────────────────────────────────────────────────

interface GatewayDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    initial?: PaymentGatewayMapping;
    existingVendors: PaymentVendor[];
    onClose: () => void;
    onSaved: () => void;
}

const GatewayDialog = ({
    open,
    mode,
    initial,
    existingVendors,
    onClose,
    onSaved,
}: GatewayDialogProps) => {
    const instituteId = getInstituteId();
    const [vendor, setVendor] = useState<PaymentVendor | ''>('');
    const [values, setValues] = useState<Record<string, string>>({});
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);

    // Available vendors in the dropdown — hide ones already configured (on create only).
    const availableSchemas = useMemo(() => {
        if (mode === 'edit') return VENDOR_SCHEMAS;
        return VENDOR_SCHEMAS.filter((s) => !existingVendors.includes(s.vendor));
    }, [existingVendors, mode]);

    const schema = vendor ? findSchema(vendor) : undefined;

    useEffect(() => {
        if (!open) return;
        if (mode === 'edit' && initial) {
            setVendor(initial.vendor);
            // Pre-fill with whatever the backend returned (secrets come back masked).
            const next: Record<string, string> = {};
            const s = findSchema(initial.vendor);
            s?.fields.forEach((f) => {
                const raw = initial.payment_gateway_specific_data?.[f.key];
                next[f.key] = raw == null ? '' : String(raw);
            });
            setValues(next);
        } else {
            setVendor('');
            setValues({});
        }
        setRevealed({});
    }, [open, mode, initial]);

    const updateField = (key: string, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const handleVendorChange = (next: PaymentVendor) => {
        setVendor(next);
        const blank: Record<string, string> = {};
        findSchema(next)?.fields.forEach((f) => {
            blank[f.key] = '';
        });
        setValues(blank);
        setRevealed({});
    };

    const handleSave = async () => {
        if (!instituteId) {
            toast.error('No institute selected');
            return;
        }
        if (!schema) {
            toast.error('Select a payment gateway vendor');
            return;
        }

        // Validate required fields. For edit-mode, a masked value (••••1234)
        // counts as "field is filled" — the backend will preserve the secret.
        const missing = schema.fields
            .filter((f) => {
                if (!f.required) return false;
                const v = values[f.key] ?? '';
                if (v.trim() === '') return true;
                // Empty mask (no last-4) means no real secret was ever stored — reject.
                if (f.secret && v === SECRET_MASK_PREFIX) return true;
                return false;
            })
            .map((f) => f.label);
        if (missing.length > 0) {
            toast.error(`Missing required fields: ${missing.join(', ')}`);
            return;
        }

        // Build the payload. On EDIT, any secret field still showing the
        // masked placeholder is dropped from the body so the backend keeps
        // the previously stored value.
        const data: Record<string, unknown> = {};
        for (const f of schema.fields) {
            const v = values[f.key];
            if (v == null || v === '') continue;
            if (mode === 'edit' && f.secret && isMaskedSecret(v)) continue;
            data[f.key] = v;
        }

        setSaving(true);
        try {
            if (mode === 'create') {
                await createPaymentGateway(instituteId, {
                    vendor: schema.vendor,
                    payment_gateway_specific_data: data,
                });
                toast.success(`${schema.label} configured`);
            } else if (initial) {
                await updatePaymentGateway(instituteId, initial.id, {
                    payment_gateway_specific_data: data,
                });
                toast.success(`${schema.label} updated`);
            }
            onSaved();
            onClose();
        } catch (err: unknown) {
            const fallback = 'Failed to save gateway configuration';
            const errorMessage =
                (err as { response?: { data?: { message?: string } | string } })
                    ?.response?.data;
            const msg =
                typeof errorMessage === 'string'
                    ? errorMessage
                    : (errorMessage as { message?: string })?.message ?? fallback;
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Add payment gateway' : `Edit ${schema?.label ?? ''}`}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Select a vendor and paste the API credentials from their dashboard.'
                            : 'Update credentials. Leave masked fields untouched to keep the existing secret.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Vendor picker */}
                    {mode === 'create' ? (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Vendor</Label>
                            <Select
                                value={vendor}
                                onValueChange={(v) => handleVendorChange(v as PaymentVendor)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a payment gateway" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSchemas.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-slate-500">
                                            All supported gateways are already configured.
                                        </div>
                                    ) : (
                                        availableSchemas.map((s) => (
                                            <SelectItem key={s.vendor} value={s.vendor}>
                                                {s.label}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={vendorBadgeClass(vendor || '')}>
                                {schema?.label}
                            </Badge>
                            <span className="text-xs text-slate-500">{schema?.description}</span>
                        </div>
                    )}

                    {/* Helper text */}
                    {schema?.docsUrl && (
                        <Alert className="border-blue-100 bg-blue-50">
                            <Info className="size-4 text-blue-600" />
                            <AlertDescription className="text-sm text-blue-700">
                                Find these values in the{' '}
                                <a
                                    href={schema.docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:no-underline"
                                >
                                    {schema.label} dashboard
                                </a>
                                .
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Dynamic fields */}
                    {schema?.fields.map((f) => {
                        const isSecret = !!f.secret;
                        const show = revealed[f.key] === true;
                        const value = values[f.key] ?? '';
                        return (
                            <div key={f.key} className="space-y-1">
                                <Label className="text-xs text-slate-500">
                                    {f.label}
                                    {f.required && <span className="ml-0.5 text-red-500">*</span>}
                                </Label>
                                <div className="relative">
                                    <Input
                                        type={isSecret && !show ? 'password' : 'text'}
                                        value={value}
                                        onChange={(e) => updateField(f.key, e.target.value)}
                                        placeholder={f.placeholder}
                                        className={isSecret ? 'pr-10' : undefined}
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                    {isSecret && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setRevealed((prev) => ({
                                                    ...prev,
                                                    [f.key]: !prev[f.key],
                                                }))
                                            }
                                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600"
                                            title={show ? 'Hide' : 'Show'}
                                        >
                                            {show ? (
                                                <EyeSlash className="size-4" />
                                            ) : (
                                                <Eye className="size-4" />
                                            )}
                                        </button>
                                    )}
                                </div>
                                {f.helper && (
                                    <p className="text-caption text-slate-400">{f.helper}</p>
                                )}
                                {mode === 'edit' && isSecret && isMaskedSecret(value) && (
                                    <p className="text-caption text-amber-600">
                                        Showing masked value. Type a new secret to replace it, or
                                        leave as-is to keep the current one.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <DialogFooter className="gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="default"
                        onClick={onClose}
                        disable={saving}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        layoutVariant="default"
                        onClick={handleSave}
                        disable={saving || !schema}
                    >
                        {saving ? (
                            <>
                                <CircleNotch className="mr-2 size-4 animate-spin" />
                                Saving…
                            </>
                        ) : mode === 'create' ? (
                            'Add Gateway'
                        ) : (
                            'Save changes'
                        )}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Mapping card (one row in the list) ───────────────────────────────────────

interface MappingCardProps {
    mapping: PaymentGatewayMapping;
    onEdit: () => void;
    onDelete: () => void;
}

const MappingCard = ({ mapping, onEdit, onDelete }: MappingCardProps) => {
    const schema = findSchema(mapping.vendor);
    const fields = schema?.fields ?? [];

    return (
        <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                    <Badge variant="outline" className={vendorBadgeClass(mapping.vendor)}>
                        {schema?.label ?? mapping.vendor}
                    </Badge>
                    <StatusBadge status={mapping.status} />
                    <span className="hidden truncate text-xs text-slate-500 sm:inline">
                        {schema?.description}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Edit credentials"
                    >
                        <PencilSimple className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Deactivate gateway"
                    >
                        <Trash className="size-4" />
                    </button>
                </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
                <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {fields.length === 0 ? (
                        <p className="text-xs italic text-slate-400">
                            Unknown vendor — no schema available.
                        </p>
                    ) : (
                        fields.map((f) => {
                            const raw = mapping.payment_gateway_specific_data?.[f.key];
                            const display =
                                raw == null || raw === ''
                                    ? <span className="italic text-slate-400">Not set</span>
                                    : <span className="font-mono">{String(raw)}</span>;
                            return (
                                <div
                                    key={f.key}
                                    className="flex items-center justify-between gap-2 text-xs"
                                >
                                    <span className="shrink-0 text-slate-500">{f.label}</span>
                                    <span className="truncate text-right text-slate-700">
                                        {display}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PaymentGatewaySettings(_props: { isTab?: boolean }) {
    void _props;
    const instituteId = getInstituteId();
    const [mappings, setMappings] = useState<PaymentGatewayMapping[]>([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
    const [editing, setEditing] = useState<PaymentGatewayMapping | undefined>();
    const [confirmDelete, setConfirmDelete] = useState<PaymentGatewayMapping | undefined>();
    const [deleting, setDeleting] = useState(false);

    const fetchMappings = async () => {
        if (!instituteId) return;
        setLoading(true);
        try {
            const data = await listPaymentGateways(instituteId);
            setMappings(data);
        } catch (err) {
            console.error('[PaymentGateways] Failed to load', err);
            toast.error('Failed to load payment gateways');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (instituteId) fetchMappings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instituteId]);

    const existingVendors = useMemo(
        () =>
            mappings
                .filter((m) => m.status === 'ACTIVE')
                .map((m) => m.vendor as PaymentVendor),
        [mappings]
    );

    const openCreate = () => {
        setDialogMode('create');
        setEditing(undefined);
        setDialogOpen(true);
    };

    const openEdit = (m: PaymentGatewayMapping) => {
        setDialogMode('edit');
        setEditing(m);
        setDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!instituteId || !confirmDelete) return;
        setDeleting(true);
        try {
            await deactivatePaymentGateway(instituteId, confirmDelete.id);
            toast.success(`${findSchema(confirmDelete.vendor)?.label ?? confirmDelete.vendor} deactivated`);
            setConfirmDelete(undefined);
            fetchMappings();
        } catch (err) {
            console.error('[PaymentGateways] Failed to deactivate', err);
            toast.error('Failed to deactivate gateway');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="max-w-3xl space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <CreditCard className="size-5 text-blue-600" />
                                Payment Gateways
                            </CardTitle>
                            <CardDescription>
                                Configure the vendors (Stripe, Razorpay, PhonePe, Cashfree, Eway)
                                that learners can pay with. Keys are stored per institute.
                            </CardDescription>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={fetchMappings}
                                disabled={loading}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                title="Refresh"
                            >
                                <ArrowsClockwise className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="default"
                                onClick={openCreate}
                            >
                                <Plus className="mr-1 size-4" />
                                Add Gateway
                            </MyButton>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* List */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Configured gateways</CardTitle>
                    <CardDescription>
                        Secret values are masked. Click <strong>edit</strong> to rotate keys, or
                        leave masked fields as-is to keep the current secret.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {loading && mappings.length === 0 ? (
                        <div className="flex items-center justify-center py-10 text-slate-400">
                            <CircleNotch className="mr-2 size-4 animate-spin" />
                            Loading…
                        </div>
                    ) : mappings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-4 py-10 text-center">
                            <CreditCard className="size-8 text-slate-300" />
                            <p className="text-sm font-medium text-slate-600">
                                No payment gateways configured yet
                            </p>
                            <p className="max-w-md text-xs text-slate-500">
                                Add Stripe, Razorpay, PhonePe, Cashfree, or Eway credentials so
                                learners can pay through your portals.
                            </p>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="default"
                                onClick={openCreate}
                            >
                                <Plus className="mr-1 size-4" />
                                Add your first gateway
                            </MyButton>
                        </div>
                    ) : (
                        mappings.map((m) => (
                            <MappingCard
                                key={m.id}
                                mapping={m}
                                onEdit={() => openEdit(m)}
                                onDelete={() => setConfirmDelete(m)}
                            />
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit dialog */}
            <GatewayDialog
                open={dialogOpen}
                mode={dialogMode}
                initial={editing}
                existingVendors={existingVendors}
                onClose={() => setDialogOpen(false)}
                onSaved={fetchMappings}
            />

            {/* Delete confirm */}
            <Dialog
                open={!!confirmDelete}
                onOpenChange={(o) => !o && setConfirmDelete(undefined)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Deactivate gateway?</DialogTitle>
                        <DialogDescription>
                            {confirmDelete &&
                                `${findSchema(confirmDelete.vendor)?.label ?? confirmDelete.vendor} will be marked inactive and learners won't be able to pay through it. You can add it again later.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            layoutVariant="default"
                            onClick={() => setConfirmDelete(undefined)}
                            disable={deleting}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            layoutVariant="default"
                            onClick={handleDelete}
                            disable={deleting}
                        >
                            {deleting ? (
                                <>
                                    <CircleNotch className="mr-2 size-4 animate-spin" />
                                    Deactivating…
                                </>
                            ) : (
                                'Deactivate'
                            )}
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
