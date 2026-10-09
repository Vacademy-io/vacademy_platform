import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BulkEnrollOptions, SelectedPackageSession } from '../../../../-types/bulk-assign-types';
import { InvitePickerDropdown } from '../../components/InvitePickerDropdown';
import { CpoEnrollmentConfigPanel } from '../../components/CpoEnrollmentConfigPanel';
import { useResolvedInviteDetails } from '../../../../-hooks/useResolvedInviteDetails';
import { BookOpen, Lightning, Question } from '@phosphor-icons/react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarBlank as CalendarIcon } from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { getActiveWorkflowsQuery, getWorkflowRawQuery } from '@/services/workflow-service';
import { evaluateEntryCondition, findEntryCondition } from './workflow-entry-condition';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import {
    ContentTerms,
    RoleTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';
import { useCourseSettings } from '@/hooks/useCourseSettings';
import {
    AdminDiscountField,
    EMPTY_ADMIN_DISCOUNT,
} from '@/components/common/payments/AdminDiscountField';
import { canGrantAdminDiscounts, isDiscountablePlanType } from '@/services/admin-discounts';

interface Props {
    instituteId: string;
    selectedPackageSessions: SelectedPackageSession[];
    onSelectedPackageSessionsChange: (sessions: SelectedPackageSession[]) => void;
    options: BulkEnrollOptions;
    onOptionsChange: (opts: BulkEnrollOptions) => void;
}

interface CourseConfigRowProps {
    instituteId: string;
    ps: SelectedPackageSession;
    onUpdate: (patch: Partial<SelectedPackageSession>) => void;
}

const CourseConfigRow = ({ instituteId, ps, onUpdate }: CourseConfigRowProps) => {
    const { t } = useTranslation('manageStudentsStep3EnrollConfig');
    const { data: resolved } = useResolvedInviteDetails({
        instituteId,
        packageSessionId: ps.packageSessionId,
        enrollInviteId: ps.enrollInviteId,
    });
    const isCpo = resolved?.paymentOption?.type === 'CPO';
    const cpoId = resolved?.complexPaymentOptionId ?? null;
    const canDiscount =
        isDiscountablePlanType(resolved?.paymentOption?.type) && canGrantAdminDiscounts(instituteId);
    // Same plan the backend's DefaultInviteResolver enrolls against: an ACTIVE plan,
    // DEFAULT-tagged first. Used only to price the discount preview.
    const activePlans = (resolved?.paymentOption?.payment_plans ?? []).filter(
        (p) => p.status === 'ACTIVE'
    );
    const resolvedPlan = activePlans.find((p) => p.tag === 'DEFAULT') ?? activePlans[0] ?? null;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <BookOpen size={16} weight="duotone" className="text-primary-500" />
                <div>
                    <p className="text-sm font-semibold text-neutral-800">{ps.courseName}</p>
                    <p className="text-xs text-neutral-400">{ps.levelName}</p>
                </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                <div className="flex-1">
                    <Label className="mb-1 text-xs text-neutral-500">
                        {t('courseInviteSection.inviteLinkLabel')}
                    </Label>
                    <InvitePickerDropdown
                        instituteId={instituteId}
                        packageSessionId={ps.packageSessionId}
                        value={ps.enrollInviteId ?? null}
                        onValueChange={(id, name) =>
                            onUpdate({
                                enrollInviteId: id,
                                enrollInviteName: name,
                                // Reset CPO state on invite change — different invite may carry
                                // a different (or no) CPO mirror.
                                cpoConfig: undefined,
                                // A discount priced against the old invite's plan no longer applies.
                                adminDiscount: undefined,
                            })
                        }
                    />
                </div>
                <div className="w-36">
                    <Label className="mb-1 text-xs text-neutral-500">
                        {t('courseInviteSection.accessDaysLabel')}
                    </Label>
                    <Input
                        type="number"
                        min={1}
                        placeholder={t('courseInviteSection.accessDaysPlaceholder')}
                        value={ps.accessDays ?? ''}
                        onChange={(e) =>
                            onUpdate({
                                accessDays: e.target.value ? Number(e.target.value) : null,
                            })
                        }
                    />
                </div>
            </div>

            {resolved?.paymentOption && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-neutral-600">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
                        {resolved.paymentOption.name}
                    </span>
                    <span
                        className={`rounded-full px-2 py-0.5 text-caption font-semibold ${
                            resolved.paymentOption.type === 'FREE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : resolved.paymentOption.type === 'CPO'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-orange-100 text-orange-700'
                        }`}
                    >
                        {resolved.paymentOption.type}
                    </span>
                    {resolved.resolvedFromDefault && (
                        <span className="text-caption text-neutral-400">
                            {t('courseInviteSection.autoResolvedFromDefault')}
                        </span>
                    )}
                </div>
            )}

            {canDiscount && resolvedPlan && (
                <div className="mt-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
                    <AdminDiscountField
                        value={ps.adminDiscount ?? EMPTY_ADMIN_DISCOUNT}
                        onChange={(v) => onUpdate({ adminDiscount: v })}
                        paymentPlanId={resolvedPlan.id}
                        isSubscription={resolved?.paymentOption?.type === 'SUBSCRIPTION'}
                        currency={resolvedPlan.currency || 'INR'}
                        packageSessionId={ps.packageSessionId}
                        enrollInviteId={resolved?.invite?.id ?? ps.enrollInviteId ?? undefined}
                        instituteId={instituteId}
                        label="Discount (optional, applies to every selected learner)"
                    />
                </div>
            )}

            {isCpo && cpoId && (
                <CpoEnrollmentConfigPanel
                    cpoId={cpoId}
                    value={ps.cpoConfig}
                    onChange={(v) => onUpdate({ cpoConfig: v })}
                />
            )}
        </div>
    );
};

export const Step3EnrollConfig = ({
    instituteId,
    selectedPackageSessions,
    onSelectedPackageSessionsChange,
    options,
    onOptionsChange,
}: Props) => {
    const { t } = useTranslation('manageStudentsStep3EnrollConfig');
    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const learnerTerm = getTerminology(RoleTerms.Learner, SystemTerms.Learner);
    const learnersTerm = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner);

    const { enrollmentNotifications } = useCourseSettings();
    const showNotifyLearners = enrollmentNotifications?.showNotifyLearners ?? true;
    const showSendCredentials = enrollmentNotifications?.showSendCredentials ?? true;

    const updateSession = (packageSessionId: string, patch: Partial<SelectedPackageSession>) => {
        onSelectedPackageSessionsChange(
            selectedPackageSessions.map((ps) =>
                ps.packageSessionId === packageSessionId ? { ...ps, ...patch } : ps
            )
        );
    };

    return (
        <div className="flex flex-col gap-6 px-6 py-5">
            {/* Per-course invite configuration */}
            <div>
                <h3 className="mb-1 text-sm font-semibold text-neutral-700">
                    {t('courseInviteSection.heading', { term: courseTerm })}
                </h3>
                <p className="mb-3 text-xs text-neutral-400">
                    {t('courseInviteSection.description', { term: courseTerm.toLowerCase() })}
                </p>
                <div className="flex flex-col gap-3">
                    {selectedPackageSessions.map((ps) => (
                        <CourseConfigRow
                            key={ps.packageSessionId}
                            instituteId={instituteId}
                            ps={ps}
                            onUpdate={(patch) => updateSession(ps.packageSessionId, patch)}
                        />
                    ))}
                </div>
            </div>

            {/* Global options */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-neutral-700">
                    {t('globalOptions.heading')}
                </h3>
                <div className="flex flex-col gap-4">
                    {/* Notify learners — visibility controlled by Course Settings */}
                    {showNotifyLearners && (
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium text-neutral-700">
                                    {t('globalOptions.notifyLearnersLabel', {
                                        term: learnersTerm,
                                    })}
                                </Label>
                                <p className="text-xs text-neutral-400">
                                    {t('globalOptions.notifyLearnersDescription', {
                                        term: learnersTerm.toLowerCase(),
                                    })}
                                </p>
                            </div>
                            <Switch
                                checked={options.notifyLearners}
                                onCheckedChange={(v) =>
                                    onOptionsChange({ ...options, notifyLearners: v })
                                }
                            />
                        </div>
                    )}

                    {/* Send credentials — visibility controlled by Course Settings */}
                    {showSendCredentials && (
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium text-neutral-700">
                                    {t('globalOptions.sendCredentialsLabel')}
                                </Label>
                                <p className="text-xs text-neutral-400">
                                    {t('globalOptions.sendCredentialsDescription', {
                                        term: learnersTerm.toLowerCase(),
                                    })}
                                </p>
                            </div>
                            <Switch
                                checked={options.sendCredentials}
                                onCheckedChange={(v) =>
                                    onOptionsChange({ ...options, sendCredentials: v })
                                }
                            />
                        </div>
                    )}

                    {/* Duplicate handling */}
                    <div>
                        <Label className="mb-1 text-sm font-medium text-neutral-700">
                            {t('globalOptions.duplicateHandling.label', { term: learnerTerm })}
                        </Label>
                        <Select
                            value={options.duplicateHandling}
                            onValueChange={(v) =>
                                onOptionsChange({
                                    ...options,
                                    duplicateHandling: v as BulkEnrollOptions['duplicateHandling'],
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-popover-above-modal">
                                <SelectItem value="SKIP">
                                    {t('globalOptions.duplicateHandling.skipOption')}
                                </SelectItem>
                                <SelectItem value="ERROR">
                                    {t('globalOptions.duplicateHandling.errorOption')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-neutral-400">
                            {options.duplicateHandling === 'SKIP' &&
                                t('globalOptions.duplicateHandling.skipDescription', {
                                    term: learnersTerm,
                                })}
                            {options.duplicateHandling === 'ERROR' &&
                                t('globalOptions.duplicateHandling.errorDescription', {
                                    term: learnersTerm,
                                })}
                            {' '}
                            {t('globalOptions.duplicateHandling.alwaysReenrolled', {
                                term: learnersTerm.toLowerCase(),
                            })}
                        </p>
                    </div>

                    {/* Payment Date (Optional) */}
                    <div>
                        <Label className="mb-1 text-sm font-medium text-neutral-700">
                            {t('globalOptions.paymentDate.label')}
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        'w-full justify-start text-left font-normal',
                                        !options.paymentDate && 'text-muted-foreground'
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {options.paymentDate ? (
                                        format(parseISO(options.paymentDate), 'PPP')
                                    ) : (
                                        <span>{t('globalOptions.paymentDate.placeholder')}</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="z-popover-above-modal w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={
                                        options.paymentDate
                                            ? parseISO(options.paymentDate)
                                            : undefined
                                    }
                                    onSelect={(date) => {
                                        onOptionsChange({
                                            ...options,
                                            // Send date-only string (YYYY-MM-DD) to avoid
                                            // timezone shift — toISOString() converts local
                                            // midnight to UTC which can roll back one day.
                                            paymentDate: date
                                                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                                                : '',
                                        });
                                    }}
                                    disabled={(date) => date > new Date()}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <p className="mt-1 text-xs text-neutral-400">
                            {t('globalOptions.paymentDate.description')}
                        </p>
                    </div>

                    {/* Transaction ID (Optional) */}
                    <div>
                        <Label className="mb-1 text-sm font-medium text-neutral-700">
                            {t('globalOptions.transactionId.label')}
                        </Label>
                        <Input
                            type="text"
                            placeholder={t('globalOptions.transactionId.placeholder')}
                            value={options.transactionId}
                            onChange={(e) =>
                                onOptionsChange({
                                    ...options,
                                    transactionId: e.target.value,
                                })
                            }
                        />
                        <p className="mt-1 text-xs text-neutral-400">
                            {t('globalOptions.transactionId.description')}
                        </p>
                    </div>
                </div>
            </div>

            <LinkedWorkflowsSection
                instituteId={instituteId}
                selectedPackageSessions={selectedPackageSessions}
            />
        </div>
    );
};

interface LinkedWorkflowsSectionProps {
    instituteId: string;
    selectedPackageSessions: SelectedPackageSession[];
}

/**
 * Shows which automation workflows will fire when these enrollments happen.
 *
 *   - Per-course block: workflows whose trigger.event_id matches that packageSessionId.
 *   - Global block (rendered once): institute-wide workflows (event_id IS NULL) that
 *     fire on every batch enrollment — listed in a single line as the user requested,
 *     since they apply identically to every selected course.
 *   - A global workflow gated on the course by an entry CONDITION (e.g. "only UnlockX
 *     courses") is left out of the global line and listed only under the courses it will
 *     actually fire for.
 */
const LinkedWorkflowsSection = ({
    instituteId,
    selectedPackageSessions,
}: LinkedWorkflowsSectionProps) => {
    const { t } = useTranslation('manageStudentsStep3EnrollConfig');
    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const navigate = useNavigate();

    const { data: workflows = [], isLoading } = useQuery({
        ...getActiveWorkflowsQuery(instituteId),
        enabled: !!instituteId && selectedPackageSessions.length > 0,
    });

    const { perCourse, globalWorkflows } = useMemo(() => {
        // Filter on event_applied_type (set on the workflow_trigger row) rather
        // than a hand-maintained whitelist of trigger event names — the backend
        // is the source of truth for which events scope to a PACKAGE_SESSION,
        // and a stale whitelist would silently hide workflows whose trigger
        // event we missed.
        const packageScoped = workflows.filter(
            (w) => w.trigger?.event_applied_type === 'PACKAGE_SESSION'
        );

        const globals = packageScoped.filter((w) => w.trigger?.event_id == null);

        const byCourse = new Map<
            string,
            { course: SelectedPackageSession; workflows: typeof workflows }
        >();
        for (const ps of selectedPackageSessions) {
            const specific = packageScoped.filter(
                (w) => w.trigger?.event_id === ps.packageSessionId
            );
            byCourse.set(ps.packageSessionId, { course: ps, workflows: specific });
        }

        return { perCourse: byCourse, globalWorkflows: globals };
    }, [workflows, selectedPackageSessions]);

    // A global enrollment workflow can still gate itself on the course (TRIGGER → CONDITION
    // with no false branch). Read those workflows' nodes so a gated one is shown only under the
    // courses it will fire for. Other events (e.g. LEARNER_TERMINATION) run with a different
    // context, so they are never evaluated and keep showing as before. On a failed fetch the
    // workflow is treated as ungated — the pre-existing display.
    const enrollmentGlobals = globalWorkflows.filter(
        (w) => w.trigger?.trigger_event_name === 'LEARNER_BATCH_ENROLLMENT'
    );
    const rawEnrollmentGlobals = useQueries({
        queries: enrollmentGlobals.map((w) => ({
            ...getWorkflowRawQuery(w.id),
            staleTime: 60_000,
            retry: 1,
        })),
    });
    const rawLoading = rawEnrollmentGlobals.some((q) => q.isLoading);
    const entryConditions = new Map<string, string>();
    rawEnrollmentGlobals.forEach((q, i) => {
        const condition = q.data ? findEntryCondition(q.data.nodes ?? []) : null;
        if (condition) entryConditions.set(enrollmentGlobals[i]!.id, condition);
    });
    const alwaysGlobals = globalWorkflows.filter((w) => !entryConditions.has(w.id));
    const conditionalGlobals = globalWorkflows.filter((w) => entryConditions.has(w.id));

    // Conditional globals that will (or may, for learner-based conditions) fire for a course.
    // Like WorkflowTriggerService.handleTriggerEvents: an ACTIVE batch-specific trigger for the
    // same event replaces every global one for that batch.
    const conditionalFor = (ps: SelectedPackageSession) => {
        const own = perCourse.get(ps.packageSessionId)?.workflows ?? [];
        return conditionalGlobals
            .filter(
                (w) =>
                    !own.some(
                        (s) =>
                            s.trigger?.trigger_status === 'ACTIVE' &&
                            s.trigger?.trigger_event_name === w.trigger?.trigger_event_name
                    )
            )
            .map((w) => ({
                workflow: w,
                verdict: evaluateEntryCondition(entryConditions.get(w.id)!, {
                    packageName: ps.courseName,
                    packageSessionId: ps.packageSessionId,
                }),
            }))
            .filter((g) => g.verdict !== 'skips');
    };

    if (selectedPackageSessions.length === 0) return null;

    const totalSpecific = Array.from(perCourse.values()).reduce(
        (n, entry) => n + entry.workflows.length,
        0
    );
    const hasAny =
        totalSpecific > 0 ||
        alwaysGlobals.length > 0 ||
        selectedPackageSessions.some((ps) => conditionalFor(ps).length > 0);

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <Lightning size={16} weight="duotone" className="text-primary-500" />
                <h3 className="text-sm font-semibold text-neutral-700">
                    {t('workflows.heading')}
                </h3>
            </div>

            {(isLoading || rawLoading) && (
                <p className="text-xs text-neutral-400">{t('workflows.loading')}</p>
            )}

            {!isLoading && !rawLoading && !hasAny && (
                <p className="text-xs text-neutral-400">
                    {t('workflows.noneLinked', { term: courseTerm.toLowerCase() })}
                </p>
            )}

            {!isLoading && !rawLoading && hasAny && (
                <div className="flex flex-col gap-3">
                    {alwaysGlobals.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 px-3 py-2">
                            <Badge
                                variant="outline"
                                className="border-neutral-200 bg-white text-caption font-medium text-neutral-600"
                            >
                                {t('workflows.global')}
                            </Badge>
                            <span className="text-xs text-neutral-500">
                                {t('workflows.firesOnEveryEnrollment')}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                {alwaysGlobals.map((w, idx) => (
                                    <span key={w.id} className="inline-flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate({ to: `/workflow/${w.id}` as never })
                                            }
                                            className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                                        >
                                            {w.name}
                                            <ArrowSquareOut size={12} weight="duotone" />
                                        </button>
                                        {idx < alwaysGlobals.length - 1 && (
                                            <span className="text-xs text-neutral-400">,</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedPackageSessions.map((ps) => {
                        const entry = perCourse.get(ps.packageSessionId);
                        const list = entry?.workflows ?? [];
                        const gated = conditionalFor(ps);
                        return (
                            <div
                                key={ps.packageSessionId}
                                className="rounded-md border border-neutral-100 px-3 py-2"
                            >
                                <div className="mb-1 flex items-center gap-2">
                                    <BookOpen
                                        size={14}
                                        weight="duotone"
                                        className="text-primary-500"
                                    />
                                    <span className="text-xs font-semibold text-neutral-800">
                                        {ps.courseName}
                                    </span>
                                    <span className="text-caption text-neutral-400">
                                        {ps.levelName}
                                    </span>
                                </div>
                                {list.length === 0 && gated.length === 0 ? (
                                    <p className="text-caption text-neutral-400">
                                        {t('workflows.noCourseSpecific')}
                                    </p>
                                ) : (
                                    <ul className="flex flex-col gap-1 pl-1">
                                        {list.map((w) => (
                                            <li
                                                key={w.id}
                                                className="flex items-center gap-2 text-xs text-neutral-700"
                                            >
                                                <Lightning
                                                    size={12}
                                                    weight="fill"
                                                    className="text-primary-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        navigate({
                                                            to: `/workflow/${w.id}` as never,
                                                        })
                                                    }
                                                    className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline"
                                                >
                                                    {w.name}
                                                    <ArrowSquareOut
                                                        size={12}
                                                        weight="duotone"
                                                    />
                                                </button>
                                                {w.trigger?.trigger_event_name && (
                                                    <span className="font-mono text-caption text-neutral-400">
                                                        {w.trigger.trigger_event_name}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                        {gated.map(({ workflow: w, verdict }) => (
                                            <li
                                                key={w.id}
                                                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-700"
                                            >
                                                {verdict === 'runs' ? (
                                                    <Lightning
                                                        size={12}
                                                        weight="fill"
                                                        className="text-primary-500"
                                                    />
                                                ) : (
                                                    <Question
                                                        size={12}
                                                        className="text-warning-500"
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        navigate({
                                                            to: `/workflow/${w.id}` as never,
                                                        })
                                                    }
                                                    className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline"
                                                >
                                                    {w.name}
                                                    <ArrowSquareOut size={12} weight="duotone" />
                                                </button>
                                                <span
                                                    className={cn(
                                                        'text-caption',
                                                        verdict === 'runs'
                                                            ? 'text-neutral-400'
                                                            : 'text-warning-600'
                                                    )}
                                                >
                                                    {t(`workflows.verdict.${verdict}`, {
                                                        term: courseTerm.toLowerCase(),
                                                    })}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
