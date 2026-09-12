import { BulkAssignResponse, SelectedPackageSession } from '../../../../-types/bulk-assign-types';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, SkipForward } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import {
    ContentTerms,
    RoleTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';

interface Props {
    previewResponse: BulkAssignResponse;
    selectedPackageSessions: SelectedPackageSession[];
}

const buildStatusConfig = (t: TFunction) =>
    ({
        SUCCESS: {
            label: t('status.willEnroll'),
            icon: CheckCircle,
            className: 'text-success-600 bg-success-50',
            iconClass: 'text-success-500',
        },
        SKIPPED: {
            label: t('status.willSkip'),
            icon: SkipForward,
            className: 'text-warning-600 bg-warning-50',
            iconClass: 'text-warning-500',
        },
        FAILED: {
            label: t('status.willFail'),
            icon: XCircle,
            className: 'text-danger-600 bg-danger-50',
            iconClass: 'text-danger-500',
        },
    }) as const;

/** Human labels for `action_taken` — never show the raw enum value to the admin. */
const buildActionTakenLabels = (t: TFunction): Record<string, string> => ({
    CREATED: t('table.actionTaken.created'),
    RE_ENROLLED: t('table.actionTaken.reEnrolled'),
    NONE: t('table.emptyValue'),
});

export const Step4Preview = ({ previewResponse, selectedPackageSessions }: Props) => {
    const { t } = useTranslation('manageStudentsStep4Preview');
    const { summary, results } = previewResponse;
    const courseMap = Object.fromEntries(
        selectedPackageSessions.map((ps) => [ps.packageSessionId, ps])
    );

    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const levelTerm = getTerminology(ContentTerms.Level, SystemTerms.Level);
    const learnerTerm = getTerminology(RoleTerms.Learner, SystemTerms.Learner);
    const learnersTerm = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner);

    const statusConfig = buildStatusConfig(t);
    const actionTakenLabels = buildActionTakenLabels(t);
    const emptyValue = t('table.emptyValue');

    return (
        <div className="flex flex-col gap-5 px-6 py-5">
            {/* Summary banner */}
            <div className="grid grid-cols-4 gap-3">
                <SummaryCard
                    label={t('cards.total')}
                    value={summary.total_requested}
                    className="bg-neutral-50 text-neutral-700 border-neutral-200"
                />
                <SummaryCard
                    label={t('status.willEnroll')}
                    value={summary.successful}
                    className="bg-success-50 text-success-700 border-success-200"
                />
                <SummaryCard
                    label={t('status.willSkip')}
                    value={summary.skipped}
                    className="bg-warning-50 text-warning-700 border-warning-200"
                />
                <SummaryCard
                    label={t('status.willFail')}
                    value={summary.failed}
                    className="bg-danger-50 text-danger-700 border-danger-200"
                />
            </div>

            {summary.re_enrolled > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                    🔄 <strong>{summary.re_enrolled}</strong>{' '}
                    {t('reenrolledBanner', {
                        count: summary.re_enrolled,
                        term: (summary.re_enrolled !== 1
                            ? learnersTerm
                            : learnerTerm
                        ).toLowerCase(),
                    })}
                </div>
            )}

            {/* Sub-org destinations, so the admin can confirm the organisation + role
                choice before the enrollment is actually written. */}
            {selectedPackageSessions.some((ps) => ps.isOrgAssociated) && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2.5">
                    <p className="mb-1.5 text-xs font-semibold text-neutral-600">
                        {t('subOrg.heading')}
                    </p>
                    <ul className="flex flex-col gap-1">
                        {selectedPackageSessions
                            .filter((ps) => ps.isOrgAssociated)
                            .map((ps) => (
                                <li
                                    key={ps.packageSessionId}
                                    className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-600"
                                >
                                    <span className="font-medium text-neutral-700">
                                        {ps.courseName}
                                    </span>
                                    <span className="text-neutral-300">→</span>
                                    <span>
                                        {ps.subOrgSkipped
                                            ? t('subOrg.noLink')
                                            : ps.subOrgName ||
                                              (ps.newSubOrg?.name
                                                  ? t('subOrg.newSuffix', {
                                                        name: ps.newSubOrg.name,
                                                    })
                                                  : t('subOrg.notSelected'))}
                                    </span>
                                    {!ps.subOrgSkipped && (
                                        <span className="rounded-full bg-white px-2 py-0.5 text-caption font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200">
                                            {ps.subOrgRole === 'ADMIN_ONLY'
                                                ? t('subOrg.role.adminOnly')
                                                : ps.subOrgRole === 'ADMIN'
                                                  ? t('subOrg.role.admin', { term: learnerTerm })
                                                  : t('subOrg.role.staff', { term: learnerTerm })}
                                        </span>
                                    )}
                                </li>
                            ))}
                    </ul>
                </div>
            )}

            {summary.successful === 0 && summary.re_enrolled === 0 && (
                <div className="rounded-md border border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-700">
                    ⚠️ {t('emptyState', { term: learnersTerm.toLowerCase() })}
                </div>
            )}

            {/* Results table */}
            <div className="overflow-hidden rounded-lg border border-neutral-200">
                <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                {learnerTerm}
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                {courseTerm} / {levelTerm}
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                {t('table.headers.action')}
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                {t('table.headers.status')}
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                {t('table.headers.note')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {results.map((r, idx) => {
                            const config = statusConfig[r.status];
                            const Icon = config.icon;
                            const course = courseMap[r.package_session_id];
                            return (
                                <tr key={idx} className="hover:bg-neutral-50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-neutral-800">
                                            {r.user_email || r.user_id || emptyValue}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-neutral-500">
                                        {course
                                            ? `${course.courseName} / ${course.levelName}`
                                            : r.package_session_id}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-500">
                                        {(r.action_taken && actionTakenLabels[r.action_taken]) ||
                                            emptyValue}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                                config.className
                                            )}
                                        >
                                            <Icon
                                                size={12}
                                                weight="fill"
                                                className={config.iconClass}
                                            />
                                            {config.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-neutral-400">
                                        {r.payment_option_type === 'CPO' ? (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-amber-700">
                                                    {t('table.cpo.badge')}
                                                    {r.cpo_installment_count != null
                                                        ? t('table.cpo.installments', {
                                                              count: r.cpo_installment_count,
                                                          })
                                                        : ''}
                                                    {r.cpo_total_amount != null
                                                        ? t('table.cpo.totalAmount', {
                                                              amount: r.cpo_total_amount,
                                                          })
                                                        : ''}
                                                </span>
                                                <span className="text-neutral-500">
                                                    {r.cpo_initial_payment_mode === 'OFFLINE' &&
                                                    r.cpo_initial_payment_amount
                                                        ? t('table.cpo.recordingNow', {
                                                              amount: r.cpo_initial_payment_amount,
                                                          })
                                                        : t('table.cpo.noInitialPayment')}
                                                </span>
                                                {r.message && (
                                                    <span className="text-neutral-400">
                                                        {r.message}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            r.message || emptyValue
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SummaryCard = ({
    label,
    value,
    className,
}: {
    label: string;
    value: number;
    className: string;
}) => (
    <div className={cn('rounded-lg border p-3 text-center', className)}>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
);
