import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
<<<<<<< HEAD
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
=======
import { ProgressBar } from '@/components/design-system/progress-bar';
import {
    Clock,
    Eye,
    Warning,
    ArrowsClockwise,
    Calendar,
    CheckCircle,
    Prohibit,
    CaretDown,
    CaretUp,
    CurrencyDollar,
    Tag,
    TrendUp,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
>>>>>>> origin/main
import { getUserPlans, UserPlan } from '@/services/user-plan';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { toast } from 'sonner';
<<<<<<< HEAD
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
=======
import { format, formatDate } from 'date-fns';
import { PolicyActionsTimeline } from '@/components/common/PolicyActionsTimeline';
import type { PolicyDetails } from '@/types/membership-expiry';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { cn } from '@/lib/utils';
>>>>>>> origin/main

interface StudentPlanDetailsProps {
    userId: string;
    instituteId?: string;
}

<<<<<<< HEAD
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
=======
const getFirstPolicy = (plan: UserPlan): PolicyDetails | null => {
    if (plan.policy_details && plan.policy_details.length > 0) {
        return plan.policy_details[0] || null;
>>>>>>> origin/main
    }
    pctElapsed = Math.min(100, Math.max(0, pctElapsed));

    return { daysLeft, pctElapsed, tone: deriveTone(pctElapsed) };
};

<<<<<<< HEAD
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

=======
const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        INR: '₹',
        JPY: '¥',
    };
    return symbols[currency] || currency;
};

const getPlanName = (plan: UserPlan): string => {
    try {
        if (plan.payment_plan_dto?.name) return plan.payment_plan_dto.name;
        if (typeof plan.plan_json === 'string') {
            const parsed = JSON.parse(plan.plan_json);
            return parsed.name || 'Unknown Plan';
        }
        return 'Unknown Plan';
    } catch {
        return 'Unknown Plan';
    }
};

const getOptionName = (plan: UserPlan): string =>
    plan.payment_option?.name || 'Unknown Payment Option';

const getPlanAmount = (plan: UserPlan): number => plan.payment_plan_dto?.actual_price || 0;

const getPlanCurrency = (plan: UserPlan): string => plan.payment_plan_dto?.currency || 'N/A';

const getCourseLabel = (plan: UserPlan): string => {
    const policy = getFirstPolicy(plan);
    return (
        policy?.package_session_name?.trim() ||
        plan.enroll_invite?.name?.trim() ||
        getPlanName(plan)
    );
};

const computeDaysLeft = (endDate?: string | null): number | null => {
    if (!endDate) return null;
    const diffMs = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * Reads the coupon snapshot for display. Prefers the structured
 * {@code applied_coupon} field that the BE now exposes (see
 * CouponSnapshotDTO); falls back to parsing the raw
 * {@code applied_coupon_discount_json} blob so we keep working against
 * older BE builds that haven't deployed the structured field yet.
 */
interface RawCouponSnapshot {
    discountType?: string;
    discount_type?: string;
    discountPoint?: number;
    discount_point?: number;
    maxDiscountPoint?: number | null;
    max_discount_point?: number | null;
    couponCode?: { code?: string } | null;
    coupon_code?: { code?: string } | null;
    name?: string;
}

/**
 * Mirrors the BE's CouponDiscountUtil.computeDiscount so we can render the
 * effective amount the learner actually paid (plan price minus this value)
 * on the membership card. Plays it safe — never returns a negative number,
 * never returns more than the cap when one is set.
 */
const computeCouponDiscount = (
    grossAmount: number,
    applied: { type: string | null; point: number | null; maxPoint: number | null } | null
): number => {
    if (!applied || applied.point == null) return 0;
    const point = applied.point;
    if ((applied.type || '').toUpperCase() === 'PERCENTAGE') {
        const raw = (grossAmount * point) / 100;
        const capped = applied.maxPoint != null ? Math.min(raw, applied.maxPoint) : raw;
        return Math.max(0, Math.min(grossAmount, capped));
    }
    return Math.max(0, Math.min(grossAmount, point));
};

const parseAppliedCoupon = (plan: UserPlan) => {
    if (plan.applied_coupon) {
        const a = plan.applied_coupon;
        if (!a.coupon_code && a.discount_point == null) return null;
        return {
            code: a.coupon_code ?? null,
            type: a.discount_type ?? null,
            point: a.discount_point ?? null,
            maxPoint: a.max_discount_point ?? null,
        };
    }
    if (!plan.applied_coupon_discount_id || !plan.applied_coupon_discount_json) return null;
    try {
        const raw = JSON.parse(plan.applied_coupon_discount_json) as RawCouponSnapshot;
        const code = raw.couponCode?.code || raw.coupon_code?.code || raw.name || null;
        const type = raw.discountType ?? raw.discount_type ?? null;
        const point = raw.discountPoint ?? raw.discount_point ?? null;
        const maxPoint = raw.maxDiscountPoint ?? raw.max_discount_point ?? null;
        if (!code && point == null) return null;
        return { code, type, point, maxPoint };
    } catch {
        return null;
    }
};

const getExpiryLabel = (plan: UserPlan): string | null => {
    if (plan.end_date) return formatDate(new Date(plan.end_date), 'dd MMM yyyy');
    const validityDays = plan.payment_plan_dto?.validity_in_days;
    if (validityDays && plan.start_date) {
        const startDate = new Date(plan.start_date);
        startDate.setDate(startDate.getDate() + validityDays);
        return formatDate(startDate, 'dd MMM yyyy');
    }
    return null;
};

const PlanStatusBadge = ({ status }: { status?: string }) => {
    const normalized = (status || '').toUpperCase();
    const map: Record<string, { label: string; classes: string }> = {
        ACTIVE: {
            label: 'Plan Active',
            classes: 'bg-success-50 text-success-700 ring-success-200',
        },
        EXPIRED: {
            label: 'Plan Expired',
            classes: 'bg-danger-50 text-danger-700 ring-danger-200',
        },
    };
    const entry = map[normalized] || {
        label: normalized || 'Unknown',
        classes: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
    };
>>>>>>> origin/main
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
<<<<<<< HEAD
                pill
            )}
        >
            {status}
=======
                entry.classes
            )}
        >
            {entry.label}
>>>>>>> origin/main
        </span>
    );
};

<<<<<<< HEAD
// ── Auto-Renewal Badge ────────────────────────────────────────────────────────
=======
const EnrollmentStatusBadge = ({
    enrollmentStatus,
}: {
    enrollmentStatus: 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | null;
}) => {
    if (!enrollmentStatus) return null;
    if (enrollmentStatus === 'ACTIVE') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700 ring-1 ring-success-200">
                <CheckCircle className="size-3" />
                Enrollment Active
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger-700 ring-1 ring-danger-200">
            <Prohibit className="size-3" />
            Course Inactive
        </span>
    );
};

/**
 * Renders the coupon used at enrollment (if any). Pulls the snapshot from
 * UserPlan.applied_coupon_discount_json so the row keeps showing the right
 * info even if the coupon definition changed after the redemption.
 */
const CouponAppliedRow = ({ plan, currency }: { plan: UserPlan; currency: string }) => {
    const applied = parseAppliedCoupon(plan);
    if (!applied) return null;
    const isPercentage = (applied.type || '').toUpperCase() === 'PERCENTAGE';
    const discountLabel = isPercentage
        ? `${applied.point}% off${applied.maxPoint ? ` · max ${getCurrencySymbol(currency)}${applied.maxPoint}` : ''}`
        : `${getCurrencySymbol(currency === 'N/A' ? 'INR' : currency)}${applied.point} off`;
    return (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-success-200 bg-success-50 px-2.5 py-1.5">
            <Tag className="size-3.5 shrink-0 text-success-600" weight="fill" />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs font-semibold text-success-700">
                        {applied.code || 'Coupon'}
                    </span>
                    {applied.point != null && (
                        <span className="text-xs text-success-600">{discountLabel}</span>
                    )}
                </div>
            </div>
        </div>
    );
};
>>>>>>> origin/main

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
<<<<<<< HEAD
                                : 'bg-neutral-100 text-neutral-500 ring-neutral-200'
=======
                                : 'bg-neutral-100 text-neutral-600 ring-neutral-200'
>>>>>>> origin/main
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

<<<<<<< HEAD
// ── Policy Details Section ────────────────────────────────────────────────────

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
        <div className="mt-3 space-y-2">
            {/* Expiry Policy */}
            {hasExpiryPolicy && (
                <div className="rounded-md bg-neutral-50 p-2.5 space-y-2">
=======
        <div className="mt-2 space-y-2">
            {hasExpiryPolicy && (
                <div className="space-y-1.5 rounded-md bg-neutral-50 p-2">
>>>>>>> origin/main
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                            Expiry Policy
                        </span>
                        <AutoRenewalBadge policy={policy} />
                    </div>
<<<<<<< HEAD

                    <dl className="divide-y divide-neutral-100">
                        {policy.on_expiry_policy?.final_expiry_date && (
                            <div className="flex items-center gap-1.5 py-1">
                                <Calendar className="size-3 text-danger-400 shrink-0" />
                                <span className="text-xs text-neutral-600">
=======
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        {policy.on_expiry_policy?.final_expiry_date && (
                            <div className="flex items-center gap-1">
                                <Calendar className="size-3 text-danger-500" />
                                <span className="text-neutral-600">
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
                                <div className="flex items-center gap-1">
                                    <Clock className="size-3 text-warning-500" />
                                    <span className="text-neutral-600">
                                        {policy.on_expiry_policy.waiting_period_in_days} day grace
                                    </span>
                                </div>
                            )}
                    </div>
                </div>
            )}

            {hasReenrollmentPolicy && (
                <div className="rounded-md bg-neutral-50 p-2">
                    <div className="flex items-center gap-2 text-xs">
                        {policy.reenrollment_policy?.allow_reenrollment_after_expiry ? (
                            <>
                                <CheckCircle className="size-3 text-success-500" />
                                <span className="text-neutral-600">
>>>>>>> origin/main
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
<<<<<<< HEAD
                                        <span className="text-neutral-400 ml-1">
=======
                                        <span className="ml-1 text-neutral-400">
>>>>>>> origin/main
                                            ({policy.reenrollment_policy.reenrollment_gap_in_days}{' '}
                                            day gap)
                                        </span>
                                    )}
                                </span>
                            </>
                        ) : (
                            <>
<<<<<<< HEAD
                                <Prohibit className="size-3.5 text-danger-400 shrink-0" />
                                <span className="text-xs text-neutral-500">
                                    Re-enrollment not allowed
                                </span>
=======
                                <Prohibit className="size-3 text-danger-500" />
                                <span className="text-neutral-500">Re-enrollment not allowed</span>
>>>>>>> origin/main
                            </>
                        )}
                    </div>
                </div>
            )}

            {hasPolicyActions && !compact && (
<<<<<<< HEAD
                <div className="rounded-md bg-neutral-50 overflow-hidden">
=======
                <div className="overflow-hidden rounded-md bg-neutral-50">
>>>>>>> origin/main
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
<<<<<<< HEAD
                        className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                        <span>Policy Actions ({policy.policy_actions.length})</span>
=======
                        className="flex w-full items-center justify-between p-2 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100"
                    >
                        <span className="uppercase tracking-wide">
                            Policy Actions ({policy.policy_actions.length})
                        </span>
>>>>>>> origin/main
                        {isExpanded ? (
                            <CaretUp className="size-3" />
                        ) : (
                            <CaretDown className="size-3" />
                        )}
                    </button>
                    {isExpanded && (
<<<<<<< HEAD
                        <div className="px-2.5 pb-2.5">
                            <PolicyActionsTimeline
                                actions={policy.policy_actions}
                                compact={true}
                            />
=======
                        <div className="px-2 pb-2">
                            <PolicyActionsTimeline actions={policy.policy_actions} compact />
>>>>>>> origin/main
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

<<<<<<< HEAD
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
=======
// Pick the days-left tone for headline + progress + status label.
const getDaysLeftTone = (daysLeft: number | null): { color: string; status: string } => {
    if (daysLeft === null) {
        return { color: 'text-neutral-500', status: 'No expiry' };
    }
    if (daysLeft >= 180) {
        return { color: 'text-success-600', status: 'Active session' };
    }
    if (daysLeft >= 30) {
        return { color: 'text-warning-600', status: 'Renewal due soon' };
    }
    return { color: 'text-danger-600', status: 'Urgent renewal required' };
};

const PlanCard = ({
    plan,
    enrollmentStatus,
}: {
    plan: UserPlan;
    enrollmentStatus: 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | null;
}) => {
    const policy = getFirstPolicy(plan);
    const courseLabel = getCourseLabel(plan);
    const daysLeft = computeDaysLeft(plan.end_date);
    const tone = getDaysLeftTone(daysLeft);
    const expiryLabel = getExpiryLabel(plan);
    const amount = getPlanAmount(plan);
    const currency = getPlanCurrency(plan);
    const appliedCoupon = parseAppliedCoupon(plan);
    const couponDiscount = computeCouponDiscount(amount, appliedCoupon);
    const finalAmount = Math.max(0, amount - couponDiscount);
    const hasCouponDiscount = couponDiscount > 0 && finalAmount < amount;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-3 transition-all duration-200 hover:border-primary-200 hover:shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                    <div className="rounded-md bg-primary-50 p-1.5">
                        <Clock className="size-4 text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4
                            className="truncate text-xs font-semibold text-neutral-900"
                            title={courseLabel}
                        >
                            {courseLabel}
                        </h4>
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                            {getOptionName(plan)} · {getPlanName(plan)}
                        </p>
                    </div>
                </div>
                <TrendUp className={cn('size-3.5 shrink-0', tone.color)} />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <PlanStatusBadge status={plan.payment_plan_dto?.status || plan.status} />
                <EnrollmentStatusBadge enrollmentStatus={enrollmentStatus} />
            </div>

            {daysLeft !== null && (
                <div className="mb-3">
                    <div className="mb-1 flex items-baseline gap-1.5">
                        <span className={cn('text-base font-bold', tone.color)}>{daysLeft}</span>
                        <span className="text-xs text-neutral-500">days left</span>
                    </div>
                    <ProgressBar progress={daysLeft} />
                    <p className="mt-1 text-center text-xs text-neutral-500">{tone.status}</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-1.5 text-xs text-neutral-600 sm:grid-cols-2">
                {plan.start_date && (
                    <div className="flex items-center gap-1">
                        <Calendar className="size-3 text-neutral-400" />
                        <span>Started {formatDate(new Date(plan.start_date), 'dd MMM yyyy')}</span>
                    </div>
                )}
                {expiryLabel && (
                    <div className="flex items-center gap-1">
                        <Calendar className="size-3 text-neutral-400" />
                        <span>Ends {expiryLabel}</span>
                    </div>
                )}
                {currency !== 'N/A' && amount > 0 && (
                    <div className="flex items-center gap-1">
                        <CurrencyDollar className="size-3 text-neutral-400" />
                        {hasCouponDiscount ? (
                            <span className="flex items-baseline gap-1">
                                <span className="text-neutral-400 line-through">
                                    {getCurrencySymbol(currency)}
                                    {amount}
                                </span>
                                <span className="font-semibold text-success-700">
                                    {getCurrencySymbol(currency)}
                                    {finalAmount}
                                </span>
                            </span>
                        ) : (
                            <span>
                                {getCurrencySymbol(currency)}
                                {amount}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <CouponAppliedRow plan={plan} currency={currency} />

            <PolicyDetailsSection policy={policy} compact />
>>>>>>> origin/main
        </div>
    );
};

<<<<<<< HEAD
// ── Main component ────────────────────────────────────────────────────────────

=======
>>>>>>> origin/main
const StudentPlanDetails = ({ userId, instituteId }: StudentPlanDetailsProps) => {
    const { selectedStudent } = useStudentSidebar();
    const [activePlans, setActivePlans] = useState<UserPlan[]>([]);
    const [isLoadingActive, setIsLoadingActive] = useState(false);
<<<<<<< HEAD
    const [hasError, setHasError] = useState(false);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
=======
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
>>>>>>> origin/main
    const [allPlans, setAllPlans] = useState<UserPlan[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const pageSize = 5;
<<<<<<< HEAD

    const loadActivePlan = useCallback(async () => {
        if (!userId) return;
=======
>>>>>>> origin/main

    // The selected learner row's package_session_id reflects the batch the admin
    // is viewing them under. If the admin marked them INACTIVE in this batch, we
    // tag the matching plan card with "Course Inactive" even though the plan is
    // still running — because the user asked for that signal here.
    const filteredPackageSessionId = selectedStudent?.package_session_id;
    const filteredEnrollmentStatus = selectedStudent?.status;

    const resolveEnrollmentStatus = useCallback(
        (plan: UserPlan): 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | null => {
            if (!filteredPackageSessionId || !filteredEnrollmentStatus) return null;
            const planPsId = getFirstPolicy(plan)?.package_session_id;
            if (!planPsId || planPsId !== filteredPackageSessionId) return null;
            return filteredEnrollmentStatus;
        },
        [filteredPackageSessionId, filteredEnrollmentStatus]
    );

    const loadActivePlans = useCallback(async () => {
        if (!userId) return;
        try {
            setIsLoadingActive(true);
<<<<<<< HEAD
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
=======
            const response = await getUserPlans(1, 50, ['ACTIVE'], userId, instituteId);
            setActivePlans(response.content || []);
        } catch (error) {
            console.error('Error loading active plans:', error);
>>>>>>> origin/main
        } finally {
            setIsLoadingActive(false);
        }
    }, [userId, instituteId]);

    useEffect(() => {
        loadActivePlans();
    }, [loadActivePlans]);

    const handleViewHistory = async () => {
        if (!userId) return;
        try {
            setShowHistoryDialog(true);
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

<<<<<<< HEAD
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
=======
    return (
        <>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-800">Active Memberships</h3>
                    {activePlans.length > 0 && (
                        <MyButton onClick={handleViewHistory} buttonType="secondary" scale="small">
                            <Eye className="mr-1 size-3" />
                            View History
                        </MyButton>
                    )}
                </div>

                {isLoadingActive ? (
                    <div className="flex items-center justify-center py-6">
                        <DashboardLoader />
                    </div>
                ) : activePlans.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md bg-info-50 p-3 text-xs text-info-700 ring-1 ring-info-200">
                        <Warning className="size-4 shrink-0" />
                        <span>No active membership for this learner.</span>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {activePlans
                            .slice()
                            .sort((a, b) => {
                                const ad = a.end_date ? new Date(a.end_date).getTime() : Infinity;
                                const bd = b.end_date ? new Date(b.end_date).getTime() : Infinity;
                                return ad - bd;
                            })
                            .map((plan) => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    enrollmentStatus={resolveEnrollmentStatus(plan)}
                                />
                            ))}
                    </div>
                )}
            </div>

            <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                <DialogContent className="max-h-screen max-w-2xl overflow-y-auto">
>>>>>>> origin/main
                    <DialogHeader>
                        <DialogTitle>Membership History</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {isLoadingHistory ? (
<<<<<<< HEAD
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
=======
                            <div className="flex items-center justify-center py-6">
                                <DashboardLoader />
                            </div>
                        ) : allPlans.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-md bg-info-50 p-3 text-sm text-info-700 ring-1 ring-info-200">
                                <Warning className="size-4 shrink-0" />
                                <span>No plans found.</span>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2.5">
                                    {allPlans.map((plan) => (
                                        <PlanCard
                                            key={plan.id}
                                            plan={plan}
                                            enrollmentStatus={resolveEnrollmentStatus(plan)}
                                        />
                                    ))}
                                </div>
>>>>>>> origin/main

                                {totalPages > 1 && (
<<<<<<< HEAD
                                    <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
=======
                                    <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
>>>>>>> origin/main
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
