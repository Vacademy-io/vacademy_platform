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
import { BookOpen, Lightning } from '@phosphor-icons/react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarBlank as CalendarIcon } from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { getActiveWorkflowsQuery } from '@/services/workflow-service';
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
    const { data: resolved } = useResolvedInviteDetails({
        instituteId,
        packageSessionId: ps.packageSessionId,
        enrollInviteId: ps.enrollInviteId,
    });
    const isCpo = resolved?.paymentOption?.type === 'CPO';
    const cpoId = resolved?.complexPaymentOptionId ?? null;

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
                    <Label className="mb-1 text-xs text-neutral-500">Invite Link</Label>
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
                            })
                        }
                    />
                </div>
                <div className="w-36">
                    <Label className="mb-1 text-xs text-neutral-500">Access Days Override</Label>
                    <Input
                        type="number"
                        min={1}
                        placeholder="From invite"
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
                            (auto-resolved from DEFAULT invite)
                        </span>
                    )}
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
                    Enrollment Invite per {courseTerm}
                </h3>
                <p className="mb-3 text-xs text-neutral-400">
                    Choose an invite link for each {courseTerm.toLowerCase()}. Leave blank to
                    auto-use the default invite.
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
                <h3 className="mb-3 text-sm font-semibold text-neutral-700">Global Options</h3>
                <div className="flex flex-col gap-4">
                    {/* Notify learners — visibility controlled by Course Settings */}
                    {showNotifyLearners && (
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium text-neutral-700">
                                    Notify {learnersTerm}
                                </Label>
                                <p className="text-xs text-neutral-400">
                                    Send enrollment confirmation emails to newly enrolled{' '}
                                    {learnersTerm.toLowerCase()}
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
                                    Send Credentials
                                </Label>
                                <p className="text-xs text-neutral-400">
                                    Send registration email with login credentials to new{' '}
                                    {learnersTerm.toLowerCase()}
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
                            If {learnerTerm} is Already Enrolled
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
                                <SelectItem value="SKIP">Skip silently (recommended)</SelectItem>
                                <SelectItem value="RE_ENROLL">
                                    Re-enroll (reactivate expired/terminated)
                                </SelectItem>
                                <SelectItem value="ERROR">Mark as error in report</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-neutral-400">
                            {options.duplicateHandling === 'SKIP' &&
                                `Already enrolled ${learnersTerm.toLowerCase()} will be silently skipped.`}
                            {options.duplicateHandling === 'RE_ENROLL' &&
                                `${learnersTerm} with expired or terminated access will be re-activated.`}
                            {options.duplicateHandling === 'ERROR' &&
                                `Already enrolled ${learnersTerm.toLowerCase()} will appear as failures in the results.`}
                        </p>
                    </div>

                    {/* Payment Date (Optional) */}
                    <div>
                        <Label className="mb-1 text-sm font-medium text-neutral-700">
                            Payment Date (Optional)
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
                                        <span>Select payment date</span>
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
                            Date when the payment was made
                        </p>
                    </div>

                    {/* Transaction ID (Optional) */}
                    <div>
                        <Label className="mb-1 text-sm font-medium text-neutral-700">
                            Transaction ID (Optional)
                        </Label>
                        <Input
                            type="text"
                            placeholder="Enter transaction ID"
                            value={options.transactionId}
                            onChange={(e) =>
                                onOptionsChange({
                                    ...options,
                                    transactionId: e.target.value,
                                })
                            }
                        />
                        <p className="mt-1 text-xs text-neutral-400">
                            External payment transaction reference
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
 */
const LinkedWorkflowsSection = ({
    instituteId,
    selectedPackageSessions,
}: LinkedWorkflowsSectionProps) => {
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

    if (selectedPackageSessions.length === 0) return null;

    const totalSpecific = Array.from(perCourse.values()).reduce(
        (n, entry) => n + entry.workflows.length,
        0
    );
    const hasAny = totalSpecific > 0 || globalWorkflows.length > 0;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <Lightning size={16} weight="duotone" className="text-primary-500" />
                <h3 className="text-sm font-semibold text-neutral-700">
                    Workflows that will fire on enrollment
                </h3>
            </div>

            {isLoading && (
                <p className="text-xs text-neutral-400">Loading linked workflows…</p>
            )}

            {!isLoading && !hasAny && (
                <p className="text-xs text-neutral-400">
                    No automation workflows are linked to the selected{' '}
                    {courseTerm.toLowerCase()}s.
                </p>
            )}

            {!isLoading && hasAny && (
                <div className="flex flex-col gap-3">
                    {globalWorkflows.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 px-3 py-2">
                            <Badge
                                variant="outline"
                                className="border-neutral-200 bg-white text-caption font-medium text-neutral-600"
                            >
                                Global
                            </Badge>
                            <span className="text-xs text-neutral-500">
                                Fires on every batch enrollment:
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                {globalWorkflows.map((w, idx) => (
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
                                        {idx < globalWorkflows.length - 1 && (
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
                                {list.length === 0 ? (
                                    <p className="text-caption text-neutral-400">
                                        No course-specific workflows linked.
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
