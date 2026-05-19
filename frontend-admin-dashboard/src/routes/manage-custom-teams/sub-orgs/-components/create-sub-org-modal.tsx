import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    createSubOrg,
    createSubOrgWithSubscription,
    createCustomRole,
    getAllRoles,
    type CreateSubOrgSubscriptionRequest,
} from '../../-services/custom-team-services';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UploadCloud, Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { PackageSessionDTO } from '@/routes/admin-package-management/-types/package-types';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSTITUTE_VENDORS, LOCAL_ADMIN_CORE_BASE } from '@/constants/urls';
import type { CPOListApiResponse } from '@/routes/financial-management/fee-plans/-types/cpo-types';

// Sub-org work is pinned to localhost:8072. The package picker must read from the
// same backend the sub-org will be created on, otherwise package_session_ids won't
// resolve at create time. Keep these local helpers inline so the rest of the
// dashboard's package-service calls (BASE_URL → staging) stay untouched.
const fetchBatchesSummaryLocal = async (instituteId: string, statuses: string[]) => {
    const params = new URLSearchParams();
    statuses.forEach((s) => params.append('statuses', s));
    const url = `${LOCAL_ADMIN_CORE_BASE}/admin-core-service/institute/v1/batches-summary/${instituteId}${
        params.toString() ? `?${params.toString()}` : ''
    }`;
    const response = await authenticatedAxiosInstance({ method: 'GET', url });
    return response.data;
};

const fetchCourseBatchesLocal = async (courseId: string): Promise<PackageSessionDTO[]> => {
    const url = `${LOCAL_ADMIN_CORE_BASE}/admin-core-service/course/v1/${courseId}/batches`;
    const response = await authenticatedAxiosInstance({ method: 'GET', url });
    return response.data;
};

const fetchInstituteCpoListLocal = async (
    instituteId: string,
    pageNo = 0,
    pageSize = 100
): Promise<CPOListApiResponse> => {
    const url = `${LOCAL_ADMIN_CORE_BASE}/admin-core-service/v1/fee-management/cpo/${instituteId}`;
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url,
        params: { pageNo, pageSize },
    });
    return response.data;
};

// Step 1 schema: Sub-Org details
const step1Schema = z.object({
    instituteName: z.string().min(1, 'Name is required'),
    instituteLogoFileId: z.string().optional(),
});

// Step 3 schema: Pricing & Seats
const step3Schema = z.object({
    paymentType: z.enum(['SUBSCRIPTION', 'ONE_TIME', 'FREE', 'CPO']),
    actualPrice: z.number().min(0).optional(),
    elevatedPrice: z.number().min(0).optional(),
    currency: z.string().optional(),
    memberCount: z.number().min(1, 'At least 1 seat required'),
    validityInDays: z.number().min(1, 'Validity must be at least 1 day'),
    vendor: z.string().optional(),
    vendorId: z.string().optional(),
    // Required when paymentType=CPO — picked from the institute's existing CPO list.
    complexPaymentOptionId: z.string().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step3Values = z.infer<typeof step3Schema>;

interface CreateSubOrgModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CreateSubOrgModal({ open, onOpenChange, onSuccess }: CreateSubOrgModalProps) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile, isUploading } = useFileUpload();
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [, setLocalUploading] = useState(false);

    const token = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(token);
    const currentUserId = tokenData?.user ?? '';
    const instituteId = getCurrentInstituteId();

    // Wizard state
    const [step, setStep] = useState(1);
    const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
    const [selectedPackageSessionIds, setSelectedPackageSessionIds] = useState<string[]>([]);
    const [selectedAuthRoles, setSelectedAuthRoles] = useState<string[]>([]);
    // Custom roles the sub-org admin will be allowed to pick when adding their team
    // members on /manage-suborg-teams. Persisted on settingJson.ALLOWED_TEAM_ROLES.
    // Empty = no restriction. Editable later via the sub-org detail modal.
    const [selectedTeamRoles, setSelectedTeamRoles] = useState<string[]>([]);
    const [showNewRoleInput, setShowNewRoleInput] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    // Step 1 form
    const step1Form = useForm<Step1Values>({
        resolver: zodResolver(step1Schema),
    });

    // Step 3 form
    const step3Form = useForm<Step3Values>({
        resolver: zodResolver(step3Schema),
        defaultValues: {
            paymentType: 'FREE',
            memberCount: 10,
            validityInDays: 365,
            currency: 'INR',
        },
    });

    // Fetch packages for step 2 — pinned to LOCAL_ADMIN_CORE_BASE so the IDs
    // match the local DB where the sub-org will be created.
    const { data: packagesSummary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['sub-org-packages-summary-local', instituteId],
        queryFn: () => fetchBatchesSummaryLocal(instituteId || '', ['ACTIVE']),
        enabled: open && step >= 2 && !!instituteId,
    });

    // Prefetch sessions for every package in parallel so the user sees the full
    // (package · level · session) list immediately as checkboxes — no click-to-expand
    // dance. This was the behaviour that broke against the local backend.
    const packageIds: string[] = (packagesSummary?.packages || []).map(
        (p: { id: string }) => p.id
    );
    const sessionQueries = useQueries({
        queries: packageIds.map((pkgId: string) => ({
            queryKey: ['sub-org-package-sessions-local', pkgId],
            queryFn: () => fetchCourseBatchesLocal(pkgId),
            enabled: open && step >= 2 && !!pkgId,
            staleTime: 30000,
        })),
    });
    const isLoadingSessions =
        isLoadingSummary || sessionQueries.some((q) => q.isLoading);

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

    // Fetch roles from parent institute
    const { data: rolesList = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: open,
    });

    // Fetch payment vendors for institute
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

    // Fetch institute CPOs — used to populate the picker when payment_type=CPO.
    // Pinned to LOCAL_ADMIN_CORE_BASE so the CPO IDs match the local DB.
    const { data: cpoListResponse, isLoading: isLoadingCpos } = useQuery({
        queryKey: ['sub-org-institute-cpo-list-local', instituteId],
        queryFn: () => fetchInstituteCpoListLocal(instituteId || '', 0, 100),
        enabled: open && step === 3 && !!instituteId,
        staleTime: 30000,
    });
    const cpoList = (cpoListResponse?.content || []).filter(
        (cpo) => cpo.status === 'ACTIVE'
    );

    // Auto-select vendor when there's exactly one
    useEffect(() => {
        if (vendorsList.length === 1 && vendorsList[0]) {
            step3Form.setValue('vendor', vendorsList[0].vendor);
            step3Form.setValue('vendorId', vendorsList[0].vendor_id);
        }
    }, [vendorsList]);

    // Mutation for subscription flow
    const subscriptionMutation = useMutation({
        mutationFn: createSubOrgWithSubscription,
        onSuccess: (data) => {
            toast.success('Sub-organization created with subscription');
            if (data.invite_code) {
                toast.info(`Invite code: ${data.invite_code}`);
            }
            queryClient.invalidateQueries({ queryKey: ['sub-orgs-list', instituteId] });
            resetWizard();
            onOpenChange(false);
            if (onSuccess) onSuccess();
        },
        onError: (error: any) => {
            toast.error(
                error?.response?.data?.message || 'Failed to create sub-organization'
            );
        },
    });

    // Fallback mutation for simple creation (no package sessions selected)
    const simpleMutation = useMutation({
        mutationFn: createSubOrg,
        onSuccess: () => {
            toast.success('Sub-organization created successfully');
            queryClient.invalidateQueries({ queryKey: ['sub-orgs-list', instituteId] });
            resetWizard();
            onOpenChange(false);
            if (onSuccess) onSuccess();
        },
        onError: (error: any) => {
            toast.error(
                error?.response?.data?.message || 'Failed to create sub-organization'
            );
        },
    });

    // Mutation for creating a new role
    const createRoleMutation = useMutation({
        mutationFn: (name: string) => createCustomRole({ name, permissionIds: ['109'] }),
        onSuccess: () => {
            toast.success('Role created successfully');
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setNewRoleName('');
            setShowNewRoleInput(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to create role');
        },
    });

    const handleCreateRole = () => {
        const trimmed = newRoleName.trim();
        if (!trimmed) {
            toast.error('Role name is required');
            return;
        }
        createRoleMutation.mutate(trimmed);
    };

    const resetWizard = () => {
        setStep(1);
        setStep1Data(null);
        setSelectedPackageSessionIds([]);
        setLogoPreview(null);
        setSelectedAuthRoles([]);
        setSelectedTeamRoles([]);
        setShowNewRoleInput(false);
        setNewRoleName('');
        step1Form.reset();
        step3Form.reset({
            paymentType: 'FREE',
            memberCount: 10,
            validityInDays: 365,
            currency: 'INR',
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);

        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: setLocalUploading,
                userId: currentUserId || 'admin',
                source: instituteId || 'FLOOR_DOCUMENTS',
                sourceId: 'STUDENTS',
                publicUrl: true,
            });

            if (fileId && typeof fileId === 'string') {
                step1Form.setValue('instituteLogoFileId', fileId);
                toast.success('Logo uploaded successfully');
            } else {
                toast.error('Upload did not return a file ID');
            }
        } catch {
            toast.error('Failed to upload logo');
        }
        e.target.value = '';
    };

    const handleStep1Next = (data: Step1Values) => {
        setStep1Data(data);
        setStep(2);
    };

    const handleStep2Next = () => {
        if (selectedPackageSessionIds.length === 0) {
            toast.error('Select at least one package session');
            return;
        }
        setStep(3);
    };

    const handleStep2Skip = () => {
        // No package sessions — just create simple sub-org
        if (!step1Data) return;
        simpleMutation.mutate({
            institute_name: step1Data.instituteName,
            institute_logo_file_id: step1Data.instituteLogoFileId,
        });
    };

    const handleFinalSubmit = (data: Step3Values) => {
        if (!step1Data) return;

        // CPO needs an explicit picker selection; price/vendor live on the CPO itself.
        if (data.paymentType === 'CPO' && !data.complexPaymentOptionId) {
            toast.error('Please select a fee structure (CPO) for the sub-org subscription');
            return;
        }

        const isGatewayBacked = data.paymentType === 'ONE_TIME' || data.paymentType === 'SUBSCRIPTION';

        const request: CreateSubOrgSubscriptionRequest = {
            sub_org_details: {
                institute_name: step1Data.instituteName,
                institute_logo_file_id: step1Data.instituteLogoFileId,
            },
            package_session_ids: selectedPackageSessionIds,
            payment_type: data.paymentType,
            actual_price: isGatewayBacked ? data.actualPrice : undefined,
            elevated_price: isGatewayBacked ? data.elevatedPrice : undefined,
            currency: isGatewayBacked ? data.currency : undefined,
            member_count: data.memberCount,
            validity_in_days: data.validityInDays,
            vendor: isGatewayBacked ? data.vendor : undefined,
            vendor_id: isGatewayBacked ? data.vendorId : undefined,
            auth_roles: selectedAuthRoles.length > 0 ? selectedAuthRoles : undefined,
            allowed_team_roles: selectedTeamRoles.length > 0 ? selectedTeamRoles : undefined,
            complex_payment_option_id:
                data.paymentType === 'CPO' ? data.complexPaymentOptionId : undefined,
        };
        subscriptionMutation.mutate(request);
    };

    const togglePackageSession = (id: string) => {
        setSelectedPackageSessionIds((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const isPending = subscriptionMutation.isPending || simpleMutation.isPending;
    const paymentType = step3Form.watch('paymentType');

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) resetWizard();
                onOpenChange(o);
            }}
        >
            <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden max-w-[425px] sm:max-w-[600px] md:max-w-[700px]">
                <DialogHeader className="shrink-0">
                    <DialogTitle>
                        {step === 1 && 'Create Sub-Organization'}
                        {step === 2 && 'Select Package Sessions'}
                        {step === 3 && 'Pricing & Seats'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1 && 'Step 1 of 3: Sub-organization details'}
                        {step === 2 && 'Step 2 of 3: Choose courses to assign'}
                        {step === 3 && 'Step 3 of 3: Configure pricing and seat limits'}
                    </DialogDescription>
                </DialogHeader>

                {/* Step indicators */}
                <div className="flex shrink-0 items-center justify-center gap-2 py-2">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                                s < step
                                    ? 'bg-green-500 text-white'
                                    : s === step
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {s < step ? <Check className="h-4 w-4" /> : s}
                        </div>
                    ))}
                </div>

                {/* Scrollable wizard body — wraps every step so a long Step 3 (with the
                    pricing options + admin roles + allowed team roles + summary + footer)
                    doesn't push the dialog past the viewport. Each step's <DialogFooter>
                    lives inside this scroll area too, matching the sub-org-detail modal. */}
                <div className="-mx-2 flex-1 overflow-y-auto px-2 pb-2">

                {/* STEP 1: Sub-Org Details */}
                {step === 1 && (
                    <Form {...step1Form}>
                        <form
                            onSubmit={step1Form.handleSubmit(handleStep1Next)}
                            className="space-y-4"
                        >
                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="flex flex-col items-center gap-2 sm:col-span-2">
                                    <Label className="text-sm font-medium">Logo</Label>
                                    <div className="relative flex h-28 w-28 flex-col items-center justify-center overflow-hidden rounded-full border border-input bg-muted">
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview}
                                                alt="Logo"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                <UploadCloud size={36} />
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={handleFileChange}
                                        disabled={isUploading}
                                        aria-label="Upload logo"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isUploading}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {isUploading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <UploadCloud className="mr-2 h-4 w-4" />
                                        )}
                                        {isUploading ? 'Uploading...' : 'Upload Logo'}
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        {...step1Form.register('instituteName')}
                                        placeholder="Sub-Org Name"
                                    />
                                    {step1Form.formState.errors.instituteName && (
                                        <p className="text-sm text-destructive">
                                            {step1Form.formState.errors.instituteName.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isUploading}>
                                    Next
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}

                {/* STEP 2: Package Session Selection — flat checkbox list, grouped by package */}
                {step === 2 && (
                    <div className="space-y-4">
                        <ScrollArea className="h-[300px] rounded-md border p-3">
                            {isLoadingSessions && flatRows.length === 0 && (
                                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading package sessions...
                                </div>
                            )}
                            {!isLoadingSessions && flatRows.length === 0 && (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No package sessions found.
                                </p>
                            )}
                            {(packagesSummary?.packages || []).map(
                                (pkg: { id: string; name: string }) => {
                                    const rows = flatRows.filter(
                                        (r) => r.packageId === pkg.id
                                    );
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
                                {selectedPackageSessionIds.length} session(s) selected
                            </p>
                        )}

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep(1)}
                            >
                                <ChevronLeft className="mr-1 h-4 w-4" />
                                Back
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleStep2Skip}
                                disabled={isPending}
                            >
                                {simpleMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Skip (No Subscription)
                            </Button>
                            <Button type="button" onClick={handleStep2Next}>
                                Next
                                <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* STEP 3: Pricing & Seats */}
                {step === 3 && (
                    <Form {...step3Form}>
                        <form
                            onSubmit={step3Form.handleSubmit(handleFinalSubmit)}
                            className="space-y-4"
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Payment Type</Label>
                                    <Select
                                        value={paymentType}
                                        onValueChange={(v) =>
                                            step3Form.setValue(
                                                'paymentType',
                                                v as 'SUBSCRIPTION' | 'ONE_TIME' | 'FREE' | 'CPO'
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FREE">Free</SelectItem>
                                            <SelectItem value="ONE_TIME">One-Time</SelectItem>
                                            <SelectItem value="SUBSCRIPTION">
                                                Subscription
                                            </SelectItem>
                                            <SelectItem value="CPO">
                                                CPO (Custom Fee Structure)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {paymentType === 'CPO' && (
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Fee Structure (CPO) *</Label>
                                        <p className="text-xs text-muted-foreground">
                                            The admin who joins via this invite pays the CPO
                                            installments. Learners ride free under the scoped
                                            invites.
                                        </p>
                                        <Select
                                            value={step3Form.watch('complexPaymentOptionId') || ''}
                                            onValueChange={(v) =>
                                                step3Form.setValue('complexPaymentOptionId', v)
                                            }
                                            disabled={isLoadingCpos}
                                        >
                                            <SelectTrigger>
                                                <SelectValue
                                                    placeholder={
                                                        isLoadingCpos
                                                            ? 'Loading fee structures...'
                                                            : cpoList.length === 0
                                                              ? 'No active fee structures found'
                                                              : 'Select a fee structure'
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cpoList.map((cpo) => (
                                                    <SelectItem key={cpo.id} value={cpo.id}>
                                                        {cpo.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {(paymentType === 'ONE_TIME' || paymentType === 'SUBSCRIPTION') && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Actual Price</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                {...step3Form.register('actualPrice', {
                                                    valueAsNumber: true,
                                                })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Elevated Price (MRP)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                {...step3Form.register('elevatedPrice', {
                                                    valueAsNumber: true,
                                                })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Currency</Label>
                                            <Select
                                                value={step3Form.watch('currency') || 'INR'}
                                                onValueChange={(v) =>
                                                    step3Form.setValue('currency', v)
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="INR">INR</SelectItem>
                                                    <SelectItem value="USD">USD</SelectItem>
                                                    <SelectItem value="AUD">AUD</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Payment Vendor</Label>
                                            {vendorsList.length === 0 ? (
                                                <p className="text-sm text-amber-600">
                                                    No payment vendor configured. Please link a payment vendor in Settings first.
                                                </p>
                                            ) : vendorsList.length === 1 && vendorsList[0] ? (
                                                <Input
                                                    value={vendorsList[0].vendor}
                                                    disabled
                                                    className="bg-muted"
                                                />
                                            ) : (
                                                <Select
                                                    value={step3Form.watch('vendor') || ''}
                                                    onValueChange={(v) => {
                                                        const selected = vendorsList.find(vl => vl.vendor === v);
                                                        step3Form.setValue('vendor', v);
                                                        step3Form.setValue('vendorId', selected?.vendor_id || v);
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
                                        </div>
                                    </>
                                )}

                                {/* Auth Roles for sub-org admin */}
                                <div className="space-y-2 sm:col-span-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label>Admin Roles (auth service)</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Roles assigned to users who join via this invite
                                            </p>
                                        </div>
                                        {!showNewRoleInput && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowNewRoleInput(true)}
                                            >
                                                <Plus className="mr-1 h-3 w-3" />
                                                Add New
                                            </Button>
                                        )}
                                    </div>
                                    {showNewRoleInput && (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="Enter role name"
                                                value={newRoleName}
                                                onChange={(e) => setNewRoleName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleCreateRole();
                                                    }
                                                }}
                                                disabled={createRoleMutation.isPending}
                                                className="h-8"
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleCreateRole}
                                                disabled={createRoleMutation.isPending}
                                            >
                                                {createRoleMutation.isPending ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    'Create'
                                                )}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowNewRoleInput(false);
                                                    setNewRoleName('');
                                                }}
                                                disabled={createRoleMutation.isPending}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 rounded-md border p-2">
                                        {rolesList.map((role) => (
                                            <label
                                                key={role.id}
                                                className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-muted"
                                            >
                                                <Checkbox
                                                    checked={selectedAuthRoles.includes(role.name)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedAuthRoles((prev) =>
                                                            checked
                                                                ? [...prev, role.name]
                                                                : prev.filter((r) => r !== role.name)
                                                        );
                                                    }}
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

                                {/* Allowed team roles — restricts which custom roles the
                                    sub-org admin can assign on /manage-suborg-teams.
                                    Empty = no restriction. Editable later from the sub-org
                                    detail modal. */}
                                <div className="space-y-2 sm:col-span-2">
                                    <div>
                                        <Label>Allowed team roles</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Roles the sub-org admin can pick when adding
                                            their own team members. Leave empty to allow
                                            any custom role.
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
                                                    onCheckedChange={(checked) => {
                                                        setSelectedTeamRoles((prev) =>
                                                            checked
                                                                ? [...prev, role.name]
                                                                : prev.filter((r) => r !== role.name)
                                                        );
                                                    }}
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
                                    <Label>Seat Limit</Label>
                                    <Input
                                        type="number"
                                        {...step3Form.register('memberCount', {
                                            valueAsNumber: true,
                                        })}
                                        placeholder="10"
                                    />
                                    {step3Form.formState.errors.memberCount && (
                                        <p className="text-sm text-destructive">
                                            {step3Form.formState.errors.memberCount.message}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Validity (Days)</Label>
                                    <Input
                                        type="number"
                                        {...step3Form.register('validityInDays', {
                                            valueAsNumber: true,
                                        })}
                                        placeholder="365"
                                    />
                                    {step3Form.formState.errors.validityInDays && (
                                        <p className="text-sm text-destructive">
                                            {step3Form.formState.errors.validityInDays.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="rounded-md border bg-muted/50 p-3 text-sm">
                                <p className="font-medium">Summary</p>
                                <p>
                                    Organization: {step1Data?.instituteName}
                                </p>
                                <p>
                                    Package Sessions: {selectedPackageSessionIds.length} selected
                                </p>
                                <p>
                                    Payment: {paymentType} | Seats:{' '}
                                    {step3Form.watch('memberCount')} | Validity:{' '}
                                    {step3Form.watch('validityInDays')} days
                                </p>
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setStep(2)}
                                    disabled={isPending}
                                >
                                    <ChevronLeft className="mr-1 h-4 w-4" />
                                    Back
                                </Button>
                                <Button type="submit" disabled={isPending}>
                                    {isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Create Sub-Organization
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
