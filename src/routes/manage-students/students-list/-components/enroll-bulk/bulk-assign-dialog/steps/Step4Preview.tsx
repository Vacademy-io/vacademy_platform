import { BulkAssignResponse, SelectedPackageSession } from '../../../../-types/bulk-assign-types';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, SkipForward } from '@phosphor-icons/react';

interface Props {
    previewResponse: BulkAssignResponse;
    selectedPackageSessions: SelectedPackageSession[];
}

const STATUS_CONFIG = {
    SUCCESS: {
        label: 'Will Enroll',
        icon: CheckCircle,
        className: 'text-success-600 bg-success-50',
        iconClass: 'text-success-500',
    },
    SKIPPED: {
        label: 'Will Skip',
        icon: SkipForward,
        className: 'text-warning-600 bg-warning-50',
        iconClass: 'text-warning-500',
    },
    FAILED: {
        label: 'Will Fail',
        icon: XCircle,
        className: 'text-danger-600 bg-danger-50',
        iconClass: 'text-danger-500',
    },
} as const;

export const Step4Preview = ({ previewResponse, selectedPackageSessions }: Props) => {
    const { summary, results } = previewResponse;
    const courseMap = Object.fromEntries(
        selectedPackageSessions.map((ps) => [ps.packageSessionId, ps])
    );

    return (
        <div className="flex flex-col gap-5 px-6 py-5">
            {/* Summary banner */}
            <div className="grid grid-cols-4 gap-3">
                <SummaryCard
                    label="Total"
                    value={summary.total_requested}
                    className="bg-neutral-50 text-neutral-700 border-neutral-200"
                />
                <SummaryCard
                    label="Will Enroll"
                    value={summary.successful}
                    className="bg-success-50 text-success-700 border-success-200"
                />
                <SummaryCard
                    label="Will Skip"
                    value={summary.skipped}
                    className="bg-warning-50 text-warning-700 border-warning-200"
                />
                <SummaryCard
                    label="Will Fail"
                    value={summary.failed}
                    className="bg-danger-50 text-danger-700 border-danger-200"
                />
            </div>

            {summary.re_enrolled > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                    🔄 <strong>{summary.re_enrolled}</strong> student
                    {summary.re_enrolled !== 1 ? 's' : ''} will be re-enrolled (previously
                    expired/terminated access).
                </div>
            )}

            {summary.successful === 0 && summary.re_enrolled === 0 && (
                <div className="rounded-md border border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-700">
                    ⚠️ No students will be newly enrolled. Review your selections or change the
                    duplicate handling option.
                </div>
            )}

            {/* Results table */}
            <div className="overflow-hidden rounded-lg border border-neutral-200">
                <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                Learner
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                Course / Level
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                Action
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                Status
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500">
                                Note
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {results.map((r, idx) => {
                            const config = STATUS_CONFIG[r.status];
                            const Icon = config.icon;
                            const course = courseMap[r.package_session_id];
                            return (
                                <tr key={idx} className="hover:bg-neutral-50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-neutral-800">
                                            {r.user_email || r.user_id || '—'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-neutral-500">
                                        {course
                                            ? `${course.courseName} / ${course.levelName}`
                                            : r.package_session_id}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-500 capitalize">
                                        {r.action_taken?.toLowerCase().replace('_', ' ') || '—'}
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
                                        {r.message || '—'}
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
