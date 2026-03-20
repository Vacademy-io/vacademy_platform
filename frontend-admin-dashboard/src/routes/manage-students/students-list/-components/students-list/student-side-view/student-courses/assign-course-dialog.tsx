import { useState, useEffect } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { fetchPaginatedBatches } from '@/routes/admin-package-management/-services/package-service';
import type { PackageSessionDTO } from '@/routes/admin-package-management/-types/package-types';
import { useBulkAssign } from '@/routes/manage-students/students-list/-services/bulkAssignService';
import type {
    BulkAssignRequest,
    BulkAssignResponse,
    AssignmentItem,
} from '@/routes/manage-students/students-list/-types/bulk-assign-types';
import {
    InvitePickerRow,
    type PackageSessionConfig,
} from './invite-picker-row';

type WizardStep = 'SELECT_COURSES' | 'CONFIGURE' | 'PREVIEW' | 'RESULTS';

interface AssignCourseDialogProps {
    userId: string;
    userName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const AssignCourseDialog = ({
    userId,
    userName,
    open,
    onOpenChange,
    onSuccess,
}: AssignCourseDialogProps) => {
    const instituteId = getInstituteId() || '';
    const [step, setStep] = useState<WizardStep>('SELECT_COURSES');
    const [batches, setBatches] = useState<PackageSessionDTO[]>([]);
    const [isLoadingBatches, setIsLoadingBatches] = useState(false);
    const [selectedPSIds, setSelectedPSIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [duplicateHandling, setDuplicateHandling] = useState<'SKIP' | 'ERROR' | 'RE_ENROLL'>(
        'SKIP'
    );
    const [notifyLearners, setNotifyLearners] = useState(false);
    const [previewData, setPreviewData] = useState<BulkAssignResponse | null>(null);
    const [finalResults, setFinalResults] = useState<BulkAssignResponse | null>(null);

    // Per-package-session invite config
    const [psConfigs, setPsConfigs] = useState<PackageSessionConfig[]>([]);

    const { mutateAsync: bulkAssign, isPending } = useBulkAssign();

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (open) {
            setStep('SELECT_COURSES');
            setSelectedPSIds(new Set());
            setSearchQuery('');
            setDuplicateHandling('SKIP');
            setNotifyLearners(false);
            setPreviewData(null);
            setFinalResults(null);
            setPsConfigs([]);
            loadBatches();
        }
    }, [open]);

    const loadBatches = async () => {
        try {
            setIsLoadingBatches(true);
            const data = await fetchPaginatedBatches({
                page: 0,
                size: 100,
            });
            setBatches(data.content || []);
        } catch {
            toast.error('Failed to load courses');
        } finally {
            setIsLoadingBatches(false);
        }
    };

    const togglePS = (id: string) => {
        setSelectedPSIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Build initial per-PS configs when moving to CONFIGURE step
    const goToConfigure = () => {
        const configs: PackageSessionConfig[] = Array.from(selectedPSIds).map((psId) => {
            const batch = batches.find((b) => b.id === psId);

            const name = batch
                ? batch.name
                    ? `${batch.package_dto.package_name} ${batch.name}`
                    : `${batch.package_dto.package_name} · ${batch.level.level_name} · ${batch.session.session_name}`
                : psId;

            // Preserve existing config if already set
            const existing = psConfigs.find((c) => c.packageSessionId === psId);
            if (existing) return existing;

            return {
                packageSessionId: psId,
                packageSessionName: name,
                selectedInvite: null,
                isAutoMode: true,
                resolvedPaymentOption: null,
                resolvedPaymentPlan: null,
                accessDaysOverride: null,
            };
        });
        setPsConfigs(configs);
        setStep('CONFIGURE');
    };

    const updatePSConfig = (updated: PackageSessionConfig) => {
        setPsConfigs((prev) =>
            prev.map((c) =>
                c.packageSessionId === updated.packageSessionId ? updated : c
            )
        );
    };

    const buildRequest = (dryRun: boolean): BulkAssignRequest => {
        const assignments: AssignmentItem[] = psConfigs.map((cfg) => ({
            package_session_id: cfg.packageSessionId,
            enroll_invite_id: cfg.isAutoMode ? null : cfg.selectedInvite?.id || null,
            payment_option_id: cfg.isAutoMode ? null : cfg.resolvedPaymentOption?.id || null,
            plan_id: cfg.isAutoMode ? null : cfg.resolvedPaymentPlan?.id || null,
            access_days: cfg.accessDaysOverride,
        }));

        return {
            institute_id: instituteId,
            user_ids: [userId],
            assignments,
            options: {
                duplicate_handling: duplicateHandling,
                notify_learners: notifyLearners,
                dry_run: dryRun,
            },
        };
    };

    const handlePreview = async () => {
        try {
            const result = await bulkAssign(buildRequest(true));
            setPreviewData(result);
            setStep('PREVIEW');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Preview failed');
        }
    };

    const handleConfirm = async () => {
        try {
            const result = await bulkAssign(buildRequest(false));
            setFinalResults(result);
            setStep('RESULTS');
            if (result.summary.failed === 0) {
                toast.success(
                    `${result.summary.successful} course(s) assigned successfully!`
                );
                onSuccess();
            } else {
                toast.warning(
                    `${result.summary.successful} assigned, ${result.summary.failed} failed.`
                );
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Assignment failed');
        }
    };

    const filteredBatches = batches.filter((b) => {
        const q = searchQuery.toLowerCase();
        return (
            b.package_dto.package_name.toLowerCase().includes(q) ||
            b.level.level_name.toLowerCase().includes(q) ||
            b.session.session_name.toLowerCase().includes(q)
        );
    });

    // ────────────────── STEP RENDERERS ──────────────────

    const renderSelectCourses = () => (
        <div className="flex flex-col gap-5">
            <p className="text-sm text-neutral-600">
                Assign <strong>{userName}</strong> to one or more courses.
            </p>

            {/* Search */}
            <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
            />

            {/* Selection toolbar */}
            {!isLoadingBatches && filteredBatches.length > 0 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">
                        {selectedPSIds.size} of {batches.length} selected
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            const allFilteredIds = filteredBatches.map((b) => b.id);
                            const allSelected = allFilteredIds.every((id) =>
                                selectedPSIds.has(id)
                            );
                            if (allSelected) {
                                // Deselect all filtered
                                setSelectedPSIds((prev) => {
                                    const next = new Set(prev);
                                    allFilteredIds.forEach((id) => next.delete(id));
                                    return next;
                                });
                            } else {
                                // Select all filtered
                                setSelectedPSIds((prev) => {
                                    const next = new Set(prev);
                                    allFilteredIds.forEach((id) => next.add(id));
                                    return next;
                                });
                            }
                        }}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                        {filteredBatches.every((b) => selectedPSIds.has(b.id))
                            ? 'Deselect All'
                            : 'Select All'}
                    </button>
                </div>
            )}

            {/* Course list */}
            {isLoadingBatches ? (
                <DashboardLoader />
            ) : (
                <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
                    {filteredBatches.length === 0 ? (
                        <p className="py-4 text-center text-sm text-neutral-400">
                            No courses found
                        </p>
                    ) : (
                        filteredBatches.map((b) => {
                            const checked = selectedPSIds.has(b.id);
                            return (
                                <label
                                    key={b.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                                        checked
                                            ? 'border-primary-400 bg-primary-50/40'
                                            : 'border-neutral-200 hover:border-neutral-300'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => togglePS(b.id)}
                                        className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-300"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-neutral-800">
                                            {b.name
                                                ? `${b.package_dto.package_name} ${b.name}`
                                                : b.package_dto.package_name}
                                        </p>
                                        <p className="truncate text-xs text-neutral-500">
                                            {b.level.level_name} · {b.session.session_name}
                                        </p>
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );

    const renderConfigure = () => (
        <div className="flex flex-col gap-5">
            <p className="text-sm text-neutral-600">
                Configure enrollment settings for each course.
                You can leave everything as <strong>"Auto (Default)"</strong> for a quick free enrollment,
                or pick a specific invite per course.
            </p>

            {/* Invite pickers per PS */}
            <div className="flex max-h-[340px] flex-col gap-3 overflow-y-auto pr-1">
                {psConfigs.map((cfg) => (
                    <InvitePickerRow
                        key={cfg.packageSessionId}
                        config={cfg}
                        onChange={updatePSConfig}
                    />
                ))}
            </div>

            {/* Global options */}
            <div className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Options
                </p>
                <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-neutral-600">
                        If already enrolled:
                    </label>
                    <select
                        value={duplicateHandling}
                        onChange={(e) =>
                            setDuplicateHandling(
                                e.target.value as 'SKIP' | 'ERROR' | 'RE_ENROLL'
                            )
                        }
                        className="rounded border border-neutral-200 px-2 py-1 text-xs"
                    >
                        <option value="SKIP">Skip</option>
                        <option value="ERROR">Error</option>
                        <option value="RE_ENROLL">Re-enroll</option>
                    </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                    <input
                        type="checkbox"
                        checked={notifyLearners}
                        onChange={(e) => setNotifyLearners(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-500"
                    />
                    Notify learner via email
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

                {/* Summary chips */}
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        ✅ {summary.successful} will succeed
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

                {/* Invite resolution summary */}
                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase text-neutral-500">
                        Invite Configuration
                    </p>
                    {psConfigs.map((cfg) => (
                        <p
                            key={cfg.packageSessionId}
                            className="text-[11px] text-neutral-600"
                        >
                            <span className="font-medium">
                                {cfg.packageSessionName.split(' · ')[0]}:
                            </span>{' '}
                            {cfg.isAutoMode ? (
                                <span className="text-blue-600">Auto (Default)</span>
                            ) : (
                                <span className="text-purple-600">
                                    {cfg.selectedInvite?.name}
                                    {cfg.resolvedPaymentPlan
                                        ? ` · ₹${cfg.resolvedPaymentPlan.actual_price}`
                                        : ''}
                                </span>
                            )}
                        </p>
                    ))}
                </div>

                {/* Results table */}
                <div className="max-h-[200px] overflow-y-auto rounded-lg border border-neutral-200">
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
                                const courseName =
                                    batches.find((b) => b.id === r.package_session_id)
                                        ?.package_dto.package_name || r.package_session_id;
                                return (
                                    <tr
                                        key={idx}
                                        className={
                                            r.status === 'FAILED'
                                                ? 'bg-red-50/50'
                                                : r.status === 'SKIPPED'
                                                  ? 'bg-yellow-50/50'
                                                  : ''
                                        }
                                    >
                                        <td className="px-3 py-2 text-neutral-800">
                                            {courseName}
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
                <p className="text-sm font-semibold text-neutral-800">Assignment Complete</p>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        ✅ {summary.successful} assigned
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
                                const courseName =
                                    batches.find((b) => b.id === r.package_session_id)
                                        ?.package_dto.package_name || r.package_session_id;
                                return (
                                    <tr key={idx}>
                                        <td className="px-3 py-2 text-neutral-800">
                                            {courseName}
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

    // ────────────────── STEPPER + FOOTER ──────────────────

    const stepLabels: { key: WizardStep; label: string }[] = [
        { key: 'SELECT_COURSES', label: 'Select' },
        { key: 'CONFIGURE', label: 'Configure' },
        { key: 'PREVIEW', label: 'Preview' },
        { key: 'RESULTS', label: 'Done' },
    ];

    const stepIndex = stepLabels.findIndex((s) => s.key === step);

    const renderStepper = () => (
        <div className="mb-4 flex items-center gap-1">
            {stepLabels.map((s, i) => (
                <div key={s.key} className="flex items-center">
                    <div
                        className={`flex h-6 items-center gap-1 rounded-full px-2.5 text-[10px] font-medium transition-colors ${
                            i === stepIndex
                                ? 'bg-primary-500 text-white'
                                : i < stepIndex
                                  ? 'bg-primary-100 text-primary-700'
                                  : 'bg-neutral-100 text-neutral-400'
                        }`}
                    >
                        <span>{i + 1}</span>
                        <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < stepLabels.length - 1 && (
                        <div
                            className={`mx-1 h-px w-4 ${
                                i < stepIndex ? 'bg-primary-300' : 'bg-neutral-200'
                            }`}
                        />
                    )}
                </div>
            ))}
        </div>
    );

    const footer = (
        <div className="flex w-full items-center justify-between">
            {step === 'SELECT_COURSES' && (
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={selectedPSIds.size === 0}
                        onClick={goToConfigure}
                    >
                        Next → Configure ({selectedPSIds.size})
                    </MyButton>
                </>
            )}
            {step === 'CONFIGURE' && (
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setStep('SELECT_COURSES')}
                    >
                        ← Back
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={isPending}
                        onClick={handlePreview}
                    >
                        {isPending ? 'Loading...' : 'Preview →'}
                    </MyButton>
                </>
            )}
            {step === 'PREVIEW' && (
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setStep('CONFIGURE')}
                    >
                        ← Back
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={isPending}
                        onClick={handleConfirm}
                    >
                        {isPending ? 'Assigning...' : '✓ Confirm Assignment'}
                    </MyButton>
                </>
            )}
            {step === 'RESULTS' && (
                <MyButton
                    buttonType="primary"
                    scale="small"
                    onClick={() => onOpenChange(false)}
                    className="ml-auto"
                >
                    Done
                </MyButton>
            )}
        </div>
    );

    return (
        <MyDialog
            heading="Assign to Courses"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
            footer={footer}
        >
            {renderStepper()}
            {step === 'SELECT_COURSES' && renderSelectCourses()}
            {step === 'CONFIGURE' && renderConfigure()}
            {step === 'PREVIEW' && renderPreview()}
            {step === 'RESULTS' && renderResults()}
        </MyDialog>
    );
};
