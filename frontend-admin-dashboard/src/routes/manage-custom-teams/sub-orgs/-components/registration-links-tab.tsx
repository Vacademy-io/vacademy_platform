import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, LinkSimple, Plus, UsersThree } from '@phosphor-icons/react';

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
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import createSubOrgRegistrationLink from '@/routes/manage-students/invite/-utils/createSubOrgRegistrationLink';
import {
    listRegistrationTemplates,
    listTemplateRegistrations,
    updateRegistrationTemplateStatus,
    type RegistrationTemplateListItem,
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

export function RegistrationLinksTab() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
                <MyButton onClick={() => setIsCreateModalOpen(true)}>
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
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                onClick={() => setRegistrationsTemplate(template)}
                                            >
                                                <UsersThree className="mr-1 size-3.5" />
                                                View
                                            </MyButton>
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
                onOpenChange={setIsCreateModalOpen}
            />

            <RegistrationsDialog
                template={registrationsTemplate}
                onClose={() => setRegistrationsTemplate(null)}
            />
        </div>
    );
}

/** Read-only list of the registrations made through one template link. */
function RegistrationsDialog({
    template,
    onClose,
}: {
    template: RegistrationTemplateListItem | null;
    onClose: () => void;
}) {
    const instituteId = getCurrentInstituteId();

    const { data: registrations = [], isLoading } = useQuery({
        queryKey: ['sub-org-registrations', template?.id, instituteId],
        queryFn: () => listTemplateRegistrations(template?.id || '', instituteId || ''),
        enabled: !!template?.id && !!instituteId,
    });

    return (
        <MyDialog
            heading={template ? `Registrations — ${template.name}` : 'Registrations'}
            open={!!template}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            dialogWidth="max-w-3xl"
        >
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            ) : registrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-neutral-500">
                    <UsersThree className="size-8 opacity-50" />
                    <p className="text-sm">No registrations through this link yet.</p>
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Organization</TableHead>
                                <TableHead>Admin</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Phone</TableHead>
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
                                    <TableCell>
                                        <Badge
                                            variant={
                                                row.status === 'COMPLETED' ? 'default' : 'secondary'
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
                                            <span className="text-sm text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{formatDate(row.created_at)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </MyDialog>
    );
}
