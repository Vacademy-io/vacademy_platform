import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    CircleNotch,
    Copy,
    DownloadSimple,
    LinkSimple,
    PencilSimple,
    Plus,
    UsersThree,
} from '@phosphor-icons/react';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { MyPagination } from '@/components/design-system/pagination';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import createSubOrgRegistrationLink from '@/routes/manage-students/invite/-utils/createSubOrgRegistrationLink';
import {
    fetchAllTemplateRegistrations,
    getRegistrationTemplateDetail,
    listRegistrationTemplates,
    listTemplateRegistrations,
    updateRegistrationTemplateStatus,
    type RegistrationTemplateListItem,
    type SubOrgRegistrationRow,
    type TemplateDetail,
} from '../../-services/sub-org-registration-services';
import { RegistrationLinkCreateModal } from './registration-link-create-modal';

// The list response only carries `steps`; paid templates include a "PAYMENT" step and
// templates with DigiLocker identity verification include a "KYC" step.
const isPaidTemplate = (template: RegistrationTemplateListItem) =>
    Array.isArray(template.steps) && template.steps.includes('PAYMENT');

const hasKycStep = (template: RegistrationTemplateListItem) =>
    Array.isArray(template.steps) && template.steps.includes('KYC');

// PENDING | VERIFIED | CONSENT_DENIED | EXPIRED | FAILED → tinted outline chip classes.
const KYC_STATUS_CLASSES: Record<string, string> = {
    VERIFIED: 'border-success-400 bg-success-50 text-success-600',
    PENDING: 'border-warning-400 bg-warning-50 text-warning-600',
    CONSENT_DENIED: 'border-danger-400 bg-danger-50 text-danger-600',
    EXPIRED: 'border-danger-400 bg-danger-50 text-danger-600',
    FAILED: 'border-danger-400 bg-danger-50 text-danger-600',
};

const formatDate = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const REGISTRATIONS_CSV_HEADERS = [
    'Organization',
    'Admin',
    'Email',
    'Phone',
    'City',
    'State',
    'Pincode',
    'Seats Used',
    'Seats Total',
    'Status',
    'KYC',
    'Registered On',
] as const;

/** RFC-4180 escaping: quote when the value contains a comma, quote, or newline. */
const csvCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const buildRegistrationsCsv = (rows: SubOrgRegistrationRow[]): string => {
    const lines = [REGISTRATIONS_CSV_HEADERS.join(',')];
    rows.forEach((r) => {
        lines.push(
            [
                r.org_name,
                r.admin_name,
                r.admin_email,
                r.admin_phone,
                r.city,
                r.state,
                r.pincode,
                r.used_seats ?? '',
                r.total_seats ?? '',
                r.status,
                r.kyc_status ? r.kyc_status.replace(/_/g, ' ') : '',
                formatDate(r.created_at),
            ]
                .map(csvCell)
                .join(',')
        );
    });
    return lines.join('\n');
};

const downloadCsv = (csv: string, filename: string) => {
    // Prefix a BOM so Excel opens UTF-8 (accented city/org names) correctly.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export function RegistrationLinksTab() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    // Full detail of the template being edited — presence switches the modal to edit mode.
    const [editTemplate, setEditTemplate] = useState<TemplateDetail | null>(null);
    const [registrationsTemplate, setRegistrationsTemplate] =
        useState<RegistrationTemplateListItem | null>(null);

    const instituteId = getCurrentInstituteId();
    const queryClient = useQueryClient();
    const { instituteDetails } = useInstituteDetailsStore();

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['sub-org-registration-templates', instituteId],
        queryFn: () => listRegistrationTemplates(instituteId || ''),
        enabled: !!instituteId,
    });

    const statusMutation = useMutation({
        mutationFn: ({
            templateId,
            status,
        }: {
            templateId: string;
            status: 'ACTIVE' | 'INACTIVE';
        }) => updateRegistrationTemplateStatus(templateId, status, instituteId || ''),
        onSuccess: (data) => {
            toast.success(
                data.status === 'ACTIVE'
                    ? 'Registration link activated'
                    : 'Registration link deactivated'
            );
            queryClient.invalidateQueries({
                queryKey: ['sub-org-registration-templates', instituteId],
            });
        },
        onError: (error: unknown) => {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Failed to update status';
            toast.error(message);
        },
    });

    // Edit needs the full template config (the list rows only carry summary fields),
    // so fetch the detail on click, then open the modal in edit mode.
    const editDetailMutation = useMutation({
        mutationFn: (templateId: string) =>
            getRegistrationTemplateDetail(templateId, instituteId || ''),
        onSuccess: (detail) => {
            setEditTemplate(detail);
            setIsCreateModalOpen(true);
        },
        onError: (error: unknown) => {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Failed to load registration link details';
            toast.error(message);
        },
    });

    const copyLink = (inviteCode: string) => {
        const url = createSubOrgRegistrationLink(
            inviteCode,
            instituteDetails?.learner_portal_base_url
        );
        navigator.clipboard.writeText(url);
        toast.success('Registration link copied');
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-end">
                    <Skeleton className="h-9 w-52" />
                </div>
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <MyButton
                    onClick={() => {
                        setEditTemplate(null);
                        setIsCreateModalOpen(true);
                    }}
                >
                    <Plus className="mr-2 size-4" />
                    Create Registration Link
                </MyButton>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Link</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Registrations</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-neutral-500">
                                        <LinkSimple className="size-8 opacity-50" />
                                        <p>No registration links yet.</p>
                                        <p className="text-xs text-neutral-400">
                                            Create one to let organizations register themselves as
                                            sub-orgs.
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            templates.map((template) => {
                                const isRowUpdating =
                                    statusMutation.isPending &&
                                    statusMutation.variables?.templateId === template.id;
                                const isRowLoadingDetail =
                                    editDetailMutation.isPending &&
                                    editDetailMutation.variables === template.id;
                                return (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <span>{template.name || '-'}</span>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        isPaidTemplate(template)
                                                            ? 'border-primary-200 text-primary-500'
                                                            : 'text-muted-foreground'
                                                    }
                                                >
                                                    {isPaidTemplate(template) ? 'Paid' : 'Free'}
                                                </Badge>
                                                {hasKycStep(template) && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-muted-foreground"
                                                    >
                                                        KYC
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {template.invite_code ? (
                                                <button
                                                    type="button"
                                                    onClick={() => copyLink(template.invite_code)}
                                                    className="flex items-center gap-1 text-sm text-primary-500 hover:underline"
                                                    title="Copy registration link"
                                                >
                                                    <LinkSimple className="size-3.5" />
                                                    <span className="max-w-24 truncate">
                                                        {template.invite_code}
                                                    </span>
                                                    <Copy className="size-3" />
                                                </button>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={template.status === 'ACTIVE'}
                                                    disabled={isRowUpdating}
                                                    onCheckedChange={(checked) =>
                                                        statusMutation.mutate({
                                                            templateId: template.id,
                                                            status: checked ? 'ACTIVE' : 'INACTIVE',
                                                        })
                                                    }
                                                    aria-label={`Toggle ${template.name} status`}
                                                />
                                                <Badge
                                                    variant={
                                                        template.status === 'ACTIVE'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {template.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {template.completed_count ?? 0}
                                                {template.max_registrations
                                                    ? ` / ${template.max_registrations}`
                                                    : ` (${template.total_attempts ?? 0} attempts)`}
                                            </span>
                                        </TableCell>
                                        <TableCell>{formatDate(template.created_at)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <MyButton
                                                    buttonType="secondary"
                                                    scale="small"
                                                    onClick={() =>
                                                        editDetailMutation.mutate(template.id)
                                                    }
                                                    disable={editDetailMutation.isPending}
                                                >
                                                    {isRowLoadingDetail ? (
                                                        <CircleNotch className="mr-1 size-3.5 animate-spin" />
                                                    ) : (
                                                        <PencilSimple className="mr-1 size-3.5" />
                                                    )}
                                                    Edit
                                                </MyButton>
                                                <MyButton
                                                    buttonType="secondary"
                                                    scale="small"
                                                    onClick={() =>
                                                        setRegistrationsTemplate(template)
                                                    }
                                                >
                                                    <UsersThree className="mr-1 size-3.5" />
                                                    View
                                                </MyButton>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <RegistrationLinkCreateModal
                open={isCreateModalOpen}
                onOpenChange={(open) => {
                    setIsCreateModalOpen(open);
                    // Clear edit state on close so the next open starts a fresh create.
                    if (!open) setEditTemplate(null);
                }}
                editTemplate={editTemplate}
            />

            <RegistrationsDialog
                template={registrationsTemplate}
                onClose={() => setRegistrationsTemplate(null)}
            />
        </div>
    );
}

/** Rows-per-page for the registrations listing. */
const REGISTRATIONS_PAGE_SIZE = 10;

/** Read-only, paginated + City/State/Pincode-filterable list of the registrations made through one template link. */
function RegistrationsDialog({
    template,
    onClose,
}: {
    template: RegistrationTemplateListItem | null;
    onClose: () => void;
}) {
    const instituteId = getCurrentInstituteId();

    // Raw filter inputs (what the user types) vs the debounced values sent to the API.
    const [cityInput, setCityInput] = useState('');
    const [stateInput, setStateInput] = useState('');
    const [pincodeInput, setPincodeInput] = useState('');
    const [filters, setFilters] = useState({ city: '', state: '', pincode: '' });
    const [page, setPage] = useState(0);
    const [isExporting, setIsExporting] = useState(false);

    // Reset all filter + page state when a different template's dialog opens.
    useEffect(() => {
        setCityInput('');
        setStateInput('');
        setPincodeInput('');
        setFilters({ city: '', state: '', pincode: '' });
        setPage(0);
    }, [template?.id]);

    // Debounce the raw inputs (300ms) into the committed filters that drive the query.
    useEffect(() => {
        const timeout = setTimeout(() => {
            setFilters({
                city: cityInput.trim(),
                state: stateInput.trim(),
                pincode: pincodeInput.trim(),
            });
        }, 300);
        return () => clearTimeout(timeout);
    }, [cityInput, stateInput, pincodeInput]);

    // Any filter change jumps back to the first page.
    useEffect(() => {
        setPage(0);
    }, [filters]);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['sub-org-registrations', template?.id, instituteId, page, filters],
        queryFn: () =>
            listTemplateRegistrations({
                templateInviteId: template?.id || '',
                instituteId: instituteId || '',
                page,
                size: REGISTRATIONS_PAGE_SIZE,
                city: filters.city,
                state: filters.state,
                pincode: filters.pincode,
            }),
        enabled: !!template?.id && !!instituteId,
        placeholderData: keepPreviousData,
    });

    const registrations = data?.content ?? [];
    const totalPages = data?.total_pages ?? 1;
    const totalElements = data?.total_elements ?? 0;
    const hasActiveFilters = !!(filters.city || filters.state || filters.pincode);

    // Export ALL rows matching the current filters (not just the visible page).
    const handleExport = async () => {
        if (!template?.id || !instituteId) return;
        setIsExporting(true);
        try {
            const rows = await fetchAllTemplateRegistrations({
                templateInviteId: template.id,
                instituteId,
                city: filters.city,
                state: filters.state,
                pincode: filters.pincode,
            });
            if (rows.length === 0) {
                toast.info('No registrations to export.');
                return;
            }
            const safeName = (template.name || 'registrations').replace(/[^\w.-]+/g, '_');
            downloadCsv(buildRegistrationsCsv(rows), `${safeName}_registrations.csv`);
            toast.success(`Exported ${rows.length} registration${rows.length === 1 ? '' : 's'}.`);
        } catch {
            toast.error('Failed to export registrations.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <MyDialog
            heading={template ? `Registrations — ${template.name}` : 'Registrations'}
            open={!!template}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            dialogWidth="max-w-5xl"
        >
            <div className="space-y-3">
                {/* City / State / Pincode filters (address is collected when the link has
                    "Collect full address" on; rows show "-" for links that don't). */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-40">
                        <MyInput
                            inputType="text"
                            label="City"
                            inputPlaceholder="Filter by city"
                            input={cityInput}
                            onChangeFunction={(e) => setCityInput(e.target.value)}
                            size="small"
                        />
                    </div>
                    <div className="w-40">
                        <MyInput
                            inputType="text"
                            label="State"
                            inputPlaceholder="Filter by state"
                            input={stateInput}
                            onChangeFunction={(e) => setStateInput(e.target.value)}
                            size="small"
                        />
                    </div>
                    <div className="w-40">
                        <MyInput
                            inputType="text"
                            label="Pincode"
                            inputPlaceholder="Filter by pincode"
                            input={pincodeInput}
                            onChangeFunction={(e) => setPincodeInput(e.target.value)}
                            size="small"
                        />
                    </div>
                    {hasActiveFilters && (
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => {
                                setCityInput('');
                                setStateInput('');
                                setPincodeInput('');
                            }}
                        >
                            Clear
                        </MyButton>
                    )}
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        className="ml-auto"
                        onClick={handleExport}
                        disable={isExporting || totalElements === 0}
                    >
                        {isExporting ? (
                            <CircleNotch className="mr-1 size-3.5 animate-spin" />
                        ) : (
                            <DownloadSimple className="mr-1 size-3.5" />
                        )}
                        Export CSV
                    </MyButton>
                </div>

                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : registrations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-neutral-500">
                        <UsersThree className="size-8 opacity-50" />
                        <p className="text-sm">
                            {hasActiveFilters
                                ? 'No registrations match these filters.'
                                : 'No registrations through this link yet.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Organization</TableHead>
                                        <TableHead>Admin</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>City</TableHead>
                                        <TableHead>State</TableHead>
                                        <TableHead>Pincode</TableHead>
                                        <TableHead>Seats</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>KYC</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {registrations.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-medium">
                                                {row.org_name || '-'}
                                            </TableCell>
                                            <TableCell>{row.admin_name || '-'}</TableCell>
                                            <TableCell>{row.admin_email || '-'}</TableCell>
                                            <TableCell>{row.admin_phone || '-'}</TableCell>
                                            <TableCell>{row.city || '-'}</TableCell>
                                            <TableCell>{row.state || '-'}</TableCell>
                                            <TableCell>{row.pincode || '-'}</TableCell>
                                            <TableCell>
                                                {row.used_seats == null
                                                    ? '-'
                                                    : row.total_seats != null
                                                      ? `${row.used_seats}/${row.total_seats}`
                                                      : String(row.used_seats)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        row.status === 'COMPLETED'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {row.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {row.kyc_status ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            KYC_STATUS_CLASSES[row.kyc_status] ||
                                                            'text-muted-foreground'
                                                        }
                                                    >
                                                        {row.kyc_status.replace(/_/g, ' ')}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>{formatDate(row.created_at)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {totalPages > 1 && (
                            <div className={isFetching ? 'opacity-60' : ''}>
                                <MyPagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={setPage}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </MyDialog>
    );
}
