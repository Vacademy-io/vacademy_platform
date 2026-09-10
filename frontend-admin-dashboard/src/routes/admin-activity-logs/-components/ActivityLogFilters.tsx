import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ArrowsClockwise,
    X,
    FunnelSimple,
    DownloadSimple,
    Stack,
    Lightning,
    UserCircle,
} from '@phosphor-icons/react';
import {
    MultiSelectFilter,
    type MultiSelectOption,
} from '@/components/shared/leads/multi-select-filter';
import { ChipsWrapper } from '@/components/design-system/chips';
import {
    exportActivityLogsCsv,
    type AdminActivityLogFilters,
} from '@/services/admin-activity-logs/getActivityLogs';
import { useActivityLogActors } from '@/services/admin-activity-logs/getActivityLogActors';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
    value: AdminActivityLogFilters;
    onChange: (next: Partial<AdminActivityLogFilters>) => void;
    /** Reset every filter. Owned by the page so the empty state can call it too. */
    onClear: () => void;
    onRefresh: () => void;
    isFetching: boolean;
}

// Dropdown choices. Each `value` is an entity_type the backend emits from an
// @Auditable annotation; `label` is what an institute owner reads. The list has
// to stay complete: a resource missing here is a resource nobody can filter by,
// and it was for a long time — AuditableAnnotationContractTest (admin_core_service)
// now fails the build when a new entityType or action lands without an entry.
function buildResourceGroups(t: TFunction): { group: string; options: MultiSelectOption[] }[] {
    return [
        {
            group: t('resourceGroups.crm.group'),
            options: [
                { value: 'AUDIENCE', label: t('resourceGroups.crm.AUDIENCE') },
                { value: 'LEAD', label: t('resourceGroups.crm.LEAD') },
                { value: 'LEAD_STATUS', label: t('resourceGroups.crm.LEAD_STATUS') },
                { value: 'LEAD_FOLLOWUP', label: t('resourceGroups.crm.LEAD_FOLLOWUP') },
                { value: 'LEAD_SLA_CONFIG', label: t('resourceGroups.crm.LEAD_SLA_CONFIG') },
                { value: 'LEAD_CONNECTOR', label: t('resourceGroups.crm.LEAD_CONNECTOR') },
                { value: 'ENQUIRY', label: t('resourceGroups.crm.ENQUIRY') },
                { value: 'COUNSELLOR', label: t('resourceGroups.crm.COUNSELLOR') },
                { value: 'COUNSELLOR_POOL', label: t('resourceGroups.crm.COUNSELLOR_POOL') },
                { value: 'COUNSELLOR_TARGET', label: t('resourceGroups.crm.COUNSELLOR_TARGET') },
                {
                    value: 'COUNSELLOR_WORKBENCH_CONFIG',
                    label: t('resourceGroups.crm.COUNSELLOR_WORKBENCH_CONFIG'),
                },
                { value: 'TAG', label: t('resourceGroups.crm.TAG') },
                { value: 'TELEPHONY_CONFIG', label: t('resourceGroups.crm.TELEPHONY_CONFIG') },
                { value: 'TELEPHONY_NUMBER', label: t('resourceGroups.crm.TELEPHONY_NUMBER') },
                {
                    value: 'ENGAGEMENT_ENGINE',
                    label: t('resourceGroups.crm.ENGAGEMENT_ENGINE'),
                },
                { value: 'AUTOMATION', label: t('resourceGroups.crm.AUTOMATION') },
            ],
        },
        {
            group: t('resourceGroups.learning.group'),
            options: [
                { value: 'COURSE', label: t('resourceGroups.learning.COURSE') },
                { value: 'LIVE_SESSION', label: t('resourceGroups.learning.LIVE_SESSION') },
                { value: 'LEARNER', label: t('resourceGroups.learning.LEARNER') },
                { value: 'GUARDIAN_LINK', label: t('resourceGroups.learning.GUARDIAN_LINK') },
                {
                    value: 'INSTITUTE_SETTING',
                    label: t('resourceGroups.learning.INSTITUTE_SETTING'),
                },
            ],
        },
        {
            group: t('resourceGroups.mentorship.group'),
            options: [
                { value: 'MENTOR', label: t('resourceGroups.mentorship.MENTOR') },
                {
                    value: 'MENTOR_ASSIGNMENT',
                    label: t('resourceGroups.mentorship.MENTOR_ASSIGNMENT'),
                },
                {
                    value: 'MENTOR_REQUEST',
                    label: t('resourceGroups.mentorship.MENTOR_REQUEST'),
                },
                {
                    value: 'MENTOR_SESSION',
                    label: t('resourceGroups.mentorship.MENTOR_SESSION'),
                },
                { value: 'BOOKING_PAGE', label: t('resourceGroups.mentorship.BOOKING_PAGE') },
                {
                    value: 'BOOKING_INSTANCE',
                    label: t('resourceGroups.mentorship.BOOKING_INSTANCE'),
                },
            ],
        },
        {
            group: t('resourceGroups.people.group'),
            options: [
                { value: 'HR_EMPLOYEE', label: t('resourceGroups.people.HR_EMPLOYEE') },
                {
                    value: 'HR_EMPLOYEE_BANK',
                    label: t('resourceGroups.people.HR_EMPLOYEE_BANK'),
                },
                {
                    value: 'HR_EMPLOYEE_DOCUMENT',
                    label: t('resourceGroups.people.HR_EMPLOYEE_DOCUMENT'),
                },
                { value: 'HR_DEPARTMENT', label: t('resourceGroups.people.HR_DEPARTMENT') },
                { value: 'HR_DESIGNATION', label: t('resourceGroups.people.HR_DESIGNATION') },
                { value: 'HR_TEACHING', label: t('resourceGroups.people.HR_TEACHING') },
                { value: 'HR_ATTENDANCE', label: t('resourceGroups.people.HR_ATTENDANCE') },
                {
                    value: 'HR_ATTENDANCE_CONFIG',
                    label: t('resourceGroups.people.HR_ATTENDANCE_CONFIG'),
                },
                {
                    value: 'HR_ATTENDANCE_REGULARIZATION',
                    label: t('resourceGroups.people.HR_ATTENDANCE_REGULARIZATION'),
                },
                { value: 'HR_SHIFT', label: t('resourceGroups.people.HR_SHIFT') },
                { value: 'HR_HOLIDAY', label: t('resourceGroups.people.HR_HOLIDAY') },
                { value: 'HR_LEAVE', label: t('resourceGroups.people.HR_LEAVE') },
                {
                    value: 'HR_LEAVE_BALANCE',
                    label: t('resourceGroups.people.HR_LEAVE_BALANCE'),
                },
                { value: 'HR_PAYROLL_RUN', label: t('resourceGroups.people.HR_PAYROLL_RUN') },
                {
                    value: 'HR_PAYROLL_ENTRY',
                    label: t('resourceGroups.people.HR_PAYROLL_ENTRY'),
                },
                {
                    value: 'HR_PAYROLL_ADJUSTMENT',
                    label: t('resourceGroups.people.HR_PAYROLL_ADJUSTMENT'),
                },
                {
                    value: 'HR_PAYROLL_FNF',
                    label: t('resourceGroups.people.HR_PAYROLL_FNF'),
                },
                { value: 'HR_PAYSLIP', label: t('resourceGroups.people.HR_PAYSLIP') },
                {
                    value: 'HR_SALARY_COMPONENT',
                    label: t('resourceGroups.people.HR_SALARY_COMPONENT'),
                },
                {
                    value: 'HR_SALARY_STRUCTURE',
                    label: t('resourceGroups.people.HR_SALARY_STRUCTURE'),
                },
                {
                    value: 'HR_SALARY_TEMPLATE',
                    label: t('resourceGroups.people.HR_SALARY_TEMPLATE'),
                },
                { value: 'HR_LOAN', label: t('resourceGroups.people.HR_LOAN') },
                {
                    value: 'HR_REIMBURSEMENT',
                    label: t('resourceGroups.people.HR_REIMBURSEMENT'),
                },
                { value: 'HR_INCENTIVE', label: t('resourceGroups.people.HR_INCENTIVE') },
                { value: 'HR_BONUS', label: t('resourceGroups.people.HR_BONUS') },
                {
                    value: 'HR_BANK_EXPORT',
                    label: t('resourceGroups.people.HR_BANK_EXPORT'),
                },
                {
                    value: 'HR_TAX_CONFIG',
                    label: t('resourceGroups.people.HR_TAX_CONFIG'),
                },
                {
                    value: 'HR_TAX_DECLARATION',
                    label: t('resourceGroups.people.HR_TAX_DECLARATION'),
                },
                {
                    value: 'HR_TDS_CHALLAN',
                    label: t('resourceGroups.people.HR_TDS_CHALLAN'),
                },
                { value: 'HR_FORM16', label: t('resourceGroups.people.HR_FORM16') },
                { value: 'HR_FORM24Q', label: t('resourceGroups.people.HR_FORM24Q') },
                { value: 'HR_PF_ECR', label: t('resourceGroups.people.HR_PF_ECR') },
                {
                    value: 'HR_ESI_RETURN',
                    label: t('resourceGroups.people.HR_ESI_RETURN'),
                },
                {
                    value: 'HR_PT_RETURN',
                    label: t('resourceGroups.people.HR_PT_RETURN'),
                },
                { value: 'HR_WPS', label: t('resourceGroups.people.HR_WPS') },
                {
                    value: 'HR_EOSB_PROVISION',
                    label: t('resourceGroups.people.HR_EOSB_PROVISION'),
                },
            ],
        },
        {
            group: t('resourceGroups.finance.group'),
            options: [
                { value: 'ERP_JOURNAL', label: t('resourceGroups.finance.ERP_JOURNAL') },
                {
                    value: 'ERP_FINANCE_PNL',
                    label: t('resourceGroups.finance.ERP_FINANCE_PNL'),
                },
            ],
        },
    ];
}

function buildActivityOptions(t: TFunction): MultiSelectOption[] {
    return [
        { value: 'CREATE', label: t('activityOptions.CREATE') },
        { value: 'UPDATE', label: t('activityOptions.UPDATE') },
        { value: 'DELETE', label: t('activityOptions.DELETE') },
        { value: 'RESTORE', label: t('activityOptions.RESTORE') },
        { value: 'BULK_CREATE', label: t('activityOptions.BULK_CREATE') },
        { value: 'BULK_UPDATE', label: t('activityOptions.BULK_UPDATE') },
        { value: 'IMPORT', label: t('activityOptions.IMPORT') },
        { value: 'EXPORT', label: t('activityOptions.EXPORT') },
        { value: 'DOWNLOAD', label: t('activityOptions.DOWNLOAD') },
        { value: 'PURGE', label: t('activityOptions.PURGE') },
        { value: 'ASSIGN', label: t('activityOptions.ASSIGN') },
        { value: 'UNASSIGN', label: t('activityOptions.UNASSIGN') },
        { value: 'REASSIGN', label: t('activityOptions.REASSIGN') },
        { value: 'BULK_ROUND_ROBIN', label: t('activityOptions.BULK_ROUND_ROBIN') },
        { value: 'STATUS_CHANGE', label: t('activityOptions.STATUS_CHANGE') },
        { value: 'TIER_CHANGE', label: t('activityOptions.TIER_CHANGE') },
        { value: 'SCORE_CHANGE', label: t('activityOptions.SCORE_CHANGE') },
        { value: 'CONVERT', label: t('activityOptions.CONVERT') },
        { value: 'SEND_MESSAGE', label: t('activityOptions.SEND_MESSAGE') },
        { value: 'EMAIL', label: t('activityOptions.EMAIL') },
        { value: 'CLOSE', label: t('activityOptions.CLOSE') },
        { value: 'RESCHEDULE', label: t('activityOptions.RESCHEDULE') },
        { value: 'ESCALATE', label: t('activityOptions.ESCALATE') },
        { value: 'TAG_USERS', label: t('activityOptions.TAG_USERS') },
        { value: 'UNTAG_USERS', label: t('activityOptions.UNTAG_USERS') },
        { value: 'TRIGGER', label: t('activityOptions.TRIGGER') },
        { value: 'ADD_MEMBER', label: t('activityOptions.ADD_MEMBER') },
        { value: 'REMOVE_MEMBER', label: t('activityOptions.REMOVE_MEMBER') },
        { value: 'MEMBER_STATUS_CHANGE', label: t('activityOptions.MEMBER_STATUS_CHANGE') },
        { value: 'AUTONOMY_CHANGE', label: t('activityOptions.AUTONOMY_CHANGE') },
        { value: 'RESUBSCRIBE', label: t('activityOptions.RESUBSCRIBE') },
        { value: 'RECALCULATE_SCORES', label: t('activityOptions.RECALCULATE_SCORES') },
        { value: 'ATTACH', label: t('activityOptions.ATTACH') },
        { value: 'ENROLL', label: t('activityOptions.ENROLL') },
        { value: 'CANCEL', label: t('activityOptions.CANCEL') },
        { value: 'TERMINATE', label: t('activityOptions.TERMINATE') },
        { value: 'MAKE_INACTIVE', label: t('activityOptions.MAKE_INACTIVE') },
        { value: 'MAKE_ACTIVE', label: t('activityOptions.MAKE_ACTIVE') },
        { value: 'UPDATE_BATCH', label: t('activityOptions.UPDATE_BATCH') },
        { value: 'ADD_EXPIRY', label: t('activityOptions.ADD_EXPIRY') },
        { value: 'UPDATE_STATUS', label: t('activityOptions.UPDATE_STATUS') },
        { value: 'ACCESS_CHANGE', label: t('activityOptions.ACCESS_CHANGE') },
        { value: 'SHARE_CREDENTIALS', label: t('activityOptions.SHARE_CREDENTIALS') },
        { value: 'EXPORT_CREDENTIALS', label: t('activityOptions.EXPORT_CREDENTIALS') },
        { value: 'DEACTIVATE', label: t('activityOptions.DEACTIVATE') },
        {
            value: 'PROVISION_BOOKING_PAGE',
            label: t('activityOptions.PROVISION_BOOKING_PAGE'),
        },
        { value: 'APPROVE', label: t('activityOptions.APPROVE') },
        { value: 'REJECT', label: t('activityOptions.REJECT') },
        { value: 'DECLINE', label: t('activityOptions.DECLINE') },
        { value: 'VERIFY', label: t('activityOptions.VERIFY') },
        { value: 'HOLD', label: t('activityOptions.HOLD') },
        { value: 'RELEASE', label: t('activityOptions.RELEASE') },
        { value: 'PROCESS', label: t('activityOptions.PROCESS') },
        { value: 'PREPARE', label: t('activityOptions.PREPARE') },
        { value: 'GENERATE', label: t('activityOptions.GENERATE') },
        { value: 'MATERIALIZE', label: t('activityOptions.MATERIALIZE') },
        { value: 'PAY_MATERIALIZE', label: t('activityOptions.PAY_MATERIALIZE') },
        { value: 'MARK_PAID', label: t('activityOptions.MARK_PAID') },
        { value: 'ADJUST', label: t('activityOptions.ADJUST') },
        { value: 'ACCRUE', label: t('activityOptions.ACCRUE') },
        { value: 'BULK_MARK', label: t('activityOptions.BULK_MARK') },
        { value: 'ATTENDANCE_SYNC', label: t('activityOptions.ATTENDANCE_SYNC') },
        { value: 'CREATE_FROM_STAFF', label: t('activityOptions.CREATE_FROM_STAFF') },
        { value: 'YEAR_END', label: t('activityOptions.YEAR_END') },
    ];
}

/**
 * Local, not UTC. The table prints timestamps in the reader's own timezone, so
 * a range picked here has to mean the same days they can see — and the "To"
 * day is inclusive, which is what "logs up to today" plainly means. Sending
 * midnight would silently drop everything that happened on the last day.
 */
const startOfDay = (value: string): number | undefined => {
    if (!value) return undefined;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
};

const endOfDay = (value: string): number | undefined => {
    if (!value) return undefined;
    const parsed = new Date(`${value}T23:59:59.999`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
};

const toDateInput = (epochMs: number | undefined): string => {
    if (!epochMs) return '';
    const date = new Date(epochMs);
    if (Number.isNaN(date.getTime())) return '';
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

const daysAgoRange = (days: number): { startDate: number; endDate: number } => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return { startDate: start.getTime(), endDate: end.getTime() };
};

function buildDatePresets(
    t: TFunction
): { label: string; range: () => { startDate: number; endDate: number } }[] {
    return [
        { label: t('datePresets.today'), range: () => daysAgoRange(1) },
        { label: t('datePresets.last7Days'), range: () => daysAgoRange(7) },
        { label: t('datePresets.last30Days'), range: () => daysAgoRange(30) },
    ];
}

/** Drops one value from a multi-select, collapsing an emptied list to undefined
 *  so the query param disappears instead of being sent empty. */
const without = (values: string[] | undefined, value: string): string[] | undefined => {
    const next = (values ?? []).filter((candidate) => candidate !== value);
    return next.length > 0 ? next : undefined;
};

const countActiveFilters = (value: AdminActivityLogFilters): number =>
    (value.entityTypes?.length ?? 0) +
    (value.actions?.length ?? 0) +
    (value.actorIds?.length ?? 0) +
    (value.startDate ? 1 : 0) +
    (value.endDate ? 1 : 0);

export function ActivityLogFilters({ value, onChange, onClear, onRefresh, isFetching }: Props) {
    const { t } = useTranslation('adminActivityLogsActivityLogFilters');
    const activeCount = countActiveFilters(value);
    const actorsQuery = useActivityLogActors();

    const resourceGroups = useMemo(() => buildResourceGroups(t), [t]);
    const resourceOptions: MultiSelectOption[] = useMemo(
        () =>
            resourceGroups.flatMap((section) =>
                section.options.map((option) => ({ ...option, sublabel: section.group }))
            ),
        [resourceGroups]
    );
    const resourceLabels: Record<string, string> = useMemo(
        () => Object.fromEntries(resourceOptions.map((option) => [option.value, option.label])),
        [resourceOptions]
    );

    const activityOptions: MultiSelectOption[] = useMemo(() => buildActivityOptions(t), [t]);
    const activityLabels: Record<string, string> = useMemo(
        () => Object.fromEntries(activityOptions.map((option) => [option.value, option.label])),
        [activityOptions]
    );

    const datePresets = useMemo(() => buildDatePresets(t), [t]);

    const actorOptions: MultiSelectOption[] = useMemo(() => {
        const known = (actorsQuery.data ?? []).map((actor) => ({
            value: actor.id,
            label: actor.fullName,
            sublabel: actor.email ?? undefined,
        }));
        // An id that came in on the URL but is not on the current roster (a
        // teammate who has since left) still has to render as a removable chip,
        // otherwise the filter looks broken.
        const knownIds = new Set(known.map((option) => option.value));
        const orphans = (value.actorIds ?? [])
            .filter((id) => !knownIds.has(id))
            .map((id) => ({ value: id, label: id, sublabel: t('noLongerOnTeam') }));
        return [...known, ...orphans];
    }, [actorsQuery.data, value.actorIds, t]);

    const actorLabels = useMemo(
        () => Object.fromEntries(actorOptions.map((option) => [option.value, option.label])),
        [actorOptions]
    );

    // Presets compare against the exact range they would produce, so the pill
    // lights up only while the filter still matches it.
    const activePreset = datePresets.find((preset) => {
        if (!value.startDate || !value.endDate) return false;
        const range = preset.range();
        return range.startDate === value.startDate && range.endDate === value.endDate;
    });

    // MyButton's onAsyncClick owns the spinner and the double-submit guard, so
    // this only has to do the work and report the outcome.
    const handleExport = async () => {
        try {
            await exportActivityLogsCsv({
                entityTypes: value.entityTypes,
                actions: value.actions,
                actorIds: value.actorIds,
                entityId: value.entityId,
                startDate: value.startDate,
                endDate: value.endDate,
            });
            toast.success(t('toasts.exportSuccess'));
        } catch (e) {
            toast.error(t('toasts.exportError'));
            // eslint-disable-next-line no-console
            console.error('Activity logs CSV export failed', e);
        }
    };

    return (
        <Card className="border-gray-200 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FunnelSimple className="size-4" />
                        {t('filters')}
                        {activeCount > 0 && (
                            <Badge variant="secondary" className="ms-1">
                                {t('activeCount', { count: activeCount })}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {activeCount > 0 && (
                            <MyButton
                                buttonType="text"
                                scale="medium"
                                className="sm:!min-w-0"
                                onClick={onClear}
                            >
                                <X className="me-1 size-4" /> {t('clear')}
                            </MyButton>
                        )}
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            className="sm:!min-w-0"
                            onClick={onRefresh}
                            disable={isFetching}
                        >
                            <ArrowsClockwise
                                className={cn('me-1 size-4', isFetching && 'animate-spin')}
                            />
                            {t('refresh')}
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            className="sm:!min-w-0"
                            onAsyncClick={handleExport}
                            loadingText={t('exporting')}
                            title={t('exportCsvTitle')}
                        >
                            <DownloadSimple className="me-1 size-4" />
                            {t('exportCsv')}
                        </MyButton>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <MultiSelectFilter
                        label={t('anyResource')}
                        icon={<Stack className="size-4 text-neutral-500" />}
                        options={resourceOptions}
                        selected={value.entityTypes ?? []}
                        onChange={(values) =>
                            onChange({ entityTypes: values.length ? values : undefined })
                        }
                        placeholder={t('searchResources')}
                        widthClass="w-48"
                        showSelectedLabel
                    />
                    <MultiSelectFilter
                        label={t('anyActivity')}
                        icon={<Lightning className="size-4 text-neutral-500" />}
                        options={activityOptions}
                        selected={value.actions ?? []}
                        onChange={(values) =>
                            onChange({ actions: values.length ? values : undefined })
                        }
                        placeholder={t('searchActivities')}
                        widthClass="w-48"
                        showSelectedLabel
                    />
                    <MultiSelectFilter
                        label={actorsQuery.isLoading ? t('loadingTeam') : t('anyoneOnTeam')}
                        icon={<UserCircle className="size-4 text-neutral-500" />}
                        options={actorOptions}
                        selected={value.actorIds ?? []}
                        onChange={(values) =>
                            onChange({ actorIds: values.length ? values : undefined })
                        }
                        placeholder={t('searchByNameOrEmail')}
                        widthClass="w-56"
                        showSelectedLabel
                    />

                    <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
                        {datePresets.map((preset) => {
                            const isActive = activePreset?.label === preset.label;
                            return (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() =>
                                        isActive
                                            ? onChange({
                                                  startDate: undefined,
                                                  endDate: undefined,
                                              })
                                            : onChange(preset.range())
                                    }
                                    className={cn(
                                        'rounded px-2 py-1.5 text-xs font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary-50 text-primary-500'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    )}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-end gap-2">
                        <Field label={t('from')}>
                            <Input
                                type="date"
                                className="h-10 w-40"
                                value={toDateInput(value.startDate)}
                                onChange={(e) =>
                                    onChange({ startDate: startOfDay(e.target.value) })
                                }
                            />
                        </Field>
                        <Field label={t('to')}>
                            <Input
                                type="date"
                                className="h-10 w-40"
                                value={toDateInput(value.endDate)}
                                onChange={(e) => onChange({ endDate: endOfDay(e.target.value) })}
                            />
                        </Field>
                    </div>
                </div>

                {activeCount > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2.5">
                        {(value.actorIds ?? []).map((id) => (
                            <FilterChip
                                key={`actor-${id}`}
                                label={actorLabels[id] ?? id}
                                onRemove={() => onChange({ actorIds: without(value.actorIds, id) })}
                            />
                        ))}
                        {(value.entityTypes ?? []).map((type) => (
                            <FilterChip
                                key={`resource-${type}`}
                                label={resourceLabels[type] ?? type}
                                onRemove={() =>
                                    onChange({ entityTypes: without(value.entityTypes, type) })
                                }
                                t={t}
                            />
                        ))}
                        {(value.actions ?? []).map((action) => (
                            <FilterChip
                                key={`action-${action}`}
                                label={activityLabels[action] ?? action}
                                onRemove={() =>
                                    onChange({ actions: without(value.actions, action) })
                                }
                                t={t}
                            />
                        ))}
                        {(value.startDate || value.endDate) && (
                            <FilterChip
                                label={`${toDateInput(value.startDate) || t('dateRangeAny')} → ${
                                    toDateInput(value.endDate) || t('dateRangeNow')
                                }`}
                                onRemove={() =>
                                    onChange({ startDate: undefined, endDate: undefined })
                                }
                                t={t}
                            />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * One applied filter, removable. Built on ChipsWrapper rather than Chips
 * because the canonical Chips takes only a static trailing icon, and this chip
 * needs that icon to be the remove control.
 */
function FilterChip({
    label,
    onRemove,
    t,
}: {
    label: string;
    onRemove: () => void;
    t: TFunction;
}) {
    return (
        <ChipsWrapper className="max-w-xs rounded-full pe-1 text-caption">
            <span className="truncate">{label}</span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={t('removeFilter', { label })}
                className="rounded-full p-0.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
                <X className="size-3" />
            </button>
        </ChipsWrapper>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            {label}
            {children}
        </label>
    );
}
