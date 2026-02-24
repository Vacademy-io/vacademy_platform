import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useBulkAssign } from '../../../-hooks/useBulkAssign';
import {
    BulkAssignRequest,
    BulkAssignResponse,
    BulkEnrollOptions,
    SelectedLearner,
    SelectedPackageSession,
} from '../../../-types/bulk-assign-types';
import { Step1LearnerSelector } from './steps/Step1LearnerSelector';
import { Step2CourseSelector } from './steps/Step2CourseSelector';
import { Step3EnrollConfig } from './steps/Step3EnrollConfig';
import { Step4Preview } from './steps/Step4Preview';
import { cn } from '@/lib/utils';

const STEPS = ['Select Learners', 'Select Courses', 'Enrollment Config', 'Preview & Confirm'];

interface BulkAssignDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const BulkAssignDialog = ({ open, onOpenChange, onSuccess }: BulkAssignDialogProps) => {
    const [step, setStep] = useState(0);
    const [selectedLearners, setSelectedLearners] = useState<SelectedLearner[]>([]);
    const [selectedPackageSessions, setSelectedPackageSessions] = useState<
        SelectedPackageSession[]
    >([]);
    const [options, setOptions] = useState<BulkEnrollOptions>({
        duplicateHandling: 'SKIP',
        notifyLearners: true,
    });
    const [previewResponse, setPreviewResponse] = useState<BulkAssignResponse | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { mutateAsync: bulkAssign } = useBulkAssign();

    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];

    const buildRequest = (dryRun: boolean): BulkAssignRequest => {
        const existingUserIds = selectedLearners
            .filter((l) => l.type === 'existing')
            .map((l) => (l as Extract<SelectedLearner, { type: 'existing' }>).userId);

        const newUsers = selectedLearners
            .filter((l) => l.type === 'new')
            .map((l) => (l as Extract<SelectedLearner, { type: 'new' }>).newUser);

        return {
            institute_id: INSTITUTE_ID || '',
            user_ids: existingUserIds.length > 0 ? existingUserIds : undefined,
            new_users: newUsers.length > 0 ? newUsers : undefined,
            assignments: selectedPackageSessions.map((ps) => ({
                package_session_id: ps.packageSessionId,
                enroll_invite_id: ps.enrollInviteId ?? null,
                access_days: ps.accessDays ?? null,
            })),
            options: {
                duplicate_handling: options.duplicateHandling,
                notify_learners: options.notifyLearners,
                dry_run: dryRun,
            },
        };
    };

    const handlePreview = async () => {
        setIsSubmitting(true);
        try {
            const result = await bulkAssign(buildRequest(true));
            setPreviewResponse(result);
            setStep(3);
        } catch (e) {
            toast.error('Failed to generate preview. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            const result = await bulkAssign(buildRequest(false));
            const { summary } = result;
            toast.success(
                `Enrollment complete! ✅ ${summary.successful} enrolled, ⏭ ${summary.skipped} skipped, ❌ ${summary.failed} failed.`
            );
            onSuccess?.();
            handleClose();
        } catch (e) {
            toast.error('Enrollment failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setStep(0);
        setSelectedLearners([]);
        setSelectedPackageSessions([]);
        setOptions({ duplicateHandling: 'SKIP', notifyLearners: true });
        setPreviewResponse(null);
        onOpenChange(false);
    };

    const canGoNext = () => {
        if (step === 0) return selectedLearners.length > 0;
        if (step === 1) return selectedPackageSessions.length > 0;
        if (step === 2) return true;
        return false;
    };

    const handleNext = () => {
        if (step === 2) {
            handlePreview();
        } else {
            setStep((s) => s + 1);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="flex h-[85vh] max-h-[85vh] w-[820px] max-w-[820px] flex-col gap-0 overflow-hidden p-0 font-normal">
                {/* Header */}
                <DialogHeader>
                    <div className="bg-primary-50 px-6 py-4">
                        <h2 className="text-h3 font-semibold text-primary-500">Enroll in Bulk</h2>
                        {/* Step progress bar */}
                        <div className="mt-3 flex items-center gap-0">
                            {STEPS.map((label, idx) => (
                                <div key={idx} className="flex flex-1 items-center">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={cn(
                                                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all',
                                                idx < step
                                                    ? 'bg-primary-500 text-white'
                                                    : idx === step
                                                      ? 'border-2 border-primary-500 bg-white text-primary-500'
                                                      : 'bg-neutral-200 text-neutral-500'
                                            )}
                                        >
                                            {idx < step ? '✓' : idx + 1}
                                        </div>
                                        <span
                                            className={cn(
                                                'mt-1 whitespace-nowrap text-[10px]',
                                                idx === step
                                                    ? 'font-semibold text-primary-500'
                                                    : 'text-neutral-400'
                                            )}
                                        >
                                            {label}
                                        </span>
                                    </div>
                                    {idx < STEPS.length - 1 && (
                                        <div
                                            className={cn(
                                                'mb-3 h-[2px] flex-1',
                                                idx < step ? 'bg-primary-500' : 'bg-neutral-200'
                                            )}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                {/* Step Content */}
                <div className="flex-1 overflow-y-auto">
                    {step === 0 && (
                        <Step1LearnerSelector
                            instituteId={INSTITUTE_ID || ''}
                            selectedLearners={selectedLearners}
                            onSelectedLearnersChange={setSelectedLearners}
                        />
                    )}
                    {step === 1 && (
                        <Step2CourseSelector
                            selectedPackageSessions={selectedPackageSessions}
                            onSelectedPackageSessionsChange={setSelectedPackageSessions}
                        />
                    )}
                    {step === 2 && (
                        <Step3EnrollConfig
                            instituteId={INSTITUTE_ID || ''}
                            selectedPackageSessions={selectedPackageSessions}
                            onSelectedPackageSessionsChange={setSelectedPackageSessions}
                            options={options}
                            onOptionsChange={setOptions}
                        />
                    )}
                    {step === 3 && previewResponse && (
                        <Step4Preview
                            previewResponse={previewResponse}
                            selectedPackageSessions={selectedPackageSessions}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
                    <div>
                        {step > 0 && (
                            <MyButton
                                buttonType="secondary"
                                scale="large"
                                layoutVariant="default"
                                onClick={() => setStep((s) => s - 1)}
                                disabled={isSubmitting}
                            >
                                ← Back
                            </MyButton>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <MyButton
                            buttonType="secondary"
                            scale="large"
                            layoutVariant="default"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </MyButton>
                        {step < 3 ? (
                            <MyButton
                                buttonType="primary"
                                scale="large"
                                layoutVariant="default"
                                onClick={handleNext}
                                disable={!canGoNext() || isSubmitting}
                            >
                                {isSubmitting
                                    ? 'Loading…'
                                    : step === 2
                                      ? 'Preview →'
                                      : 'Next →'}
                            </MyButton>
                        ) : (
                            <MyButton
                                buttonType="primary"
                                scale="large"
                                layoutVariant="default"
                                onClick={handleConfirm}
                                disable={
                                    isSubmitting ||
                                    (previewResponse?.summary.successful === 0 &&
                                        previewResponse?.summary.re_enrolled === 0)
                                }
                            >
                                {isSubmitting ? 'Enrolling…' : '✓ Confirm Enrollment'}
                            </MyButton>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
