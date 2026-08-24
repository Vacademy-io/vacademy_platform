import { useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowRight } from '@phosphor-icons/react';
import { getInstituteId } from '@/constants/helper';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';
import {
    buildAccessChangePayload,
    useChangeLearnerAccessMutation,
    type AccessChangeMode,
    type LearnerAccessChangeRequest,
    type LearnerAccessChangeResponse,
} from '@/routes/manage-students/students-list/-services/learner-access';

type Step = 'CONFIG' | 'PREVIEW' | 'RESULTS';

/**
 * Bulk course-access change for every selected learner.
 *
 * <p>Only the three modes that are meaningful across a mixed selection are offered.
 * "Set total days from enrollment" is deliberately absent: each learner enrolled on a
 * different date, so it would silently hand them different end dates.
 */
const MODE_LABELS: Record<Exclude<AccessChangeMode, 'set_from_enrollment'>, string> = {
    extend: 'Extend by days',
    set_date: 'Set the same expiry date for everyone',
    unlimited: 'Give unlimited access',
};

const MODE_HINTS: Record<Exclude<AccessChangeMode, 'set_from_enrollment'>, string> = {
    extend: 'Each learner is extended from their own current expiry, so nobody loses time they already had. Already-expired learners are counted from today.',
    set_date: 'Every selected learner ends on this exact date, whatever they have now.',
    unlimited: 'Removes the expiry entirely for every selected learner.',
};

const formatExpiry = (value: string | null | undefined) =>
    value ? format(new Date(value), 'd MMM yyyy') : 'Unlimited';

export const BulkExtendAccessDialog = ({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) => {
    const instituteId = getInstituteId() || '';
    const { bulkActionInfo, closeAllDialogs } = useDialogStore();

    const [step, setStep] = useState<Step>('CONFIG');
    const [mode, setMode] = useState<Exclude<AccessChangeMode, 'set_from_enrollment'>>('extend');
    const [days, setDays] = useState('30');
    const [expiryDate, setExpiryDate] = useState('');
    const [reason, setReason] = useState('');
    const [allCourses, setAllCourses] = useState(false);
    const [previewData, setPreviewData] = useState<LearnerAccessChangeResponse | null>(null);
    const [finalResults, setFinalResults] = useState<LearnerAccessChangeResponse | null>(null);

    const { mutateAsync: changeAccess, isPending } = useChangeLearnerAccessMutation();

    const learners = (bulkActionInfo?.selectedStudents ?? []).filter((s) => s?.user_id);
    const userIds = Array.from(new Set(learners.map((s) => s.user_id)));
    // The rows the admin selected are already scoped to a batch by the list's filters, so
    // default to exactly those package sessions rather than silently touching every course
    // the learner happens to be enrolled in.
    const packageSessionIds = Array.from(
        new Set(learners.map((s) => s.package_session_id).filter(Boolean))
    );

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setStep('CONFIG');
            setMode('extend');
            setDays('30');
            setExpiryDate('');
            setReason('');
            setAllCourses(false);
            setPreviewData(null);
            setFinalResults(null);
        }
        onOpenChange(isOpen);
    };

    const numericDays = parseInt(days, 10);
    const isValid =
        userIds.length > 0 &&
        (mode === 'unlimited' ||
            (mode === 'set_date' && Boolean(expiryDate)) ||
            (mode === 'extend' && Number.isFinite(numericDays) && numericDays !== 0));

    const buildRequest = (dryRun: boolean): LearnerAccessChangeRequest => ({
        institute_id: instituteId,
        user_ids: userIds,
        package_session_ids: allCourses ? [] : packageSessionIds,
        ...buildAccessChangePayload({
            mode,
            days: mode === 'extend' ? numericDays : undefined,
            // End-of-day local, so the final day stays usable rather than being cut at midnight.
            expiryDate: expiryDate ? new Date(`${expiryDate}T23:59:59`).toISOString() : undefined,
        }),
        reason: reason.trim() || undefined,
        dry_run: dryRun,
    });

    const errorMessage = (err: unknown, fallback: string) =>
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        fallback;

    const handlePreview = async () => {
        try {
            setPreviewData(await changeAccess(buildRequest(true)));
            setStep('PREVIEW');
        } catch (err) {
            toast.error(errorMessage(err, 'Preview failed'));
        }
    };

    const handleConfirm = async () => {
        try {
            const result = await changeAccess(buildRequest(false));
            setFinalResults(result);
            setStep('RESULTS');
            if (result.summary.updated > 0) {
                toast.success(`Access updated for ${result.summary.updated} enrollment(s)`);
            } else {
                toast.warning('No enrollments were changed.');
            }
        } catch (err) {
            toast.error(errorMessage(err, 'Access change failed'));
        }
    };

    const renderConfig = () => (
        <div className="flex flex-col gap-5">
            <p className="text-sm text-neutral-600">
                Change course access for <strong>{userIds.length}</strong> selected learner(s).
            </p>

            <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <p className="text-caption font-medium text-neutral-600">What to change</p>
                {(Object.keys(MODE_LABELS) as Array<keyof typeof MODE_LABELS>).map((m) => (
                    <label key={m} className="flex items-start gap-2">
                        <input
                            type="radio"
                            name="bulk-access-mode"
                            checked={mode === m}
                            onChange={() => setMode(m)}
                            className="mt-0.5 text-primary-500"
                        />
                        <span className="text-caption text-neutral-700">
                            <strong>{MODE_LABELS[m]}</strong>
                            <span className="block text-2xs text-neutral-500">{MODE_HINTS[m]}</span>
                        </span>
                    </label>
                ))}

                {mode === 'extend' && (
                    <div className="ml-6 mt-1 flex flex-col gap-1">
                        <label
                            htmlFor="bulk-days"
                            className="text-2xs font-medium text-neutral-600"
                        >
                            Days to add
                        </label>
                        <Input
                            id="bulk-days"
                            type="number"
                            value={days}
                            onChange={(e) => setDays(e.target.value)}
                            className="h-8 w-36 text-caption"
                        />
                        <p className="text-2xs text-neutral-500">
                            Use a negative number to shorten access.
                        </p>
                    </div>
                )}

                {mode === 'set_date' && (
                    <div className="ml-6 mt-1 flex flex-col gap-1">
                        <label
                            htmlFor="bulk-expiry"
                            className="text-2xs font-medium text-neutral-600"
                        >
                            New expiry date
                        </label>
                        <Input
                            id="bulk-expiry"
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            className="h-8 w-40 text-caption"
                        />
                    </div>
                )}
            </div>

            <label className="flex items-start gap-2">
                <Checkbox
                    checked={allCourses}
                    onCheckedChange={(v) => setAllCourses(v === true)}
                    className="mt-0.5"
                />
                <span className="text-caption text-neutral-700">
                    Apply to <strong>every course</strong> these learners are enrolled in
                    <span className="block text-2xs text-neutral-500">
                        Off by default — only the {packageSessionIds.length} batch(es) shown in this
                        list are changed.
                    </span>
                </span>
            </label>

            <div className="flex flex-col gap-1">
                <label htmlFor="bulk-reason" className="text-caption font-medium text-neutral-600">
                    Reason (optional)
                </label>
                <Textarea
                    id="bulk-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Extending everyone after the schedule change"
                    className="min-h-16 text-caption"
                />
                <p className="text-2xs text-neutral-500">
                    Stored on every access-history row this change writes.
                </p>
            </div>
        </div>
    );

    const renderResultList = (data: LearnerAccessChangeResponse) => (
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {data.results.map((r, idx) => (
                <div
                    key={`${r.mapping_id ?? idx}`}
                    className="rounded-lg border border-neutral-200 p-3"
                >
                    <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-caption font-medium text-neutral-800">
                            {r.learner_name || r.user_id}
                        </p>
                        <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium ${
                                r.status === 'UPDATED'
                                    ? 'bg-success-50 text-success-600'
                                    : r.status === 'SKIPPED'
                                      ? 'bg-neutral-100 text-neutral-500'
                                      : 'bg-danger-50 text-danger-600'
                            }`}
                        >
                            {r.status}
                        </span>
                    </div>
                    {r.status === 'UPDATED' ? (
                        <div className="mt-1 flex items-center gap-1.5 text-2xs text-neutral-600">
                            <span>{formatExpiry(r.previous_expiry_date)}</span>
                            <ArrowRight className="size-3 text-neutral-400" />
                            <span className="font-medium text-neutral-800">
                                {formatExpiry(r.new_expiry_date)}
                            </span>
                            {r.days_delta != null && (
                                <span className="text-neutral-500">
                                    ({r.days_delta > 0 ? '+' : ''}
                                    {r.days_delta}d)
                                </span>
                            )}
                        </div>
                    ) : (
                        <p className="mt-1 text-2xs text-neutral-500">{r.message}</p>
                    )}
                </div>
            ))}
        </div>
    );

    const summaryLine = (d: LearnerAccessChangeResponse | null, verb: string) =>
        `${d?.summary.updated ?? 0} enrollment(s) ${verb}, ${d?.summary.skipped ?? 0} skipped, ${
            d?.summary.failed ?? 0
        } failed.`;

    const footer = (
        <div className="flex items-center gap-2">
            {step === 'CONFIG' && (
                <MyButton scale="medium" disable={!isValid || isPending} onClick={handlePreview}>
                    {isPending ? 'Checking…' : 'Preview changes'}
                </MyButton>
            )}
            {step === 'PREVIEW' && (
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => setStep('CONFIG')}
                    >
                        Back
                    </MyButton>
                    <MyButton
                        scale="medium"
                        disable={isPending || (previewData?.summary.updated ?? 0) === 0}
                        onClick={handleConfirm}
                    >
                        {isPending ? 'Applying…' : 'Apply changes'}
                    </MyButton>
                </>
            )}
            {step === 'RESULTS' && (
                <MyButton
                    scale="medium"
                    onClick={() => {
                        handleOpenChange(false);
                        closeAllDialogs();
                    }}
                >
                    Done
                </MyButton>
            )}
        </div>
    );

    return (
        <MyDialog
            heading="Extend Course Access"
            open={open}
            onOpenChange={handleOpenChange}
            dialogWidth="max-w-lg"
            footer={footer}
        >
            {step === 'CONFIG' && renderConfig()}
            {step === 'PREVIEW' && (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-neutral-600">
                        {summaryLine(previewData, 'will change')} Nothing has been saved yet.
                    </p>
                    {previewData && renderResultList(previewData)}
                </div>
            )}
            {step === 'RESULTS' && (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-neutral-600">
                        {summaryLine(finalResults, 'updated')}
                    </p>
                    {finalResults && renderResultList(finalResults)}
                </div>
            )}
        </MyDialog>
    );
};
