/**
 * Onboarding Flows — list page. Institutes define ordered checklists a
 * lead/student goes through between "agreed to join" and "fully enrolled".
 * Gated behind ONBOARDING_SETTING.enabled (useOnboardingSettings).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Lock, Plus, Path, PencilSimple, TrashSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { MyDialog } from '@/components/design-system/dialog';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useOnboardingSettings } from '@/hooks/use-onboarding-settings';
import { CreateFlowDialog } from './create-flow-dialog';
import {
    archiveOnboardingFlow,
    fetchOnboardingFlows,
    onboardingFlowsKey,
    type OnboardingFlowDTO,
} from '../-services/onboarding-service';

function StatusBadge({ status, t }: { status: string; t: TFunction }) {
    const toneClass =
        status === 'ACTIVE'
            ? 'bg-success-50 text-success-700'
            : status === 'ARCHIVED'
              ? 'bg-neutral-100 text-neutral-500'
              : 'bg-warning-50 text-warning-700';
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${toneClass}`}>
            {status === 'DRAFT'
                ? t('statusLabels.draft')
                : status === 'ACTIVE'
                  ? t('statusLabels.active')
                  : t('statusLabels.archived')}
        </span>
    );
}

export function OnboardingFlowsPage() {
    const { t } = useTranslation('audienceManagerOnboardingFlowsPage');
    const setNavHeading = useNavHeadingStore((s) => s.setNavHeading);
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('navHeading.onboarding')}</h1>);
    }, [setNavHeading, t]);

    const navigate = useNavigate();
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';
    const { enabled: onboardingEnabled, isLoading: settingsLoading } = useOnboardingSettings();
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<OnboardingFlowDTO | null>(null);
    const queryClient = useQueryClient();

    const flowsQuery = useQuery({
        queryKey: onboardingFlowsKey(instituteId),
        queryFn: () => fetchOnboardingFlows(instituteId),
        enabled: !!instituteId && onboardingEnabled,
        staleTime: 60 * 1000,
    });

    const { mutate: archiveFlow, isPending: isArchiving } = useMutation({
        mutationFn: (flowId: string) => archiveOnboardingFlow(flowId),
        onSuccess: () => {
            toast.success(t('toasts.deleted'));
            setDeleteTarget(null);
            queryClient.invalidateQueries({ queryKey: onboardingFlowsKey(instituteId) });
        },
        onError: () => {
            toast.error(t('toasts.deleteError'));
        },
    });

    const columns = useMemo<ColumnDef<OnboardingFlowDTO>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('columns.name'),
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
                header: t('columns.description'),
                size: 560,
                cell: ({ row }) => (
                    <div className="truncate text-body text-neutral-600" title={row.original.description ?? ''}>
                        {row.original.description || '—'}
                    </div>
                ),
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                size: 140,
                cell: ({ row }) => <StatusBadge status={row.original.status} t={t} />,
            },
            {
                id: 'stepCount',
                header: t('columns.steps'),
                size: 100,
                cell: ({ row }) => (
                    <div className="text-body text-neutral-700">{row.original.steps?.length ?? 0}</div>
                ),
            },
            {
                id: 'actions',
                header: t('columns.actions'),
                size: 200,
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
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
                            <PencilSimple size={14} /> {t('actions.manage')}
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            className="text-danger-600 hover:text-danger-700"
                            onClick={() => setDeleteTarget(row.original)}
                        >
                            <TrashSimple size={14} />
                        </MyButton>
                    </div>
                ),
            },
        ],
        [navigate, t]
    );

    if (settingsLoading) {
        return (
            <div className="flex min-h-64 items-center justify-center text-body text-neutral-500">
                {t('loading')}
            </div>
        );
    }

    if (!onboardingEnabled) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 p-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100">
                    <Lock size={24} className="text-neutral-500" />
                </div>
                <h2 className="text-h3 font-medium text-neutral-900">{t('notEnabled.title')}</h2>
                <p className="text-subtitle text-neutral-500">
                    {t('notEnabled.prefix')}{' '}
                    <span className="font-medium">{t('notEnabled.settingsPath')}</span>.
                </p>
            </div>
        );
    }

    // Archived flows stay in the DB (instances still reference them) but drop out of this
    // list once deleted, since fetchOnboardingFlows(instituteId) with no status returns every
    // status and there's no separate "show archived" toggle in v1.
    const flows = (flowsQuery.data ?? []).filter((f) => f.status !== 'ARCHIVED');

    return (
        <div className="flex flex-col gap-4 p-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-h1 font-medium text-neutral-900">{t('page.title')}</h1>
                    <p className="text-subtitle text-neutral-500">{t('page.subtitle')}</p>
                </div>
                <MyButton buttonType="primary" scale="medium" onClick={() => setCreateOpen(true)}>
                    <Plus size={16} weight="bold" /> {t('actions.createFlow')}
                </MyButton>
            </div>

            {!instituteId ? (
                <div className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-body text-warning-700">
                    {t('states.noInstitute')}
                </div>
            ) : flowsQuery.isError ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-8 text-center">
                    <p className="text-body text-danger-700">{t('states.loadError')}</p>
                    <MyButton buttonType="secondary" scale="small" onClick={() => flowsQuery.refetch()}>
                        {t('actions.retry')}
                    </MyButton>
                </div>
            ) : !flowsQuery.isLoading && flows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-neutral-200 bg-white py-16 text-center shadow-sm">
                    <div className="flex size-16 items-center justify-center rounded-full border border-neutral-100 bg-neutral-50">
                        <Path size={32} className="text-neutral-400" weight="duotone" />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900">{t('states.emptyTitle')}</h3>
                    <p className="max-w-sm text-body text-neutral-500">{t('states.emptyDescription')}</p>
                    <MyButton buttonType="primary" scale="medium" onClick={() => setCreateOpen(true)}>
                        <Plus size={16} weight="bold" /> {t('actions.createFlow')}
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

            <MyDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                heading={t('deleteDialog.heading')}
                dialogWidth="max-w-md"
                footer={
                    <div className="flex w-full items-center justify-end gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setDeleteTarget(null)}
                            disable={isArchiving}
                        >
                            {t('actions.cancel')}
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            className="bg-danger-600 hover:bg-danger-700"
                            onClick={() => deleteTarget && archiveFlow(deleteTarget.id)}
                            disable={isArchiving}
                        >
                            {isArchiving ? t('actions.deleting') : t('actions.deleteFlow')}
                        </MyButton>
                    </div>
                }
            >
                <div className="px-6 py-6 text-body text-neutral-600">
                    {t('deleteDialog.confirmPrefix')}{' '}
                    <span className="font-medium text-neutral-900">{deleteTarget?.name}</span>
                    {t('deleteDialog.confirmSuffix')}
                </div>
            </MyDialog>
        </div>
    );
}

