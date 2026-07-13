import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useBulkAssign } from '../../../-hooks/useBulkAssign';
import {
    useParentLink,
    ParentLinkRequest,
    useLinkNewGuardian,
    LinkNewGuardianRequest,
} from '../../../-hooks/useParentLink';
import {
    BulkAssignRequest,
    BulkAssignResponse,
    BulkEnrollOptions,
    isChipGuardianReady,
    SelectedLearner,
    SelectedPackageSession,
} from '../../../-types/bulk-assign-types';
import { Step1LearnerSelector } from './steps/Step1LearnerSelector';
import { Step2CourseSelector } from './steps/Step2CourseSelector';
import { Step3EnrollConfig } from './steps/Step3EnrollConfig';
import { Step4Preview } from './steps/Step4Preview';
import { cn } from '@/lib/utils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useCourseSettings } from '@/hooks/useCourseSettings';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import {
    ContentTerms,
    RoleTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';

interface BulkAssignDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    /** When provided, pre-selects this course/batch in Step 2 */
    initialPackageSessionId?: string;
}

export const BulkAssignDialog = ({ open, onOpenChange, onSuccess, initialPackageSessionId }: BulkAssignDialogProps) => {
    const { getPackageWiseLevels } = useInstituteDetailsStore();
    const { enrollmentNotifications } = useCourseSettings();
    const showNotifyLearners = enrollmentNotifications?.showNotifyLearners ?? true;
    const showSendCredentials = enrollmentNotifications?.showSendCredentials ?? true;

    // Build initial selection from initialPackageSessionId
    const buildInitialSelection = (): SelectedPackageSession[] => {
        if (!initialPackageSessionId) return [];
        const groups = getPackageWiseLevels();
        for (const group of groups) {
            for (const level of group.level) {
                if (level.package_session_id === initialPackageSessionId) {
                    return [{
                        packageSessionId: initialPackageSessionId,
                        courseName: group.package_dto.package_name,
                        sessionName: '',
                        levelName: level.level_dto.level_name,
                        enrollInviteId: null,
                        accessDays: null,
                    }];
                }
            }
        }
        return [];
    };

    const STEPS = [
        `Select ${getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner)}`,
        `Select ${getTerminologyPlural(ContentTerms.Course, SystemTerms.Course)}`,
        'Enrollment Config',
        'Preview & Confirm',
    ];

    const [step, setStep] = useState(0);
    const [selectedLearners, setSelectedLearners] = useState<SelectedLearner[]>([]);
    const [selectedPackageSessions, setSelectedPackageSessions] = useState<
        SelectedPackageSession[]
    >([]);

    // Pre-select course when dialog opens with an initialPackageSessionId
    useEffect(() => {
        if (open && initialPackageSessionId) {
            const initial = buildInitialSelection();
            if (initial.length > 0) {
                setSelectedPackageSessions(initial);
            }
        }
    }, [open, initialPackageSessionId]);
    const [options, setOptions] = useState<BulkEnrollOptions>({
        duplicateHandling: 'SKIP',
        notifyLearners: false,
        sendCredentials: false,
        transactionId: '',
        paymentDate: '',
    });
    const [previewResponse, setPreviewResponse] = useState<BulkAssignResponse | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inline per-chip errors from a failed guardian-link resolution (Step 1, 'existing' chips only).
    const [guardianLinkErrors, setGuardianLinkErrors] = useState<Record<number, string>>({});
    const [isResolvingGuardianLinks, setIsResolvingGuardianLinks] = useState(false);

    const { mutateAsync: bulkAssign } = useBulkAssign();
    const { mutateAsync: linkGuardian } = useParentLink();
    const { mutateAsync: linkNewGuardian } = useLinkNewGuardian();

    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];

    const buildRequest = (dryRun: boolean): BulkAssignRequest => {
        // Defensive: a chip flagged 'is_guardian' must never be enrolled — its
        // resolved student replaces it in `selectedLearners` once Step 1's
        // guardian-link resolution succeeds (see resolveStep1GuardianLinks),
        // so this only guards against an unresolved leftover ever reaching here.
        const isEnrollmentTarget = (l: SelectedLearner) => l.parentLink?.mode !== 'is_guardian';

        const existingUserIds = selectedLearners
            .filter((l): l is Extract<SelectedLearner, { type: 'existing' }> => l.type === 'existing' && isEnrollmentTarget(l))
            .map((l) => l.userId);

        const newUsers = selectedLearners
            .filter((l): l is Extract<SelectedLearner, { type: 'new' }> => l.type === 'new' && isEnrollmentTarget(l))
            .map((l) => l.newUser);

        return {
            institute_id: INSTITUTE_ID || '',
            user_ids: existingUserIds.length > 0 ? existingUserIds : undefined,
            new_users: newUsers.length > 0 ? newUsers : undefined,
            assignments: selectedPackageSessions.map((ps) => ({
                package_session_id: ps.packageSessionId,
                enroll_invite_id: ps.enrollInviteId ?? null,
                access_days: ps.accessDays ?? null,
                cpo_config: ps.cpoConfig ?? null,
            })),
            options: {
                duplicate_handling: options.duplicateHandling,
                // When the course-setting visibility is off, the toggle is hidden in the
                // dialog and the corresponding field is forced to false in the request —
                // so a stale `true` from state can never reach the backend.
                notify_learners: showNotifyLearners ? options.notifyLearners : false,
                send_credentials: showSendCredentials ? options.sendCredentials : false,
                transaction_id: options.transactionId || undefined,
                payment_date: options.paymentDate || undefined,
                dry_run: dryRun,
            },
        };
    };

    const buildParentLinkRequest = (
        anchorUserId: string,
        pl: SelectedLearner['parentLink']
    ): ParentLinkRequest | null => {
        if (!pl || pl.mode === 'none') return null;
        const direction: ParentLinkRequest['direction'] =
            pl.mode === 'is_guardian' ? 'PARENT_ADDS_STUDENT' : 'STUDENT_ADDS_PARENT';
        const person = pl.mode === 'is_guardian' ? pl.student : pl.guardian;
        const base = {
            institute_id: INSTITUTE_ID || '',
            direction,
            anchor_user_id: anchorUserId,
        };
        if (person.kind === 'create_new') {
            return {
                ...base,
                mode: 'CREATE_NEW',
                new_full_name: person.fullName,
                new_email: person.email,
                new_mobile_number: person.mobileNumber || undefined,
            };
        }
        return {
            ...base,
            mode: 'LINK_EXISTING',
            existing_user_id: person.userId,
        };
    };

    const extractErrorMessage = (reason: unknown): string => {
        const err = reason as { response?: { data?: { message?: string } }; message?: string };
        return err?.response?.data?.message || err?.message || 'Failed to link guardian.';
    };

    /**
     * Builds the /parent-link/v1/link-new-guardian request for a 'new' chip
     * flagged 'is_guardian'. Unlike buildParentLinkRequest, this never needs
     * a real anchor id: the guardian is created fresh from the chip's own
     * manually-entered newUser fields, and the endpoint creates the guardian
     * unconditionally (it's specifically for the "guardian doesn't exist as
     * any user yet" case).
     */
    const buildLinkNewGuardianRequest = (
        l: Extract<SelectedLearner, { type: 'new' }>
    ): LinkNewGuardianRequest | null => {
        if (!l.parentLink || l.parentLink.mode !== 'is_guardian') return null;
        const student = l.parentLink.student;
        const base = {
            institute_id: INSTITUTE_ID || '',
            guardian_full_name: l.newUser.full_name || '',
            guardian_email: l.newUser.email || '',
            guardian_mobile_number: l.newUser.mobile_number || undefined,
        };
        if (student.kind === 'create_new') {
            return {
                ...base,
                mode: 'CREATE_NEW',
                student_full_name: student.fullName,
                student_email: student.email || undefined,
                student_mobile_number: student.mobileNumber || undefined,
            };
        }
        return {
            ...base,
            mode: 'LINK_EXISTING',
            student_existing_user_id: student.userId,
        };
    };

    /**
     * Resolves guardian-link choices BEFORE advancing past Step 1, for the
     * two cases that don't need a real, backend-minted enrollment id:
     *  - 'existing' chips with any guardian-link choice — their anchor id is
     *    already real, so /parent-link/v1/link can fire right away.
     *  - 'new' chips flagged 'is_guardian' — /parent-link/v1/link-new-guardian
     *    creates the guardian fresh from the chip's own manually-entered
     *    info, so it never needs an anchor either. A chip flagged as the
     *    guardian must never reach the enrollment call at all (there's no
     *    "enroll this chip" step to defer to for it), so this MUST run here
     *    and not after enrollment.
     *
     * Runs every chip's call in parallel (both groups together, via
     * Promise.all over two Promise.allSettled batches); blocks progression
     * (returns false) until every call has settled.
     *
     * On success for an 'is_guardian' chip (either group), the chip's own
     * target is swapped to the resolved student, typed as an 'existing'
     * chip — the guardian itself must never be enrolled, and the swapped
     * chip now flows through Step2/Step3/Step4 exactly like any other
     * resolved chip.
     *
     * 'add_guardian' on 'new' chips is NOT handled here — see
     * resolveNewChipGuardianLinks (it needs a real post-enrollment id).
     */
    const resolveStep1GuardianLinks = async (): Promise<boolean> => {
        const existingTargets = selectedLearners
            .map((l, idx) => ({ l, idx }))
            .filter(
                (t): t is { l: Extract<SelectedLearner, { type: 'existing' }>; idx: number } =>
                    t.l.type === 'existing' && !!t.l.parentLink && t.l.parentLink.mode !== 'none'
            );

        const newGuardianTargets = selectedLearners
            .map((l, idx) => ({ l, idx }))
            .filter(
                (t): t is { l: Extract<SelectedLearner, { type: 'new' }>; idx: number } =>
                    t.l.type === 'new' && !!t.l.parentLink && t.l.parentLink.mode === 'is_guardian'
            );

        if (existingTargets.length === 0 && newGuardianTargets.length === 0) return true;

        const [existingSettled, newGuardianSettled] = await Promise.all([
            Promise.allSettled(
                existingTargets.map(({ l }) => {
                    const request = buildParentLinkRequest(l.userId, l.parentLink);
                    if (!request) return Promise.reject(new Error('Invalid guardian-link selection.'));
                    return linkGuardian(request);
                })
            ),
            Promise.allSettled(
                newGuardianTargets.map(({ l }) => {
                    const request = buildLinkNewGuardianRequest(l);
                    if (!request) return Promise.reject(new Error('Invalid guardian-link selection.'));
                    return linkNewGuardian(request);
                })
            ),
        ]);

        const nextLearners = [...selectedLearners];
        const nextErrors: Record<number, string> = {};
        let allOk = true;

        existingSettled.forEach((result, i) => {
            const target = existingTargets[i];
            if (!target) return;
            const { l, idx } = target;
            if (result.status === 'fulfilled') {
                if (l.parentLink?.mode === 'is_guardian') {
                    const student = l.parentLink.student;
                    const resolvedName = student.kind === 'create_new' ? student.fullName : student.name;
                    const resolvedEmail = student.email;
                    nextLearners[idx] = {
                        type: 'existing',
                        userId: result.value.student_user_id,
                        name: resolvedName || l.name,
                        email: resolvedEmail || l.email,
                        parentLink: { mode: 'none' },
                    };
                }
            } else {
                allOk = false;
                nextErrors[idx] = extractErrorMessage(result.reason);
            }
        });

        newGuardianSettled.forEach((result, i) => {
            const target = newGuardianTargets[i];
            if (!target) return;
            const { l, idx } = target;
            if (result.status === 'fulfilled') {
                const student = l.parentLink?.mode === 'is_guardian' ? l.parentLink.student : undefined;
                const resolvedName =
                    (student?.kind === 'create_new' ? student.fullName : student?.name) ||
                    l.newUser.full_name;
                const resolvedEmail = student?.email || l.newUser.email;
                nextLearners[idx] = {
                    type: 'existing',
                    userId: result.value.student_user_id,
                    name: resolvedName,
                    email: resolvedEmail,
                    parentLink: { mode: 'none' },
                };
            } else {
                allOk = false;
                nextErrors[idx] = extractErrorMessage(result.reason);
            }
        });

        setSelectedLearners(nextLearners);
        setGuardianLinkErrors(nextErrors);
        return allOk;
    };

    /**
     * Resolves guardian-link choices for 'new' chips AFTER the real,
     * non-dry-run bulkAssign call succeeds.
     *
     * Why deferred: `new_users[]` only get real ids when the backend actually
     * creates them (BulkAssignmentService.bulkAssign — dry-run uses
     * placeholder ids; only `!dryRun` calls
     * createUserFromAuthServiceForLearnerEnrollment). /parent-link/v1/link
     * requires a real anchor_user_id, so a 'new' chip's guardian link can't
     * be resolved before this point — there is no "create user without
     * enrolling" path reachable from this dialog.
     *
     * Only 'add_guardian' is reachable here: 'is_guardian' on 'new' chips is
     * resolved earlier, in the pre-Step2 phase (see resolveStep1GuardianLinks),
     * via /parent-link/v1/link-new-guardian — which creates the guardian
     * fresh, so it doesn't need a real enrollment id and never reaches this
     * post-enrollment path.
     *
     * Correlates each 'new' chip to its real created id by matching email
     * against the bulkAssign response's `results[].user_email` — the most
     * reliable key available on that response shape.
     */
    const resolveNewChipGuardianLinks = async (result: BulkAssignResponse) => {
        const targets = selectedLearners.filter(
            (l): l is Extract<SelectedLearner, { type: 'new' }> =>
                l.type === 'new' && !!l.parentLink && l.parentLink.mode === 'add_guardian'
        );
        if (targets.length === 0) return;

        const settled = await Promise.allSettled(
            targets.map((l) => {
                const email = l.newUser.email;
                const match = result.results.find((r) => !!r.user_email && r.user_email === email && !!r.user_id);
                if (!match?.user_id) {
                    return Promise.reject(
                        new Error(`Could not resolve the created user id for ${l.newUser.full_name || email}.`)
                    );
                }
                const request = buildParentLinkRequest(match.user_id, l.parentLink);
                if (!request) return Promise.reject(new Error('Invalid guardian-link selection.'));
                return linkGuardian(request);
            })
        );

        settled.forEach((s, i) => {
            if (s.status === 'rejected') {
                const l = targets[i];
                if (!l) return;
                toast.error(
                    `Guardian link failed for ${l.newUser.full_name || l.newUser.email}: ${extractErrorMessage(s.reason)}`
                );
            }
        });
    };

    const clearGuardianLinkError = (index: number) => {
        setGuardianLinkErrors((prev) => {
            if (!(index in prev)) return prev;
            const next = { ...prev };
            delete next[index];
            return next;
        });
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
            // Fire off any deferred 'new'-chip guardian links now that the
            // enrollment call has minted their real user ids. Best-effort:
            // enrollment already succeeded, so a link failure here surfaces
            // as a toast rather than blocking the (already-real) enrollment.
            await resolveNewChipGuardianLinks(result);
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
        setSelectedPackageSessions(buildInitialSelection());
        setOptions({ duplicateHandling: 'SKIP', notifyLearners: false, sendCredentials: false, transactionId: '', paymentDate: '' });
        setPreviewResponse(null);
        setGuardianLinkErrors({});
        onOpenChange(false);
    };

    const canGoNext = () => {
        if (step === 0) {
            return (
                selectedLearners.length > 0 &&
                selectedLearners.every(isChipGuardianReady) &&
                !isResolvingGuardianLinks
            );
        }
        if (step === 1) return selectedPackageSessions.length > 0;
        if (step === 2) return true;
        return false;
    };

    const handleNext = async () => {
        if (step === 0) {
            setIsResolvingGuardianLinks(true);
            const ok = await resolveStep1GuardianLinks();
            setIsResolvingGuardianLinks(false);
            if (!ok) return; // inline chip errors already set — block advancing
            setStep(1);
            return;
        }
        if (step === 2) {
            handlePreview();
            return;
        }
        setStep((s) => s + 1);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="z-[1100] flex h-[90vh] max-h-[90vh] w-[95vw] max-w-[820px] flex-col gap-0 overflow-hidden p-0 font-normal sm:h-[85vh] sm:max-h-[85vh]" // design-lint-ignore: pre-existing viewport-relative dialog sizing, unrelated to the guardian-link feature (out of scope for this change)
            >
                {/* Header */}
                <DialogHeader>
                    <div className="bg-primary-50 px-4 py-3 sm:px-6 sm:py-4">
                        <h2 className="text-h3 font-semibold text-primary-500">Enroll {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}</h2>
                        {/* Step progress bar */}
                        <div className="mt-3 flex items-center gap-0">
                            {STEPS.map((label, idx) => (
                                <div key={idx} className="flex flex-1 items-center">
                                    <div className="flex min-w-0 flex-col items-center">
                                        <div
                                            className={cn(
                                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all sm:h-7 sm:w-7 sm:text-xs', // design-lint-ignore: pre-existing step-badge sizing, unrelated to the guardian-link feature (out of scope for this change)
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
                                                'mt-1 max-w-full truncate text-center text-[9px] sm:whitespace-nowrap sm:text-[10px]', // design-lint-ignore: pre-existing step-label sizing, unrelated to the guardian-link feature (out of scope for this change)
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
                                                'mb-3 h-[2px] flex-1', // design-lint-ignore: pre-existing step-divider sizing, unrelated to the guardian-link feature (out of scope for this change)
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
                            onPaymentInfoDetected={(info) => {
                                setOptions((prev) => ({
                                    ...prev,
                                    paymentDate: info.paymentDate || prev.paymentDate,
                                    transactionId: info.transactionId || prev.transactionId,
                                }));
                            }}
                            guardianLinkErrors={guardianLinkErrors}
                            onClearGuardianLinkError={clearGuardianLinkError}
                        />
                    )}
                    {step === 1 && (
                        <Step2CourseSelector
                            selectedPackageSessions={selectedPackageSessions}
                            onSelectedPackageSessionsChange={setSelectedPackageSessions}
                            initialPackageSessionId={initialPackageSessionId}
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
                <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-4 py-3 sm:px-6 sm:py-4">
                    <div>
                        {step > 0 && (
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                onClick={() => setStep((s) => s - 1)}
                                disabled={isSubmitting}
                            >
                                ← Back
                            </MyButton>
                        )}
                    </div>
                    <div className="flex gap-2 sm:gap-3">
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            layoutVariant="default"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </MyButton>
                        {step < 3 ? (
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                layoutVariant="default"
                                onClick={handleNext}
                                disable={!canGoNext() || isSubmitting || isResolvingGuardianLinks}
                            >
                                {isResolvingGuardianLinks
                                    ? 'Linking guardians…'
                                    : isSubmitting
                                      ? 'Loading…'
                                      : step === 2
                                        ? 'Preview →'
                                        : 'Next →'}
                            </MyButton>
                        ) : (
                            <MyButton
                                buttonType="primary"
                                scale="small"
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
