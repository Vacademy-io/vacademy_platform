import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Percent, Receipt, Sparkle } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { cn } from '@/lib/utils';
import {
    AppliedDiscountInput,
    CouponCreateRequest,
    CouponDetail,
    CouponUpdateRequest,
    useCreateCoupon,
    useUpdateCoupon,
} from '@/services/coupons';
import { CouponScopePicker, CouponScopeValue } from './CouponScopePicker';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import {
    ContentTerms,
    OtherTerms,
    RoleTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';

// =============================================================================
// Schema
// =============================================================================

const couponSchema = z
    .object({
        code: z
            .string()
            .min(3, 'Code must be at least 3 characters')
            .max(32, 'Code must be at most 32 characters')
            .regex(/^[A-Z0-9_-]+$/, 'Use uppercase letters, digits, _ or -'),
        discountType: z.enum(['PERCENTAGE', 'FLAT']),
        discountValue: z
            .number({ invalid_type_error: 'Discount value is required' })
            .positive('Discount value must be greater than 0'),
        maxDiscountValue: z.number().positive().nullable().optional(),
        redeemStartDate: z.string().optional(),
        redeemEndDate: z.string().min(1, 'End date is required'),
        usageLimit: z
            .number({ invalid_type_error: 'Enter a number or leave blank' })
            .int()
            .positive()
            .nullable()
            .optional(),
        isEmailRestricted: z.boolean(),
        allowedEmailsRaw: z.string().optional(),
        scope: z.object({
            mode: z.enum(['all', 'sessions', 'invites']),
            packageSessionIds: z.array(z.string()),
            enrollInviteIds: z.array(z.string()),
        }),
        status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    })
    .refine((v) => v.discountType !== 'PERCENTAGE' || v.discountValue <= 100, {
        message: 'Percentage cannot exceed 100',
        path: ['discountValue'],
    })
    .refine((v) => v.discountType !== 'PERCENTAGE' || (v.maxDiscountValue ?? 0) > 0, {
        message: 'Max cap is required for percentage discounts',
        path: ['maxDiscountValue'],
    })
    .refine((v) => !v.redeemStartDate || new Date(v.redeemEndDate) > new Date(v.redeemStartDate), {
        message: 'End date must be after start date',
        path: ['redeemEndDate'],
    });

type CouponFormValues = z.infer<typeof couponSchema>;

// =============================================================================
// Helpers
// =============================================================================

const parseEmails = (raw: string | undefined): string[] =>
    !raw
        ? []
        : raw
              .split(/[,\n\s;]+/)
              .map((s) => s.trim())
              .filter(Boolean);

const formatDateForInput = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    // <input type="date"> expects 'YYYY-MM-DD'. Coupons are day-granular —
    // CouponValidationService treats the end date as end-of-day, so we don't
    // need a time picker (and the native datetime-local widget silently
    // blanks the form value when the seconds/AM-PM portion is incomplete).
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const scopeFromDetail = (editing?: CouponDetail | null): CouponScopeValue => {
    if (!editing) return { mode: 'all', packageSessionIds: [], enrollInviteIds: [] };
    if (editing.applicable_enroll_invite_ids.length > 0) {
        return {
            mode: 'invites',
            packageSessionIds: [],
            enrollInviteIds: editing.applicable_enroll_invite_ids,
        };
    }
    if (editing.applicable_package_session_ids.length > 0) {
        return {
            mode: 'sessions',
            packageSessionIds: editing.applicable_package_session_ids,
            enrollInviteIds: [],
        };
    }
    return { mode: 'all', packageSessionIds: [], enrollInviteIds: [] };
};

const formatPreview = (v: CouponFormValues, currencySymbol = '₹'): string => {
    const discountStr =
        v.discountType === 'PERCENTAGE'
            ? `${v.discountValue}% off${v.maxDiscountValue ? `, max ${currencySymbol}${v.maxDiscountValue.toLocaleString()}` : ''}`
            : `${currencySymbol}${v.discountValue.toLocaleString()} off`;
    const expiry = v.redeemEndDate
        ? new Date(v.redeemEndDate).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          })
        : '';
    return `${discountStr}${expiry ? ` · valid until ${expiry}` : ''}`;
};

// =============================================================================
// Component
// =============================================================================

export interface CouponFormDialogProps {
    instituteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When set, dialog is in edit mode — code is locked + post-redemption fields disabled. */
    editing?: CouponDetail | null;
    /** Pre-fill scope when launching from a contextual button (e.g. invite flow). */
    prefillScope?: Partial<CouponScopeValue>;
    onSaved?: (coupon: CouponDetail) => void;
}

export const CouponFormDialog = ({
    instituteId,
    open,
    onOpenChange,
    editing,
    prefillScope,
    onSaved,
}: CouponFormDialogProps) => {
    const createMutation = useCreateCoupon();
    const updateMutation = useUpdateCoupon();
    const isEdit = !!editing;
    const isFrozen = (editing?.usage_count ?? 0) > 0;

    const defaultValues = useMemo<CouponFormValues>(() => {
        const baseScope = scopeFromDetail(editing);
        const scope: CouponScopeValue = prefillScope
            ? {
                  mode: prefillScope.mode ?? baseScope.mode,
                  packageSessionIds: prefillScope.packageSessionIds ?? baseScope.packageSessionIds,
                  enrollInviteIds: prefillScope.enrollInviteIds ?? baseScope.enrollInviteIds,
              }
            : baseScope;

        if (editing) {
            const discount = editing.applied_discount;
            return {
                code: editing.code,
                discountType: (discount?.discount_type ?? 'PERCENTAGE') as 'PERCENTAGE' | 'FLAT',
                discountValue: discount?.discount_point ?? 0,
                maxDiscountValue: discount?.max_discount_point ?? null,
                redeemStartDate: formatDateForInput(editing.redeem_start_date),
                redeemEndDate: formatDateForInput(editing.redeem_end_date),
                usageLimit: editing.usage_limit ?? null,
                isEmailRestricted: editing.email_restricted,
                allowedEmailsRaw: editing.allowed_email_ids
                    ? (() => {
                          try {
                              return (JSON.parse(editing.allowed_email_ids) as string[]).join(', ');
                          } catch {
                              return editing.allowed_email_ids ?? '';
                          }
                      })()
                    : '',
                scope,
                status: (editing.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as
                    | 'ACTIVE'
                    | 'INACTIVE',
            };
        }
        return {
            code: '',
            discountType: 'PERCENTAGE',
            discountValue: 0,
            maxDiscountValue: null,
            redeemStartDate: '',
            redeemEndDate: '',
            usageLimit: null,
            isEmailRestricted: false,
            allowedEmailsRaw: '',
            scope,
            status: 'ACTIVE',
        };
    }, [editing, prefillScope]);

    const form = useForm<CouponFormValues>({
        resolver: zodResolver(couponSchema),
        defaultValues,
    });

    useEffect(() => {
        if (open) form.reset(defaultValues);
    }, [open, defaultValues, form]);

    const watchedValues = form.watch();
    const isPercentage = watchedValues.discountType === 'PERCENTAGE';

    const learnerSingular = getTerminology(RoleTerms.Learner, SystemTerms.Learner);
    const batchSingular = getTerminology(ContentTerms.Batch, SystemTerms.Batch);
    const batchPlural = getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch);
    const inviteSingular = getTerminology(OtherTerms.Invite, SystemTerms.Invite);
    const invitePlural = getTerminologyPlural(OtherTerms.Invite, SystemTerms.Invite);

    const onSubmit = async (values: CouponFormValues) => {
        const appliedDiscount: AppliedDiscountInput = {
            discount_type: values.discountType,
            discount_point: values.discountValue,
            max_discount_point:
                values.discountType === 'PERCENTAGE' ? values.maxDiscountValue ?? null : null,
        };

        const emails = values.isEmailRestricted ? parseEmails(values.allowedEmailsRaw) : [];
        const allowedEmailIdsJson = values.isEmailRestricted ? JSON.stringify(emails) : null;

        const scopePackageSessions =
            values.scope.mode === 'sessions' ? values.scope.packageSessionIds : [];
        const scopeInvites = values.scope.mode === 'invites' ? values.scope.enrollInviteIds : [];

        try {
            let saved: CouponDetail;
            if (isEdit && editing) {
                const updatePayload: CouponUpdateRequest = {
                    status: values.status,
                    redeem_start_date: values.redeemStartDate
                        ? new Date(values.redeemStartDate).toISOString()
                        : null,
                    redeem_end_date: new Date(values.redeemEndDate).toISOString(),
                    usage_limit: values.usageLimit ?? null,
                    is_email_restricted: values.isEmailRestricted,
                    allowed_email_ids: allowedEmailIdsJson,
                    applicable_package_session_ids: scopePackageSessions,
                    applicable_enroll_invite_ids: scopeInvites,
                    // Only send discount when un-frozen (pre-redemption)
                    applied_discount: isFrozen ? undefined : appliedDiscount,
                };
                saved = await updateMutation.mutateAsync({
                    couponId: editing.id,
                    payload: updatePayload,
                });
                toast.success('Coupon updated');
            } else {
                const createPayload: CouponCreateRequest = {
                    code: values.code,
                    status: values.status,
                    redeem_start_date: values.redeemStartDate
                        ? new Date(values.redeemStartDate).toISOString()
                        : null,
                    redeem_end_date: new Date(values.redeemEndDate).toISOString(),
                    usage_limit: values.usageLimit ?? null,
                    is_email_restricted: values.isEmailRestricted,
                    allowed_email_ids: allowedEmailIdsJson,
                    applicable_package_session_ids: scopePackageSessions,
                    applicable_enroll_invite_ids: scopeInvites,
                    applied_discount: appliedDiscount,
                };
                saved = await createMutation.mutateAsync(createPayload);
                toast.success(`Coupon "${saved.code}" created`);
            }
            onSaved?.(saved);
            onOpenChange(false);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                (err as Error)?.message ??
                'Could not save coupon';
            toast.error(message);
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;

    const footer = (
        <>
            <MyButton
                buttonType="secondary"
                scale="medium"
                onClick={() => onOpenChange(false)}
                type="button"
            >
                Cancel
            </MyButton>
            <MyButton
                buttonType="primary"
                scale="medium"
                onClick={form.handleSubmit(onSubmit)}
                disable={isPending}
                type="button"
            >
                {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create coupon'}
            </MyButton>
        </>
    );

    return (
        <MyDialog
            heading={isEdit ? `Edit coupon ${editing?.code}` : 'New coupon'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-3xl"
            footer={footer}
        >
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="grid gap-6 px-1 py-2 md:grid-cols-[1fr_280px]"
                >
                    {/* Left: form fields */}
                    <div className="space-y-6">
                        {/* Basics */}
                        <section className="space-y-3">
                            <h3 className="text-subtitle font-semibold text-neutral-800">Basics</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Coupon code</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="SAVE20"
                                                    disabled={isEdit}
                                                    className="font-mono uppercase"
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value.toUpperCase())
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="discountType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Discount type</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                disabled={isFrozen}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="PERCENTAGE">
                                                        Percentage (%)
                                                    </SelectItem>
                                                    <SelectItem value="FLAT">
                                                        Flat amount
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="discountValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Value {isPercentage ? '(%)' : '(₹)'}
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    max={isPercentage ? 100 : undefined}
                                                    placeholder={isPercentage ? '20' : '500'}
                                                    disabled={isFrozen}
                                                    value={field.value ?? ''}
                                                    onChange={(e) =>
                                                        field.onChange(
                                                            e.target.value === ''
                                                                ? 0
                                                                : Number(e.target.value)
                                                        )
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {isPercentage && (
                                    <FormField
                                        control={form.control}
                                        name="maxDiscountValue"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max cap (₹)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min={0}
                                                        placeholder="1000"
                                                        disabled={isFrozen}
                                                        value={field.value ?? ''}
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                e.target.value === ''
                                                                    ? null
                                                                    : Number(e.target.value)
                                                            )
                                                        }
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        </section>

                        {/* Validity */}
                        <section className="space-y-3">
                            <h3 className="text-subtitle font-semibold text-neutral-800">
                                Validity
                            </h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="redeemStartDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Start date{' '}
                                                <span className="text-caption text-neutral-400">
                                                    (optional)
                                                </span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="date"
                                                    disabled={isFrozen}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="redeemEndDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>End date</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="date" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="usageLimit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Usage limit{' '}
                                            <span className="text-caption text-neutral-400">
                                                (blank = unlimited)
                                            </span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                step={1}
                                                placeholder="Unlimited"
                                                value={field.value ?? ''}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value === ''
                                                            ? null
                                                            : Number(e.target.value)
                                                    )
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </section>

                        {/* Email restriction */}
                        <section className="space-y-3">
                            <FormField
                                control={form.control}
                                name="isEmailRestricted"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-md border border-neutral-200 bg-white p-3">
                                        <div>
                                            <FormLabel className="cursor-pointer">
                                                Restrict to specific emails
                                            </FormLabel>
                                            <p className="text-caption text-neutral-500">
                                                Only listed {learnerSingular.toLowerCase()} emails
                                                can apply this coupon
                                            </p>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {watchedValues.isEmailRestricted && (
                                <FormField
                                    control={form.control}
                                    name="allowedEmailsRaw"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Allowed emails</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    rows={3}
                                                    placeholder="alice@example.com, bob@example.com"
                                                    className="font-mono text-caption"
                                                />
                                            </FormControl>
                                            <p className="mt-1 text-caption text-neutral-400">
                                                {parseEmails(field.value).length} email
                                                {parseEmails(field.value).length === 1
                                                    ? ''
                                                    : 's'}{' '}
                                                captured
                                            </p>
                                        </FormItem>
                                    )}
                                />
                            )}
                        </section>

                        {/* Scope */}
                        <section className="space-y-3">
                            <h3 className="text-subtitle font-semibold text-neutral-800">
                                Where it applies
                                {isFrozen && (
                                    <span className="ml-2 text-caption font-normal text-neutral-400">
                                        (locked — coupon has been redeemed)
                                    </span>
                                )}
                            </h3>
                            <FormField
                                control={form.control}
                                name="scope"
                                render={({ field }) => (
                                    <FormItem>
                                        <CouponScopePicker
                                            instituteId={instituteId}
                                            value={field.value}
                                            onChange={field.onChange}
                                            disabled={isFrozen}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </section>
                    </div>

                    {/* Right: live preview */}
                    <aside className="space-y-3 rounded-lg border border-primary-100 bg-primary-50/30 p-4">
                        <div className="flex items-center gap-2 text-primary-700">
                            <Sparkle size={18} weight="fill" />
                            <h4 className="text-subtitle font-semibold">
                                {learnerSingular} preview
                            </h4>
                        </div>
                        <div className="rounded-md border border-success-200 bg-success-50 px-3 py-2">
                            <div className="flex items-center gap-2 text-success-700">
                                {isPercentage ? <Percent size={14} /> : <Receipt size={14} />}
                                <span className="font-mono text-caption font-semibold">
                                    {watchedValues.code || 'YOURCODE'}
                                </span>
                            </div>
                            <p className="mt-1 text-caption text-success-700">
                                {formatPreview(watchedValues)}
                            </p>
                        </div>
                        <dl className="space-y-2 text-caption">
                            <div className="flex justify-between">
                                <dt className="text-neutral-500">Status</dt>
                                <dd className="font-medium text-neutral-700">
                                    {watchedValues.status}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-neutral-500">Usage</dt>
                                <dd className="font-medium text-neutral-700">
                                    {editing?.usage_count ?? 0} / {watchedValues.usageLimit ?? '∞'}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-neutral-500">Scope</dt>
                                <dd className="text-right font-medium text-neutral-700">
                                    {watchedValues.scope.mode === 'all'
                                        ? 'Institute-wide'
                                        : watchedValues.scope.mode === 'sessions'
                                          ? `${watchedValues.scope.packageSessionIds.length} ${
                                                watchedValues.scope.packageSessionIds.length === 1
                                                    ? batchSingular.toLowerCase()
                                                    : batchPlural.toLowerCase()
                                            }`
                                          : `${watchedValues.scope.enrollInviteIds.length} ${
                                                watchedValues.scope.enrollInviteIds.length === 1
                                                    ? inviteSingular.toLowerCase()
                                                    : invitePlural.toLowerCase()
                                            }`}
                                </dd>
                            </div>
                            {watchedValues.isEmailRestricted && (
                                <div className="flex justify-between">
                                    <dt className="text-neutral-500">Email-restricted</dt>
                                    <dd className="font-medium text-neutral-700">
                                        {parseEmails(watchedValues.allowedEmailsRaw).length} allowed
                                    </dd>
                                </div>
                            )}
                        </dl>
                        {isFrozen && (
                            <p
                                className={cn(
                                    'rounded-md border border-warning-400 bg-warning-100 px-3 py-2',
                                    'text-caption text-warning-600'
                                )}
                            >
                                This coupon has been redeemed. Discount and scope are locked; you
                                can still extend the end date, raise the usage limit, or change
                                status.
                            </p>
                        )}
                    </aside>
                </form>
            </Form>
        </MyDialog>
    );
};
