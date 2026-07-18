/**
 * Onboarding Flows — list page. Institutes define ordered checklists a
 * lead/student goes through between "agreed to join" and "fully enrolled".
 * Gated behind ONBOARDING_SETTING.enabled (useOnboardingSettings).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Lock, Plus, Path, PencilSimple } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useOnboardingSettings } from '@/hooks/use-onboarding-settings';
import { CreateFlowDialog } from './create-flow-dialog';
import {
    fetchOnboardingFlows,
    onboardingFlowsKey,
    type OnboardingFlowDTO,
} from '../-services/onboarding-service';

function StatusBadge({ status }: { status: string }) {
    const toneClass =
        status === 'ACTIVE'
            ? 'bg-success-50 text-success-700'
            : status === 'ARCHIVED'
              ? 'bg-neutral-100 text-neutral-500'
              : 'bg-warning-50 text-warning-700';
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${toneClass}`}>
            {status === 'DRAFT' ? 'Draft' : status === 'ACTIVE' ? 'Active' : 'Archived'}
        </span>
    );
}

export function OnboardingFlowsPage() {
    const setNavHeading = useNavHeadingStore((s) => s.setNavHeading);
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Onboarding</h1>);
    }, [setNavHeading]);

    const navigate = useNavigate();
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';
    const { enabled: onboardingEnabled, isLoading: settingsLoading } = useOnboardingSettings();
    const [createOpen, setCreateOpen] = useState(false);

    const flowsQuery = useQuery({
        queryKey: onboardingFlowsKey(instituteId),
        queryFn: () => fetchOnboardingFlows(instituteId),
        enabled: !!instituteId && onboardingEnabled,
        staleTime: 60 * 1000,
    });

    const columns = useMemo<ColumnDef<OnboardingFlowDTO>[]>(
        () => [
            {
                accessorKey: 'name',
                header: 'Name',
                size: 280,
                cell: ({ row }) => (
                    <button
                        type="button"
                        onClick={() =>
                            navigate({
                                to: '/audience-manager/onboarding/$flowId',
                                params: { flowId: row.original.id },
                            })
                        }
                        className="text-left text-body font-medium text-primary-600 hover:underline"
                    >
                        {row.original.name}
                    </button>
                ),
            },
            {
                accessorKey: 'description',
                header: 'Description',
                size: 560,
                cell: ({ row }) => (
                    <div className="truncate text-body text-neutral-600" title={row.original.description ?? ''}>
                        {row.original.description || '—'}
                    </div>
                ),
            },
            {
                accessorKey: 'status',
                header: 'Status',
                size: 140,
                cell: ({ row }) => <StatusBadge status={row.original.status} />,
            },
            {
                id: 'stepCount',
                header: 'Steps',
                size: 100,
                cell: ({ row }) => (
                    <div className="text-body text-neutral-700">{row.original.steps?.length ?? 0}</div>
                ),
            },
            {
                id: 'actions',
                header: 'Actions',
                size: 160,
                cell: ({ row }) => (
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() =>
                            navigate({
                                to: '/audience-manager/onboarding/$flowId',
                                params: { flowId: row.original.id },
                            })
                        }
                    >
                        <PencilSimple size={14} /> Manage
                    </MyButton>
                ),
            },
        ],
        [navigate]
    );

    if (settingsLoading) {
        return (
            <div className="flex min-h-64 items-center justify-center text-body text-neutral-500">
                Loading…
            </div>
        );
    }

    if (!onboardingEnabled) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 p-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100">
                    <Lock size={24} className="text-neutral-500" />
                </div>
                <h2 className="text-h3 font-medium text-neutral-900">Onboarding Flows is not enabled</h2>
                <p className="text-subtitle text-neutral-500">
                    An admin can turn this on under{' '}
                    <span className="font-medium">Settings → Onboarding Settings</span>.
                </p>
            </div>
        );
    }

    const flows = flowsQuery.data ?? [];

    return (
        <div className="flex flex-col gap-4 p-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-h1 font-medium text-neutral-900">Onboarding Flows</h1>
                    <p className="text-subtitle text-neutral-500">
                        Ordered checklists a lead/student goes through between agreeing to join and
                        being fully enrolled.
                    </p>
                </div>
                <MyButton buttonType="primary" scale="medium" onClick={() => setCreateOpen(true)}>
                    <Plus size={16} weight="bold" /> Create Flow
                </MyButton>
            </div>

            {!instituteId ? (
                <div className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-body text-warning-700">
                    Pick an institute to view onboarding flows.
                </div>
            ) : flowsQuery.isError ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-8 text-center">
                    <p className="text-body text-danger-700">Couldn&apos;t load onboarding flows.</p>
                    <MyButton buttonType="secondary" scale="small" onClick={() => flowsQuery.refetch()}>
                        Retry
                    </MyButton>
                </div>
            ) : !flowsQuery.isLoading && flows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-neutral-200 bg-white py-16 text-center shadow-sm">
                    <div className="flex size-16 items-center justify-center rounded-full border border-neutral-100 bg-neutral-50">
                        <Path size={32} className="text-neutral-400" weight="duotone" />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900">No onboarding flows yet</h3>
                    <p className="max-w-sm text-body text-neutral-500">
                        Create your first flow to define the steps a lead or student completes on
                        the way to being fully enrolled.
                    </p>
                    <MyButton buttonType="primary" scale="medium" onClick={() => setCreateOpen(true)}>
                        <Plus size={16} weight="bold" /> Create Flow
                    </MyButton>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                    <MyTable<OnboardingFlowDTO>
                        data={{
                            content: flows,
                            total_pages: 1,
                            page_no: 0,
                            page_size: flows.length || 1,
                            total_elements: flows.length,
                            last: true,
                        }}
                        columns={columns}
                        isLoading={flowsQuery.isLoading}
                        error={flowsQuery.error}
                        currentPage={0}
                    />
                </div>
            )}

            <CreateFlowDialog
                instituteId={instituteId}
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(flow) =>
                    navigate({ to: '/audience-manager/onboarding/$flowId', params: { flowId: flow.id } })
                }
            />
        </div>
    );
}

