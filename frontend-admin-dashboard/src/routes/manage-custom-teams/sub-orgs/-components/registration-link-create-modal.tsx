import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CircleNotch, FilePdf, Plus, Trash } from '@phosphor-icons/react';

import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FileUploader } from '@/routes/instructor-copilot/-components/FileUploader';
import { useFileUpload } from '@/hooks/use-file-upload';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL, GET_INSTITUTE_VENDORS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import type { PackageSessionDTO } from '@/routes/admin-package-management/-types/package-types';
import { getAllRoles } from '../../-services/custom-team-services';
import {
    createRegistrationTemplate,
    type CreateRegistrationTemplateRequest,
    type RegistrationTemplateCustomField,
} from '../../-services/sub-org-registration-services';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getPaymentOptions } from '@/services/payment-options';
import type { PaymentOptionApi } from '@/types/payment';
import { formatPlanPrice } from '@/utils/finance-utils';

// Local package-session lookups — same inline pattern as create-sub-org-modal so this
// picker can't accidentally couple to the dashboard-wide package service call sites.
const fetchBatchesSummaryLocal = async (instituteId: string, statuses: string[]) => {
    const params = new URLSearchParams();
    statuses.forEach((s) => params.append('statuses', s));
    const url = `${BASE_URL}/admin-core-service/institute/v1/batches-summary/${instituteId}${
        params.toString() ? `?${params.toString()}` : ''
    }`;
    const response = await authenticatedAxiosInstance({ method: 'GET', url });
    return response.data;
};

const fetchCourseBatchesLocal = async (courseId: string): Promise<PackageSessionDTO[]> => {
    const url = `${BASE_URL}/admin-core-service/course/v1/${courseId}/batches`;
    const response = await authenticatedAxiosInstance({ method: 'GET', url });
    return response.data;
};

const ADMIN_PERMISSION_OPTIONS = ['FULL', 'CREATE_COURSE'] as const;

const FIELD_TYPE_OPTIONS = ['TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'DROPDOWN'] as const;
type FieldType = (typeof FIELD_TYPE_OPTIONS)[number];

interface BuilderField {
    name: string;
    type: FieldType;
    /** Comma-separated options; only used when type === 'DROPDOWN'. */
    optionsCsv: string;
    mandatory: boolean;
}

// NO CPO here on purpose — registration links only support FREE / ONE_TIME / SUBSCRIPTION.
const PAYMENT_TYPE_VALUES = ['FREE', 'ONE_TIME', 'SUBSCRIPTION'] as const;
type PaymentType = (typeof PAYMENT_TYPE_VALUES)[number];

const formSchema = z
    .object({
        name: z.string().min(1, 'Name is required'),
        memberCount: z.number().min(1, 'Must be at least 1').optional(),
        validityInDays: z.number().min(1, 'Must be at least 1 day').optional(),
        maxRegistrations: z.number().min(1, 'Must be at least 1').optional(),
        paymentType: z.enum(PAYMENT_TYPE_VALUES),
        // Required for ONE_TIME / SUBSCRIPTION — picked from the institute's existing
        // payment options (Payment Settings). FREE keeps the fresh-option backend path.
        paymentOptionId: z.string().optional(),
        vendor: z.string().optional(),
        vendorId: z.string().optional(),
        currency: z.string().optional(),
    })
    .refine((values) => values.paymentType === 'FREE' || !!values.paymentOptionId, {
        message: 'Select a payment option',
        path: ['paymentOptionId'],
    })
    .refine((values) => values.paymentType === 'FREE' || !!values.vendor, {
        message: 'A payment vendor is required for paid links',
        path: ['vendor'],
    });

type FormValues = z.infer<typeof formSchema>;

const numberOrUndefined = (value: unknown) =>
    value === '' || value === null || value === undefined || Number.isNaN(Number(value))
        ? undefined
        : Number(value);

interface RegistrationLinkCreateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RegistrationLinkCreateModal({
    open,
    onOpenChange,
}: RegistrationLinkCreateModalProps) {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId();
    const { uploadFile } = useFileUpload();

    const token = getTokenFromCookie(TokenKey.accessToken);
    const currentUserId = getTokenDecodedData(token)?.user ?? '';

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: '', paymentType: 'FREE' },
    });

    const [selectedPackageSessionIds, setSelectedPackageSessionIds] = useState<string[]>([]);
    const [selectedAuthRoles, setSelectedAuthRoles] = useState<string[]>(['ADMIN']);
    const [selectedTeamRoles, setSelectedTeamRoles] = useState<string[]>([]);
    const [selectedAdminPermissions, setSelectedAdminPermissions] = useState<string[]>(['FULL']);
    const [customFields, setCustomFields] = useState<BuilderField[]>([]);
    const [tncEnabled, setTncEnabled] = useState(false);
    const [tncFileId, setTncFileId] = useState<string | null>(null);
    const [tncFileName, setTncFileName] = useState<string>('');
    const [isUploadingTnc, setIsUploadingTnc] = useState(false);

    const courseLabel = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const coursesLabel = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);

    // Fetch packages + prefetch every package's sessions in parallel so the picker
    // renders the full (package · level · session) checkbox list immediately —
    // same flat pattern as create-sub-org-modal step 2.
    const { data: packagesSummary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['sub-org-packages-summary-local', instituteId],
        queryFn: () => fetchBatchesSummaryLocal(instituteId || '', ['ACTIVE']),
        enabled: open && !!instituteId,
    });

    const packageIds: string[] = (packagesSummary?.packages || []).map((p: { id: string }) => p.id);
    const sessionQueries = useQueries({
        queries: packageIds.map((pkgId: string) => ({
            queryKey: ['sub-org-package-sessions-local', pkgId],
            queryFn: () => fetchCourseBatchesLocal(pkgId),
            enabled: open && !!pkgId,
            staleTime: 30000,
        })),
    });
    const isLoadingSessions = isLoadingSummary || sessionQueries.some((q) => q.isLoading);

    type FlatRow = {
        packageId: string;
        packageName: string;
        packageSessionId: string;
        levelName: string;
        sessionName: string;
    };
    const flatRows: FlatRow[] = (packagesSummary?.packages || []).flatMap(
        (pkg: { id: string; name: string }, idx: number) => {
            const sessions = (sessionQueries[idx]?.data || []) as PackageSessionDTO[];
            return sessions.map((ps) => ({
                packageId: pkg.id,
                packageName: pkg.name || pkg.id,
                packageSessionId: ps.id,
                levelName: ps.level?.level_name || '—',
                sessionName: ps.session?.session_name || '—',
            }));
        }
    );

    const { data: rolesList = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: open,
    });

    // Fetch payment vendors for institute — same lookup as create-sub-org-modal step 3.
    const { data: vendorsList = [] } = useQuery<{ vendor: string; vendor_id: string }[]>({
        queryKey: ['institute-vendors', instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(
                `${GET_INSTITUTE_VENDORS}?instituteId=${instituteId}`
            );
            return response.data;
        },
        enabled: open && !!instituteId,
    });

    // Fetch the institute's existing payment options (Payment Settings) — the
    // registering sub-org admin pays via one of these for paid links.
    const { data: institutePaymentOptions = [], isLoading: isLoadingPaymentOptions } = useQuery<
        PaymentOptionApi[]
    >({
        queryKey: ['sub-org-institute-payment-options', instituteId],
        queryFn: () =>
            getPaymentOptions({
                types: ['ONE_TIME', 'SUBSCRIPTION', 'FREE'],
                source: 'INSTITUTE',
                source_id: instituteId || '',
                require_approval: true,
                not_require_approval: true,
            }),
        enabled: open && !!instituteId,
        staleTime: 30000,
    });

    const paymentType = form.watch('paymentType');
    const isPaid = paymentType === 'ONE_TIME' || paymentType === 'SUBSCRIPTION';
    const optionsForType = institutePaymentOptions.filter(
        (o) => o.status === 'ACTIVE' && o.type === paymentType
    );

    // Auto-select vendor when there's exactly one. `open` is a dep so a reopen after
    // resetAll re-stamps the (cached) single vendor back onto the form.
    useEffect(() => {
        if (open && vendorsList.length === 1 && vendorsList[0]) {
            form.setValue('vendor', vendorsList[0].vendor);
            form.setValue('vendorId', vendorsList[0].vendor_id);
        }
    }, [vendorsList, open, form]);

    const createMutation = useMutation({
        mutationFn: (payload: CreateRegistrationTemplateRequest) =>
            createRegistrationTemplate(instituteId || '', payload),
        onSuccess: (data) => {
            toast.success('Registration link created');
            if (data.invite_code) {
                toast.info(`Registration code: ${data.invite_code}`);
            }
            queryClient.invalidateQueries({
                queryKey: ['sub-org-registration-templates', instituteId],
            });
            resetAll();
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Failed to create registration link';
            toast.error(message);
        },
    });

    const resetAll = () => {
        form.reset({ name: '', paymentType: 'FREE' });
        setSelectedPackageSessionIds([]);
        setSelectedAuthRoles(['ADMIN']);
        setSelectedTeamRoles([]);
        setSelectedAdminPermissions(['FULL']);
        setCustomFields([]);
        setTncEnabled(false);
        setTncFileId(null);
        setTncFileName('');
    };

    const togglePackageSession = (id: string) => {
        setSelectedPackageSessionIds((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const toggleInList = (
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        value: string,
        checked: boolean
    ) => {
        setter((prev) =>
            checked ? Array.from(new Set([...prev, value])) : prev.filter((v) => v !== value)
        );
    };

    const addCustomField = () => {
        setCustomFields((prev) => [
            ...prev,
            { name: '', type: 'TEXT', optionsCsv: '', mandatory: false },
        ]);
    };

    const updateCustomField = (index: number, patch: Partial<BuilderField>) => {
        setCustomFields((prev) =>
            prev.map((field, i) => (i === index ? { ...field, ...patch } : field))
        );
    };

    const removeCustomField = (index: number) => {
        setCustomFields((prev) => prev.filter((_, i) => i !== index));
    };

    const handleTncFileSelected = async (file: File) => {
        if (file.type !== 'application/pdf') {
            toast.error('Only PDF files are supported');
            return;
        }
        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: setIsUploadingTnc,
                userId: currentUserId || 'admin',
                source: instituteId || 'FLOOR_DOCUMENTS',
                sourceId: 'SUB_ORG_REGISTRATION_TNC',
                publicUrl: true,
            });
            if (fileId && typeof fileId === 'string') {
                setTncFileId(fileId);
                setTncFileName(file.name);
                toast.success('T&C PDF uploaded');
            } else {
                toast.error('Upload did not return a file ID');
            }
        } catch {
            toast.error('Failed to upload T&C PDF');
        }
    };

    /**
     * Builds admin_core's InstituteCustomFieldDTO list. Outer keys snake_case; the
     * nested `custom_field` (common.dto.CustomFieldDTO, no @JsonNaming) is camelCase —
     * same shape the audience-campaign flow sends to the same backend DTO.
     * Field order = list order.
     */
    const buildInstituteCustomFields = (): RegistrationTemplateCustomField[] | undefined => {
        const cleaned = customFields
            .map((field) => ({ ...field, name: field.name.trim() }))
            .filter((field) => field.name.length > 0);
        if (cleaned.length === 0) return undefined;

        return cleaned.map((field, index) => {
            const options =
                field.type === 'DROPDOWN'
                    ? field.optionsCsv
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean)
                    : [];
            return {
                institute_id: instituteId || '',
                type: 'ENROLL_INVITE' as const,
                status: 'ACTIVE' as const,
                individual_order: index,
                is_mandatory: field.mandatory,
                custom_field: {
                    fieldName: field.name,
                    fieldType: field.type,
                    formOrder: index + 1,
                    isMandatory: field.mandatory,
                    ...(field.type === 'DROPDOWN' && {
                        // Same config JSON the invite/audience dropdown fields persist.
                        config: JSON.stringify(
                            options.map((value, i) => ({ id: i + 1, value, label: value }))
                        ),
                    }),
                },
            };
        });
    };

    const onSubmit = (values: FormValues) => {
        if (selectedPackageSessionIds.length === 0) {
            toast.error('Select at least one batch');
            return;
        }
        if (tncEnabled && !tncFileId) {
            toast.error('Upload a T&C PDF or disable the T&C step');
            return;
        }
        const invalidDropdown = customFields.find(
            (field) =>
                field.name.trim().length > 0 &&
                field.type === 'DROPDOWN' &&
                field.optionsCsv
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean).length === 0
        );
        if (invalidDropdown) {
            toast.error(`Add at least one option for dropdown field "${invalidDropdown.name}"`);
            return;
        }

        // FREE keeps the current fresh-option backend path — only paid links reuse an
        // existing institute payment option (+ gateway vendor).
        const isGatewayBacked =
            values.paymentType === 'ONE_TIME' || values.paymentType === 'SUBSCRIPTION';

        const payload: CreateRegistrationTemplateRequest = {
            name: values.name.trim(),
            package_session_ids: selectedPackageSessionIds,
            member_count: values.memberCount,
            validity_in_days: values.validityInDays,
            auth_roles: selectedAuthRoles.length > 0 ? selectedAuthRoles : undefined,
            admin_permissions:
                selectedAdminPermissions.length > 0 ? selectedAdminPermissions : undefined,
            allowed_team_roles: selectedTeamRoles.length > 0 ? selectedTeamRoles : undefined,
            tnc_file_id: tncEnabled && tncFileId ? tncFileId : undefined,
            max_registrations: values.maxRegistrations,
            institute_custom_fields: buildInstituteCustomFields(),
            payment_type: values.paymentType,
            payment_option_id: isGatewayBacked ? values.paymentOptionId : undefined,
            vendor: isGatewayBacked ? values.vendor : undefined,
            vendor_id: isGatewayBacked ? values.vendorId : undefined,
            currency: isGatewayBacked ? values.currency : undefined,
        };
        createMutation.mutate(payload);
    };

    const isPending = createMutation.isPending;

    return (
        <MyDialog
            heading="Create Registration Link"
            open={open}
            onOpenChange={(o) => {
                if (!o) resetAll();
                onOpenChange(o);
            }}
            dialogWidth="max-w-2xl"
        >
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* 1. Name */}
                <div className="space-y-2">
                    <Label htmlFor="registration-link-name">Name *</Label>
                    <Input
                        id="registration-link-name"
                        placeholder="e.g. Partner School Onboarding"
                        {...form.register('name')}
                    />
                    {form.formState.errors.name && (
                        <p className="text-sm text-danger-600">
                            {form.formState.errors.name.message}
                        </p>
                    )}
                </div>

                {/* 2. Courses (package-session picker) */}
                <div className="space-y-2">
                    <div>
                        <Label>{coursesLabel} *</Label>
                        <p className="text-xs text-muted-foreground">
                            Every sub-org registered via this link gets exactly these batches.
                        </p>
                    </div>
                    <ScrollArea className="h-72 rounded-md border p-3">
                        {isLoadingSessions && flatRows.length === 0 && (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                                <CircleNotch className="size-4 animate-spin" />
                                Loading batches...
                            </div>
                        )}
                        {!isLoadingSessions && flatRows.length === 0 && (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No batches found.
                            </p>
                        )}
                        {(packagesSummary?.packages || []).map(
                            (pkg: { id: string; name: string }) => {
                                const rows = flatRows.filter((r) => r.packageId === pkg.id);
                                if (rows.length === 0) return null;
                                return (
                                    <div key={pkg.id} className="mb-3">
                                        <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            {pkg.name}
                                        </p>
                                        <div className="space-y-1">
                                            {rows.map((row) => (
                                                <label
                                                    key={row.packageSessionId}
                                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                                                >
                                                    <Checkbox
                                                        checked={selectedPackageSessionIds.includes(
                                                            row.packageSessionId
                                                        )}
                                                        onCheckedChange={() =>
                                                            togglePackageSession(
                                                                row.packageSessionId
                                                            )
                                                        }
                                                    />
                                                    <span>
                                                        {row.levelName} - {row.sessionName}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                        )}
                    </ScrollArea>
                    {selectedPackageSessionIds.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {selectedPackageSessionIds.length} selected
                        </p>
                    )}
                </div>

                {/* 3. Seat cap + validity */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="registration-link-seats">Seat limit</Label>
                        <Input
                            id="registration-link-seats"
                            type="number"
                            min={1}
                            placeholder="e.g. 10"
                            {...form.register('memberCount', { setValueAs: numberOrUndefined })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Maximum members per spawned sub-org.
                        </p>
                        {form.formState.errors.memberCount && (
                            <p className="text-sm text-danger-600">
                                {form.formState.errors.memberCount.message}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="registration-link-validity">Validity (days)</Label>
                        <Input
                            id="registration-link-validity"
                            type="number"
                            min={1}
                            placeholder="e.g. 365"
                            {...form.register('validityInDays', { setValueAs: numberOrUndefined })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Access duration for each spawned sub-org.
                        </p>
                        {form.formState.errors.validityInDays && (
                            <p className="text-sm text-danger-600">
                                {form.formState.errors.validityInDays.message}
                            </p>
                        )}
                    </div>
                </div>

                {/* 4. Payment */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div>
                            <Label>Payment type</Label>
                            <p className="text-xs text-muted-foreground">
                                What each organization pays when registering via this link.
                            </p>
                        </div>
                        <Select
                            value={paymentType}
                            onValueChange={(v) => {
                                form.setValue('paymentType', v as PaymentType);
                                // Options are type-scoped — clear so a stale pick from
                                // another type can't leak into the request.
                                form.setValue('paymentOptionId', undefined);
                                form.setValue('currency', undefined);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FREE">Free</SelectItem>
                                <SelectItem value="ONE_TIME">One-Time</SelectItem>
                                <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isPaid && (
                        <div className="space-y-2">
                            <div>
                                <Label>Payment option *</Label>
                                <p className="text-xs text-muted-foreground">
                                    The registering admin pays via this existing institute payment
                                    option. Price &amp; currency come from the option&apos;s plan.
                                </p>
                            </div>
                            <Select
                                value={form.watch('paymentOptionId') || ''}
                                onValueChange={(v) => {
                                    form.setValue('paymentOptionId', v, {
                                        shouldValidate: true,
                                    });
                                    const opt = optionsForType.find((o) => o.id === v);
                                    const cur = opt?.payment_plans?.[0]?.currency;
                                    if (cur) form.setValue('currency', cur);
                                }}
                                disabled={isLoadingPaymentOptions}
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={
                                            isLoadingPaymentOptions
                                                ? 'Loading payment options...'
                                                : optionsForType.length === 0
                                                  ? 'No active option found'
                                                  : 'Select a payment option'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {optionsForType.map((o) => {
                                        const plan = o.payment_plans?.[0];
                                        const priceLabel = plan
                                            ? ` — ${formatPlanPrice(plan.actual_price)} ${plan.currency || ''}`
                                            : '';
                                        return (
                                            <SelectItem key={o.id} value={o.id}>
                                                {o.name}
                                                {priceLabel}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            {!isLoadingPaymentOptions && optionsForType.length === 0 && (
                                <p className="text-sm text-amber-600">
                                    No active {paymentType.replace('_', '-').toLowerCase()} option —
                                    create one in Payment Settings.
                                </p>
                            )}
                            {form.formState.errors.paymentOptionId && (
                                <p className="text-sm text-danger-600">
                                    {form.formState.errors.paymentOptionId.message}
                                </p>
                            )}
                        </div>
                    )}

                    {isPaid && (
                        <div className="space-y-2">
                            <Label>Payment vendor</Label>
                            {vendorsList.length === 0 ? (
                                <p className="text-sm text-amber-600">
                                    No payment vendor found — configure a payment gateway in
                                    Settings first.
                                </p>
                            ) : vendorsList.length === 1 && vendorsList[0] ? (
                                <Input
                                    value={vendorsList[0].vendor}
                                    disabled
                                    className="bg-muted"
                                />
                            ) : (
                                <Select
                                    value={form.watch('vendor') || ''}
                                    onValueChange={(v) => {
                                        const selected = vendorsList.find((vl) => vl.vendor === v);
                                        form.setValue('vendor', v, { shouldValidate: true });
                                        form.setValue('vendorId', selected?.vendor_id || v);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select payment vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendorsList.map((v) => (
                                            <SelectItem key={v.vendor} value={v.vendor}>
                                                {v.vendor}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {form.formState.errors.vendor && (
                                <p className="text-sm text-danger-600">
                                    {form.formState.errors.vendor.message}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* 5. Roles + permissions */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div>
                            <Label>Admin roles (auth service)</Label>
                            <p className="text-xs text-muted-foreground">
                                Roles assigned to the admin who registers via this link.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 rounded-md border p-2">
                            {rolesList.map((role) => (
                                <label
                                    key={role.id}
                                    className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-muted"
                                >
                                    <Checkbox
                                        checked={selectedAuthRoles.includes(role.name)}
                                        onCheckedChange={(checked) =>
                                            toggleInList(
                                                setSelectedAuthRoles,
                                                role.name,
                                                checked === true
                                            )
                                        }
                                    />
                                    {role.name}
                                </label>
                            ))}
                            {rolesList.length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                    No roles found
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <Label>Allowed team roles</Label>
                            <p className="text-xs text-muted-foreground">
                                Roles the sub-org admin can assign to their own team. Leave empty to
                                allow any custom role.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 rounded-md border p-2">
                            {rolesList.map((role) => (
                                <label
                                    key={role.id}
                                    className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-muted"
                                >
                                    <Checkbox
                                        checked={selectedTeamRoles.includes(role.name)}
                                        onCheckedChange={(checked) =>
                                            toggleInList(
                                                setSelectedTeamRoles,
                                                role.name,
                                                checked === true
                                            )
                                        }
                                    />
                                    {role.name}
                                </label>
                            ))}
                            {rolesList.length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                    No roles found
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <Label>Admin permissions</Label>
                            <p className="text-xs text-muted-foreground">
                                What the sub-org admin can do. Leave empty to grant FULL access.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 rounded-md border p-2">
                            {ADMIN_PERMISSION_OPTIONS.map((perm) => (
                                <label
                                    key={perm}
                                    className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-muted"
                                >
                                    <Checkbox
                                        checked={selectedAdminPermissions.includes(perm)}
                                        onCheckedChange={(checked) =>
                                            toggleInList(
                                                setSelectedAdminPermissions,
                                                perm,
                                                checked === true
                                            )
                                        }
                                    />
                                    {perm === 'CREATE_COURSE' ? `Create ${courseLabel}` : perm}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 6. Custom form fields */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Registration form fields</Label>
                            <p className="text-xs text-muted-foreground">
                                Extra questions the registrant answers. Order follows this list.
                            </p>
                        </div>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            onClick={addCustomField}
                        >
                            <Plus className="mr-1 size-3" />
                            Add Field
                        </MyButton>
                    </div>
                    {customFields.length === 0 ? (
                        <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
                            No extra fields — the form only asks for organization and admin details.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {customFields.map((field, index) => (
                                <div key={index} className="space-y-2 rounded-md border p-3">
                                    <div className="flex items-center gap-2">
                                        <Input
                                            placeholder="Field name"
                                            value={field.name}
                                            onChange={(e) =>
                                                updateCustomField(index, {
                                                    name: e.target.value,
                                                })
                                            }
                                            className="flex-1"
                                        />
                                        <Select
                                            value={field.type}
                                            onValueChange={(v) =>
                                                updateCustomField(index, {
                                                    type: v as FieldType,
                                                })
                                            }
                                        >
                                            <SelectTrigger className="w-36">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {FIELD_TYPE_OPTIONS.map((type) => (
                                                    <SelectItem key={type} value={type}>
                                                        {type}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            scale="small"
                                            layoutVariant="icon"
                                            onClick={() => removeCustomField(index)}
                                            aria-label="Remove field"
                                        >
                                            <Trash className="size-4" />
                                        </MyButton>
                                    </div>
                                    {field.type === 'DROPDOWN' && (
                                        <Input
                                            placeholder="Options, comma separated (e.g. Small, Medium, Large)"
                                            value={field.optionsCsv}
                                            onChange={(e) =>
                                                updateCustomField(index, {
                                                    optionsCsv: e.target.value,
                                                })
                                            }
                                        />
                                    )}
                                    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={field.mandatory}
                                            onCheckedChange={(checked) =>
                                                updateCustomField(index, {
                                                    mandatory: checked === true,
                                                })
                                            }
                                        />
                                        Mandatory
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 7. Terms & Conditions */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label htmlFor="registration-link-tnc">Terms &amp; Conditions</Label>
                            <p className="text-xs text-muted-foreground">
                                Require registrants to accept a T&amp;C PDF before completing.
                            </p>
                        </div>
                        <Switch
                            id="registration-link-tnc"
                            checked={tncEnabled}
                            onCheckedChange={setTncEnabled}
                        />
                    </div>
                    {tncEnabled &&
                        (tncFileId ? (
                            <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                                <span className="flex min-w-0 items-center gap-2 text-sm">
                                    <FilePdf className="size-4 shrink-0 text-primary-500" />
                                    <span className="truncate">
                                        {tncFileName || 'T&C PDF uploaded'}
                                    </span>
                                </span>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => {
                                        setTncFileId(null);
                                        setTncFileName('');
                                    }}
                                >
                                    Remove
                                </MyButton>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <FileUploader
                                    onFileSelected={handleTncFileSelected}
                                    maxSize={10}
                                    acceptFormats={{ 'application/pdf': ['.pdf'] }}
                                    acceptMsg="Supported format: PDF"
                                />
                                {isUploadingTnc && (
                                    <p className="text-xs text-primary-500">Uploading PDF...</p>
                                )}
                            </div>
                        ))}
                </div>

                {/* 8. Max registrations */}
                <div className="space-y-2">
                    <Label htmlFor="registration-link-max">Max registrations</Label>
                    <Input
                        id="registration-link-max"
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        {...form.register('maxRegistrations', { setValueAs: numberOrUndefined })}
                    />
                    <p className="text-xs text-muted-foreground">
                        Maximum completed registrations through this link. Leave blank for
                        unlimited.
                    </p>
                    {form.formState.errors.maxRegistrations && (
                        <p className="text-sm text-danger-600">
                            {form.formState.errors.maxRegistrations.message}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t pt-4">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        onClick={() => {
                            resetAll();
                            onOpenChange(false);
                        }}
                        disable={isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="submit"
                        buttonType="primary"
                        disable={isPending || isUploadingTnc}
                    >
                        {isPending && <CircleNotch className="mr-2 size-4 animate-spin" />}
                        Create Registration Link
                    </MyButton>
                </div>
            </form>
        </MyDialog>
    );
}
