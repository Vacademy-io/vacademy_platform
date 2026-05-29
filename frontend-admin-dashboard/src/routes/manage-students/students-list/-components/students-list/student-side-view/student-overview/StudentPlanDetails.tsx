import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import {
    Crown,
    Eye,
    Calendar,
    ArrowsClockwise,
    Prohibit,
    CheckCircle,
    CaretDown,
    CaretUp,
    CreditCard,
    Clock,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useState, useEffect, useCallback } from 'react';
import { getUserPlans, UserPlan } from '@/services/user-plan';
import { toast } from 'sonner';
import { formatDate, format } from 'date-fns';
import { PolicyActionsTimeline } from '@/components/common/PolicyActionsTimeline';
import type { PolicyDetails } from '@/types/membership-expiry';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileFieldRow,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileHero,
    ProfileMiniBar,
} from '../profile-ui';

interface StudentPlanDetailsProps {
    userId: string;
    instituteId?: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

// ── Tone helpers ──────────────────────────────────────────────────────────────

type PlanTone = 'success' | 'warning' | 'danger';

// Tone reflects how much of the plan window has been USED. Low elapsed = safe
// (lots of plan life left); high elapsed = renewal urgency.
const deriveTone = (pctElapsed: number): PlanTone =>
    pctElapsed <= 50 ? 'success' : pctElapsed <= 85 ? 'warning' : 'danger';

const computePlanMeta = (plan: UserPlan) => {
    const now = Date.now();
    const endMs = plan.end_date ? new Date(plan.end_date).getTime() : null;
    const startMs = plan.start_date
        ? new Date(plan.start_date).getTime()
        : plan.created_at
          ? new Date(plan.created_at).getTime()
          : null;

    const daysLeft = endMs != null ? Math.max(0, Math.floor((endMs - now) / DAY_MS)) : 0;

    // "% of the plan window already used" — the bar grows as the plan ages,
    // matching how users intuitively read a left-to-right fill ("how far through
    // are we"). The subtitle keeps the numeric "X days left" so users still
    // see the remaining time at a glance.
    let pctElapsed = 0;
    if (endMs != null && startMs != null && endMs > startMs) {
        pctElapsed = ((now - startMs) / (endMs - startMs)) * 100;
    } else if (endMs != null) {
        pctElapsed = (1 - daysLeft / 365) * 100;
    }
    pctElapsed = Math.min(100, Math.max(0, pctElapsed));

    return { daysLeft, pctElapsed, tone: deriveTone(pctElapsed) };
};

// ── Status pill ───────────────────────────────────────────────────────────────

const StatusPill = ({ status }: { status: string }) => {
    const upper = status?.toUpperCase();
    const pill =
        upper === 'ACTIVE'
            ? 'bg-success-50 text-success-700 ring-success-200'
            : upper === 'EXPIRED'
              ? 'bg-danger-50 text-danger-700 ring-danger-200'
              : upper === 'PENDING'
                ? 'bg-warning-50 text-warning-700 ring-warning-200'
                : upper === 'CANCELLED'
                  ? 'bg-neutral-100 text-neutral-600 ring-neutral-200'
                  : 'bg-neutral-100 text-neutral-600 ring-neutral-200';

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                pill
            )}
        >
            {status}
        </span>
    );
};

// ── Auto-Renewal Badge ────────────────────────────────────────────────────────

const AutoRenewalBadge = ({ policy }: { policy: PolicyDetails | null }) => {
    if (!policy?.on_expiry_policy) return null;

    const isEnabled = policy.on_expiry_policy.enable_auto_renewal;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                            isEnabled
                                ? 'bg-success-50 text-success-700 ring-success-200'
                                : 'bg-neutral-100 text-neutral-500 ring-neutral-200'
                        )}
                    >
                        {isEnabled ? (
                            <ArrowsClockwise className="size-3" />
                        ) : (
                            <Prohibit className="size-3" />
                        )}
                        {isEnabled ? 'Auto-Renewal' : 'No Auto-Renewal'}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    {isEnabled
                        ? `Payment attempt on ${
                              policy.on_expiry_policy.next_payment_attempt_date
                                  ? format(
                                        new Date(policy.on_expiry_policy.next_payment_attempt_date),
                                        'MMM dd, yyyy'
                                    )
                                  : 'scheduled date'
                          }`
                        : 'Auto-renewal is disabled'}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// ── Policy Details Section ────────────────────────────────────────────────────

const PolicyDetailsSection = ({
    policy,
    compact = false,
}: {
    policy: PolicyDetails | null;
    compact?: boolean;
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!policy) return null;

    const hasExpiryPolicy = policy.on_expiry_policy !== null;
    const hasReenrollmentPolicy = policy.reenrollment_policy !== null;
    const hasPolicyActions = policy.policy_actions && policy.policy_actions.length > 0;

    if (!hasExpiryPolicy && !hasReenrollmentPolicy && !hasPolicyActions) return null;

    return (
        <div className="mt-3 space-y-2">
            {/* Expiry Policy */}
            {hasExpiryPolicy && (
                <div className="rounded-md bg-neutral-50 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                            Expiry Policy
                        </span>
                        <AutoRenewalBadge policy={policy} />
                    </div>

                    <dl className="divide-y divide-neutral-100">
                        {policy.on_expiry_policy?.final_expiry_date && (
                            <div className="flex items-center gap-1.5 py-1">
                                <Calendar className="size-3 text-danger-400 shrink-0" />
                                <span className="text-xs text-neutral-600">
                                    Final:{' '}
                                    {format(
                                        new Date(policy.on_expiry_policy.final_expiry_date),
                                        'MMM dd, yyyy'
                                    )}
                                </span>
                            </div>
                        )}
                        {policy.on_expiry_policy?.waiting_period_in_days !== undefined &&
                            policy.on_expiry_policy.waiting_period_in_days > 0 && (
                                <div className="flex items-center gap-1.5 py-1">
                                    <Clock className="size-3 text-warning-400 shrink-0" />
                                    <span className="text-xs text-neutral-600">
                                        {policy.on_expiry_policy.waiting_period_in_days} day grace
                                        period
                                    </span>
                                </div>
                            )}
                    </dl>
                </div>
            )}

            {/* Re-enrollment */}
            {hasReenrollmentPolicy && (
                <div className="rounded-md bg-neutral-50 p-2.5">
                    <div className="flex items-center gap-2">
                        {policy.reenrollment_policy?.allow_reenrollment_after_expiry ? (
                            <>
                                <CheckCircle className="size-3.5 text-success-500 shrink-0" />
                                <span className="text-xs text-neutral-600">
                                    Re-enrollment{' '}
                                    {policy.reenrollment_policy.next_eligible_enrollment_date
                                        ? `from ${format(
                                              new Date(
                                                  policy.reenrollment_policy.next_eligible_enrollment_date
                                              ),
                                              'MMM dd, yyyy'
                                          )}`
                                        : 'available'}
                                    {policy.reenrollment_policy.reenrollment_gap_in_days > 0 && (
                                        <span className="text-neutral-400 ml-1">
                                            ({policy.reenrollment_policy.reenrollment_gap_in_days}{' '}
                                            day gap)
                                        </span>
                                    )}
                                </span>
                            </>
                        ) : (
                            <>
                                <Prohibit className="size-3.5 text-danger-400 shrink-0" />
                                <span className="text-xs text-neutral-500">
                                    Re-enrollment not allowed
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Policy Actions Timeline (Expandable) */}
            {hasPolicyActions && !compact && (
                <div className="rounded-md bg-neutral-50 overflow-hidden">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                        <span>Policy Actions ({policy.policy_actions.length})</span>
                        {isExpanded ? (
                            <CaretUp className="size-3" />
                        ) : (
                            <CaretDown className="size-3" />
                        )}
                    </button>
                    {isExpanded && (
                        <div className="px-2.5 pb-2.5">
                            <PolicyActionsTimeline
                                actions={policy.policy_actions}
                                compact={true}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Past Plan Row (compact rows inside the history card) ──────────────────────

const PastPlanRows = ({
    plan,
    getPlanName,
    getOptionName,
    getPlanCurrency,
    getPlanAmount,
    getCurrencySymbol,
    getExpiryDate,
    getFirstPolicy,
}: {
    plan: UserPlan;
    getPlanName: (p: UserPlan) => string;
    getOptionName: (p: UserPlan) => string;
    getPlanCurrency: (p: UserPlan) => string;
    getPlanAmount: (p: UserPlan) => number;
    getCurrencySymbol: (c: string) => string;
    getExpiryDate: (p: UserPlan) => string | null;
    getFirstPolicy: (p: UserPlan) => PolicyDetails | null;
}) => {
    const policy = getFirstPolicy(plan);
    const status = plan.payment_plan_dto?.status || plan.status;
    const currency = getPlanCurrency(plan);

    return (
        <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-800 truncate">
                    {getOptionName(plan)} — {getPlanName(plan)}
                </span>
                <StatusPill status={status} />
            </div>
            <dl className="divide-y divide-neutral-100">
                <ProfileFieldRow label="Type" value={plan.payment_option.type} />
                {policy?.package_session_name && (
                    <ProfileFieldRow label="Session" value={policy.package_session_name} />
                )}
                {currency !== 'N/A' && (
                    <ProfileFieldRow
                        label="Amount"
                        value={`${getCurrencySymbol(currency)}${getPlanAmount(plan)}`}
                    />
                )}
                {plan.start_date && (
                    <ProfileFieldRow
                        label="Started"
                        value={formatDate(new Date(plan.start_date), 'dd MMM yyyy')}
                    />
                )}
                {getExpiryDate(plan) && (
                    <ProfileFieldRow label="Ends" value={getExpiryDate(plan)} />
                )}
            </dl>
            <PolicyDetailsSection policy={policy} />
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

const StudentPlanDetails = ({ userId, instituteId }: StudentPlanDetailsProps) => {
    const [activePlan, setActivePlan] = useState<UserPlan | null>(null);
    const [isLoadingActive, setIsLoadingActive] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const [allPlans, setAllPlans] = useState<UserPlan[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const pageSize = 5;

    const loadActivePlan = useCallback(async () => {
        if (!userId) return;

        try {
            setIsLoadingActive(true);
            setHasError(false);
            const response = await getUserPlans(1, 1, ['ACTIVE'], userId, instituteId);

            if (response.content && response.content.length > 0) {
                const plan = response.content[0];
                if (plan) {
                    setActivePlan(plan);
                }
            } else {
                setActivePlan(null);
            }
        } catch (error) {
            console.error('Error loading active plan:', error);
            setHasError(true);
        } finally {
            setIsLoadingActive(false);
        }
    }, [userId, instituteId]);

    useEffect(() => {
        loadActivePlan();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, instituteId]);

    const handleViewDetails = async () => {
        if (!userId) return;

        try {
            setShowDetailsDialog(true);
            setCurrentPage(1);
            setIsLoadingHistory(true);
            const response = await getUserPlans(
                1,
                pageSize,
                ['ACTIVE', 'EXPIRED'],
                userId,
                instituteId
            );
            setAllPlans(response.content || []);
            setTotalPages(response.totalPages || 1);
        } catch (error) {
            console.error('Error loading plan history:', error);
            toast.error('Failed to load plan history');
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handlePageChange = async (pageNo: number) => {
        if (!userId) return;

        try {
            setIsLoadingHistory(true);
            const response = await getUserPlans(
                pageNo,
                pageSize,
                ['ACTIVE', 'EXPIRED'],
                userId,
                instituteId
            );
            setAllPlans(response.content || []);
            setCurrentPage(pageNo);
            setTotalPages(response.totalPages || 1);
        } catch (error) {
            console.error('Error loading page:', error);
            toast.error('Failed to load plans');
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const getCurrencySymbol = (currency: string): string => {
        const symbols: { [key: string]: string } = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            INR: '₹',
            JPY: '¥',
        };
        return symbols[currency] || currency;
    };

    // Extract plan name and details from nested structure
    const getPlanName = (plan: UserPlan): string => {
        try {
            if (plan.payment_plan_dto?.name) {
                return plan.payment_plan_dto.name;
            }
            if (typeof plan.plan_json === 'string') {
                const parsed = JSON.parse(plan.plan_json);
                return parsed.name || 'Unknown Plan';
            }
            return 'Unknown Plan';
        } catch {
            return 'Unknown Plan';
        }
    };

    const getOptionName = (plan: UserPlan): string => {
        try {
            if (plan.payment_option?.name) {
                return plan.payment_option.name;
            }
            return 'Unknown Payment Option';
        } catch {
            return 'Unknown Payment Option';
        }
    };

    const getPlanCurrency = (plan: UserPlan): string => {
        return plan.payment_plan_dto?.currency || 'N/A';
    };

    const getPlanAmount = (plan: UserPlan): number => {
        return plan.payment_plan_dto?.actual_price || 0;
    };

    const getExpiryDate = (plan: UserPlan): string | null => {
        if (plan.end_date) {
            return formatDate(new Date(plan.end_date), 'dd MMM yyyy');
        }
        const validityDays = plan.payment_plan_dto?.validity_in_days;
        if (validityDays && plan.start_date) {
            const startDate = new Date(plan.start_date);
            startDate.setDate(startDate.getDate() + validityDays);
            return formatDate(startDate, 'dd MMM yyyy');
        }
        return null;
    };

    const getFirstPolicy = (plan: UserPlan): PolicyDetails | null => {
        if (plan.policy_details && plan.policy_details.length > 0) {
            return plan.policy_details[0] || null;
        }
        return null;
    };

    // ── Derived active plan display values ────────────────────────────────────

    const activeMeta = activePlan ? computePlanMeta(activePlan) : null;
    const activeTone = activeMeta?.tone ?? 'success';
    const activePct = activeMeta?.pctElapsed ?? 0;
    const activeDaysLeft = activeMeta?.daysLeft ?? 0;
    const activeExpiryDate = activePlan ? getExpiryDate(activePlan) : null;
    const activePlanName = activePlan ? getPlanName(activePlan) : '';
    const activePolicy = activePlan ? getFirstPolicy(activePlan) : null;
    const activeCurrency = activePlan ? getPlanCurrency(activePlan) : 'N/A';

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {/* Loading */}
            {isLoadingActive && <ProfileSkeleton blocks={1} />}

            {/* Error */}
            {!isLoadingActive && hasError && (
                <ProfileError
                    title="Couldn't load plan"
                    hint="Something went wrong fetching the active membership plan."
                    onRetry={loadActivePlan}
                />
            )}

            {/* Empty */}
            {!isLoadingActive && !hasError && !activePlan && (
                <ProfileEmpty
                    icon={CreditCard}
                    title="No plans yet"
                    hint="This learner doesn't have an active membership plan."
                />
            )}

            {/* Active Plan — Hero + attribute card */}
            {!isLoadingActive && !hasError && activePlan && (
                <div className="flex flex-col gap-3">
                    {/* Hero */}
                    <ProfileHero
                        eyebrow="ACTIVE PLAN"
                        title={activePlanName}
                        subtitle={
                            activeExpiryDate
                                ? `Expires ${activeExpiryDate} · ${activeDaysLeft} days left`
                                : `${activeDaysLeft} days left`
                        }
                        icon={Crown}
                        tone={activeTone}
                        action={
                            <StatusPill
                                status={
                                    activePlan.payment_plan_dto?.status || activePlan.status
                                }
                            />
                        }
                    >
                        {/* Width is data-driven (elapsed fraction of the plan window).
                            Tone is explicit so the bar's auto-tone (designed for
                            completion %) doesn't flip success/warning incorrectly. */}
                        <ProfileMiniBar value={activePct} tone={activeTone} />
                    </ProfileHero>

                    {/* Plan attributes */}
                    <ProfileSectionCard icon={CreditCard} heading="Plan Details">
                        <dl className="divide-y divide-neutral-100">
                            <ProfileFieldRow
                                label="Option"
                                value={getOptionName(activePlan)}
                            />
                            {activeCurrency !== 'N/A' && (
                                <ProfileFieldRow
                                    label="Amount"
                                    value={`${getCurrencySymbol(activeCurrency)}${getPlanAmount(activePlan)}`}
                                />
                            )}
                            {activePlan.payment_plan_dto?.validity_in_days != null && (
                                <ProfileFieldRow
                                    label="Validity"
                                    value={`${activePlan.payment_plan_dto.validity_in_days} days`}
                                />
                            )}
                            {activePlan.start_date && (
                                <ProfileFieldRow
                                    label="Started"
                                    value={formatDate(
                                        new Date(activePlan.start_date),
                                        'dd MMM yyyy'
                                    )}
                                />
                            )}
                            {activeExpiryDate && (
                                <ProfileFieldRow label="Valid till" value={activeExpiryDate} />
                            )}
                            {activePolicy?.on_expiry_policy != null && (
                                <ProfileFieldRow
                                    label="Auto-renewal"
                                    value={
                                        <AutoRenewalBadge policy={activePolicy} />
                                    }
                                />
                            )}
                            {activePolicy?.on_expiry_policy?.waiting_period_in_days != null &&
                                activePolicy.on_expiry_policy.waiting_period_in_days > 0 && (
                                    <ProfileFieldRow
                                        label="Grace period"
                                        value={`${activePolicy.on_expiry_policy.waiting_period_in_days} days`}
                                    />
                                )}
                        </dl>

                        <PolicyDetailsSection policy={activePolicy} compact={true} />

                        <div className="mt-3">
                            <MyButton
                                onClick={handleViewDetails}
                                buttonType="secondary"
                                scale="small"
                                className="w-full"
                            >
                                <Eye className="size-3.5" />
                                View All Plans
                            </MyButton>
                        </div>
                    </ProfileSectionCard>
                </div>
            )}

            {/* Plans History Dialog */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-h-screen w-full max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Payment Plans History</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        {isLoadingHistory ? (
                            <ProfileSkeleton blocks={2} />
                        ) : allPlans.length === 0 ? (
                            <ProfileEmpty
                                icon={CreditCard}
                                title="No plans found"
                                hint="There are no payment plans recorded for this learner."
                            />
                        ) : (
                            <>
                                {/* Past plans section */}
                                <ProfileSectionCard icon={Clock} heading="Past plans">
                                    <div className="space-y-3">
                                        {allPlans.map((plan) => (
                                            <PastPlanRows
                                                key={plan.id}
                                                plan={plan}
                                                getPlanName={getPlanName}
                                                getOptionName={getOptionName}
                                                getPlanCurrency={getPlanCurrency}
                                                getPlanAmount={getPlanAmount}
                                                getCurrencySymbol={getCurrencySymbol}
                                                getExpiryDate={getExpiryDate}
                                                getFirstPolicy={getFirstPolicy}
                                            />
                                        ))}
                                    </div>
                                </ProfileSectionCard>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                                        <span className="text-sm text-neutral-600">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <div className="flex gap-2">
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                disable={currentPage === 1 || isLoadingHistory}
                                                onClick={() =>
                                                    handlePageChange(currentPage - 1)
                                                }
                                            >
                                                Previous
                                            </MyButton>
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                disable={
                                                    currentPage === totalPages || isLoadingHistory
                                                }
                                                onClick={() =>
                                                    handlePageChange(currentPage + 1)
                                                }
                                            >
                                                Next
                                            </MyButton>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default StudentPlanDetails;
