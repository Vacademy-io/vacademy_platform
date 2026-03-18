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
    getAllRoles,
    type CreateSubOrgSubscriptionRequest,
} from '../../-services/custom-team-services';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UploadCloud, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    fetchBatchesSummary,
    fetchCourseBatches,
} from '@/routes/admin-package-management/-services/package-service';
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
import { GET_INSTITUTE_VENDORS } from '@/constants/urls';

// Step 1 schema: Sub-Org details
const step1Schema = z.object({
    instituteName: z.string().min(1, 'Name is required'),
    instituteLogoFileId: z.string().optional(),
});

// Step 3 schema: Pricing & Seats
const step3Schema = z.object({
    paymentType: z.enum(['SUBSCRIPTION', 'ONE_TIME', 'FREE']),
    actualPrice: z.number().min(0).optional(),
    elevatedPrice: z.number().min(0).optional(),
    currency: z.string().optional(),
    memberCount: z.number().min(1, 'At least 1 seat required'),
    validityInDays: z.number().min(1, 'Validity must be at least 1 day'),
    vendor: z.string().optional(),
    vendorId: z.string().optional(),
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
    const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
    const [selectedAuthRoles, setSelectedAuthRoles] = useState<string[]>([]);

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

    // Fetch packages for step 2
    const { data: packagesSummary } = useQuery({
        queryKey: ['packages-summary'],
        queryFn: () => fetchBatchesSummary(['ACTIVE']),
        enabled: open && step >= 2,
    });

    // Fetch sessions for expanded package
    const { data: packageSessions = [], isLoading: isLoadingSessions } = useQuery<
        PackageSessionDTO[]
    >({
        queryKey: ['package-sessions', expandedPackageId],
        queryFn: () => fetchCourseBatches(expandedPackageId!),
        enabled: !!expandedPackageId,
    });

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

    const resetWizard = () => {
        setStep(1);
        setStep1Data(null);
        setSelectedPackageSessionIds([]);
        setExpandedPackageId(null);
        setLogoPreview(null);
        setSelectedAuthRoles([]);
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
        const request: CreateSubOrgSubscriptionRequest = {
            sub_org_details: {
                institute_name: step1Data.instituteName,
                institute_logo_file_id: step1Data.instituteLogoFileId,
            },
            package_session_ids: selectedPackageSessionIds,
            payment_type: data.paymentType,
            actual_price: data.paymentType !== 'FREE' ? data.actualPrice : undefined,
            elevated_price: data.paymentType !== 'FREE' ? data.elevatedPrice : undefined,
            currency: data.paymentType !== 'FREE' ? data.currency : undefined,
            member_count: data.memberCount,
            validity_in_days: data.validityInDays,
            vendor: data.vendor,
            vendor_id: data.vendorId,
            auth_roles: selectedAuthRoles.length > 0 ? selectedAuthRoles : undefined,
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
            <DialogContent className="w-[95vw] max-w-[425px] sm:max-w-[600px] md:max-w-[700px]">
                <DialogHeader>
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
                <div className="flex items-center justify-center gap-2 py-2">
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

                {/* STEP 2: Package Session Selection */}
                {step === 2 && (
                    <div className="space-y-4">
                        <ScrollArea className="h-[300px] rounded-md border p-3">
                            {packagesSummary?.packages?.length === 0 && (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No packages found.
                                </p>
                            )}
                            {packagesSummary?.packages?.map(
                                (pkg: { id: string; name: string }) => (
                                    <div key={pkg.id} className="mb-2">
                                        <button
                                            type="button"
                                            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                                            onClick={() =>
                                                setExpandedPackageId(
                                                    expandedPackageId === pkg.id
                                                        ? null
                                                        : pkg.id
                                                )
                                            }
                                        >
                                            <span>{pkg.name}</span>
                                            <ChevronRight
                                                className={`h-4 w-4 transition-transform ${
                                                    expandedPackageId === pkg.id
                                                        ? 'rotate-90'
                                                        : ''
                                                }`}
                                            />
                                        </button>
                                        {expandedPackageId === pkg.id && (
                                            <div className="ml-4 mt-1 space-y-1">
                                                {isLoadingSessions ? (
                                                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        Loading sessions...
                                                    </div>
                                                ) : packageSessions.length === 0 ? (
                                                    <p className="py-2 text-sm text-muted-foreground">
                                                        No sessions available.
                                                    </p>
                                                ) : (
                                                    packageSessions.map((ps) => (
                                                        <label
                                                            key={ps.id}
                                                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                                                        >
                                                            <Checkbox
                                                                checked={selectedPackageSessionIds.includes(
                                                                    ps.id
                                                                )}
                                                                onCheckedChange={() =>
                                                                    togglePackageSession(ps.id)
                                                                }
                                                            />
                                                            <span>
                                                                {ps.level?.level_name} -{' '}
                                                                {ps.session?.session_name}
                                                            </span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
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
                                                v as 'SUBSCRIPTION' | 'ONE_TIME' | 'FREE'
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
                                        </SelectContent>
                                    </Select>
                                </div>

                                {paymentType !== 'FREE' && (
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
                                    <Label>Admin Roles (auth service)</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Roles assigned to users who join via this invite
                                    </p>
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
            </DialogContent>
        </Dialog>
    );
}
