import { useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { useBulkDeassign } from '@/routes/manage-students/students-list/-services/bulkAssignService';
import type {
    BulkDeassignRequest,
    BulkDeassignResponse,
} from '@/routes/manage-students/students-list/-types/bulk-assign-types';
import type { PackageDetailDTO } from '@/routes/manage-students/students-list/-services/getLearnerPackages';

type DeassignStep = 'CONFIG' | 'PREVIEW' | 'RESULTS';

interface DeassignCourseDialogProps {
    userId: string;
    userName: string;
    courses: PackageDetailDTO[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const DeassignCourseDialog = ({
    userId,
    userName,
    courses,
    open,
    onOpenChange,
    onSuccess,
}: DeassignCourseDialogProps) => {
    const instituteId = getInstituteId() || '';
    const [step, setStep] = useState<DeassignStep>('CONFIG');
    const [selectedPSIds, setSelectedPSIds] = useState<Set<string>>(new Set());
    const [mode, setMode] = useState<'SOFT' | 'HARD'>('SOFT');
    const [notifyLearners, setNotifyLearners] = useState(false);
    const [previewData, setPreviewData] = useState<BulkDeassignResponse | null>(null);
    const [finalResults, setFinalResults] = useState<BulkDeassignResponse | null>(null);

    const { mutateAsync: bulkDeassign, isPending } = useBulkDeassign();

    // Reset when dialog opens
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setStep('CONFIG');
            setSelectedPSIds(new Set());
            setMode('SOFT');
            setNotifyLearners(false);
            setPreviewData(null);
            setFinalResults(null);
        }
        onOpenChange(isOpen);
    };

    const togglePS = (id: string) => {
        setSelectedPSIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const buildRequest = (dryRun: boolean): BulkDeassignRequest => ({
        institute_id: instituteId,
        user_ids: [userId],
        package_session_ids: Array.from(selectedPSIds),
        options: {
            mode,
            notify_learners: notifyLearners,
            dry_run: dryRun,
        },
    });

    const handlePreview = async () => {
        try {
            const result = await bulkDeassign(buildRequest(true));
            setPreviewData(result);
            setStep('PREVIEW');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Preview failed');
        }
    };

    const handleConfirm = async () => {
        try {
            const result = await bulkDeassign(buildRequest(false));
            setFinalResults(result);
            setStep('RESULTS');
            if (result.summary.failed === 0) {
                toast.success(
                    `${result.summary.successful} course(s) de-assigned successfully!`
                );
                onSuccess();
            } else {
                toast.warning(
                    `${result.summary.successful} removed, ${result.summary.failed} failed.`
                );
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'De-assignment failed');
        }
    };

    const renderConfig = () => (
        <div className="flex flex-col gap-5">
            <p className="text-sm text-neutral-600">
                Remove <strong>{userName}</strong> from selected courses.
            </p>

            {/* Course selection */}
            <div className="flex max-h-[220px] flex-col gap-2 overflow-y-auto pr-1">
                {courses.length === 0 ? (
                    <p className="py-4 text-center text-sm text-neutral-400">
                        No courses to de-assign
                    </p>
                ) : (
                    courses.map((c) => {
                        const psId = c.package_session_id;
                        if (!psId) return null;
                        const checked = selectedPSIds.has(psId);
                        return (
                            <label
                                key={c.id}
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                                    checked
                                        ? 'border-red-300 bg-red-50/40'
                                        : 'border-neutral-200 hover:border-neutral-300'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePS(psId)}
                                    className="h-4 w-4 rounded border-neutral-300 text-red-500 focus:ring-red-300"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-neutral-800">
                                        {c.package_name || 'Unnamed Course'}
                                    </p>
                                    {c.level_name && (
                                        <p className="truncate text-xs text-neutral-500">
                                            {c.level_name}
                                        </p>
                                    )}
                                </div>
                            </label>
                        );
                    })
                )}
            </div>

            {/* Mode selection */}
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <p className="text-xs font-medium text-neutral-600">Removal Mode</p>
                <label className="flex items-start gap-2">
                    <input
                        type="radio"
                        name="mode"
                        checked={mode === 'SOFT'}
                        onChange={() => setMode('SOFT')}
                        className="mt-0.5 text-primary-500"
                    />
                    <span className="text-xs text-neutral-700">
                        <strong>Soft Cancel</strong> — Access continues until plan expires.
                        Status → CANCELED
                    </span>
                </label>
                <label className="flex items-start gap-2">
                    <input
                        type="radio"
                        name="mode"
                        checked={mode === 'HARD'}
                        onChange={() => setMode('HARD')}
                        className="mt-0.5 text-red-500"
                    />
                    <span className="text-xs text-neutral-700">
                        <strong>Hard Terminate</strong> — Immediate access revocation.
                        Status → TERMINATED
                        <span className="ml-1 text-red-500">⚠ Cannot be undone</span>
                    </span>
                </label>

                <label className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                    <input
                        type="checkbox"
                        checked={notifyLearners}
                        onChange={(e) => setNotifyLearners(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-500"
                    />
                    Notify learner about removal
                </label>
            </div>
        </div>
    );

    const renderPreview = () => {
        if (!previewData) return null;
        const { summary, results } = previewData;
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm font-medium text-neutral-700">
                    Preview — Dry Run Results
                </p>

                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        ✅ {summary.successful} will be removed
                    </span>
                    {summary.skipped > 0 && (
                        <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700">
                            ⏭ {summary.skipped} skipped
                        </span>
                    )}
                    {summary.failed > 0 && (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                            ❌ {summary.failed} failed
                        </span>
                    )}
                </div>

                <div className="max-h-[260px] overflow-y-auto rounded-lg border border-neutral-200">
                    <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-neutral-50">
                            <tr>
                                <th className="px-3 py-2 font-medium text-neutral-600">
                                    Course
                                </th>
                                <th className="px-3 py-2 font-medium text-neutral-600">
                                    Action
                                </th>
                                <th className="px-3 py-2 font-medium text-neutral-600">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {results.map((r, idx) => {
                                const course = courses.find(
                                    (c) => c.package_session_id === r.package_session_id
                                );
                                return (
                                    <tr
                                        key={idx}
                                        className={
                                            r.warning
                                                ? 'bg-yellow-50/50'
                                                : r.status === 'FAILED'
                                                  ? 'bg-red-50/50'
                                                  : ''
                                        }
                                    >
                                        <td className="px-3 py-2 text-neutral-800">
                                            {course?.package_name || r.package_session_id}
                                        </td>
                                        <td className="px-3 py-2 text-neutral-500">
                                            {r.action_taken}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span
                                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                    r.status === 'SUCCESS'
                                                        ? 'bg-green-100 text-green-700'
                                                        : r.status === 'SKIPPED'
                                                          ? 'bg-yellow-100 text-yellow-700'
                                                          : 'bg-red-100 text-red-700'
                                                }`}
                                            >
                                                {r.status}
                                            </span>
                                            {r.warning && (
                                                <p className="mt-0.5 text-[10px] text-amber-600">
                                                    ⚠ {r.warning}
                                                </p>
                                            )}
                                            {r.message && (
                                                <p className="mt-0.5 text-[10px] text-neutral-400">
                                                    {r.message}
                                                </p>
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

    const renderResults = () => {
        if (!finalResults) return null;
        const { summary, results } = finalResults;
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-neutral-800">De-assignment Complete</p>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        ✅ {summary.successful} removed
                    </span>
                    {summary.skipped > 0 && (
                        <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700">
                            ⏭ {summary.skipped} skipped
                        </span>
                    )}
                    {summary.failed > 0 && (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                            ❌ {summary.failed} failed
                        </span>
                    )}
                </div>

                <div className="max-h-[260px] overflow-y-auto rounded-lg border border-neutral-200">
                    <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-neutral-50">
                            <tr>
                                <th className="px-3 py-2 font-medium text-neutral-600">
                                    Course
                                </th>
                                <th className="px-3 py-2 font-medium text-neutral-600">
                                    Status
                                </th>
                                <th className="px-3 py-2 font-medium text-neutral-600">
                                    Message
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {results.map((r, idx) => {
                                const course = courses.find(
                                    (c) => c.package_session_id === r.package_session_id
                                );
                                return (
                                    <tr key={idx}>
                                        <td className="px-3 py-2 text-neutral-800">
                                            {course?.package_name || r.package_session_id}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span
                                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                    r.status === 'SUCCESS'
                                                        ? 'bg-green-100 text-green-700'
                                                        : r.status === 'SKIPPED'
                                                          ? 'bg-yellow-100 text-yellow-700'
                                                          : 'bg-red-100 text-red-700'
                                                }`}
                                            >
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-neutral-500">
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

    const footer = (
        <div className="flex w-full items-center justify-between">
            {step === 'CONFIG' && (
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => handleOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={selectedPSIds.size === 0 || isPending}
                        onClick={handlePreview}
                        className="!bg-red-500 hover:!bg-red-600"
                    >
                        {isPending ? 'Loading...' : `Preview (${selectedPSIds.size} courses)`}
                    </MyButton>
                </>
            )}
            {step === 'PREVIEW' && (
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setStep('CONFIG')}
                    >
                        ← Back
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={isPending}
                        onClick={handleConfirm}
                        className="!bg-red-500 hover:!bg-red-600"
                    >
                        {isPending ? 'Removing...' : '✓ Confirm Removal'}
                    </MyButton>
                </>
            )}
            {step === 'RESULTS' && (
                <MyButton
                    buttonType="primary"
                    scale="small"
                    onClick={() => handleOpenChange(false)}
                    className="ml-auto"
                >
                    Done
                </MyButton>
            )}
        </div>
    );

    return (
        <MyDialog
            heading="Remove from Courses"
            open={open}
            onOpenChange={handleOpenChange}
            dialogWidth="max-w-lg"
            footer={footer}
        >
            {step === 'CONFIG' && renderConfig()}
            {step === 'PREVIEW' && renderPreview()}
            {step === 'RESULTS' && renderResults()}
        </MyDialog>
    );
};
