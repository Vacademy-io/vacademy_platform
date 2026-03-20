import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import { Clock, Eye, Loader2, AlertCircle, RefreshCw, Calendar, CheckCircle2, Ban, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getUserPlans, UserPlan } from '@/services/user-plan';
import { toast } from 'sonner';
import { formatDate, format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { PolicyActionsTimeline } from '@/components/common/PolicyActionsTimeline';
import type { PolicyDetails } from '@/types/membership-expiry';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StudentPlanDetailsProps {
    userId: string;
    instituteId?: string;
}

// Helper to get the first policy from a plan
const getFirstPolicy = (plan: UserPlan): PolicyDetails | null => {
    if (plan.policy_details && plan.policy_details.length > 0) {
        return plan.policy_details[0] || null;
    }
    return null;
};

// Auto-Renewal Badge Component
const AutoRenewalBadge = ({ policy }: { policy: PolicyDetails | null }) => {
    if (!policy?.on_expiry_policy) return null;

    const isEnabled = policy.on_expiry_policy.enable_auto_renewal;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="inline-flex">
                        {isEnabled ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1 text-[10px]">
                                <RefreshCw className="size-2.5" />
                                Auto-Renewal
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 flex items-center gap-1 text-[10px]">
                                <Ban className="size-2.5" />
                                No Auto-Renewal
                            </Badge>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    {isEnabled
                        ? `Payment attempt on ${policy.on_expiry_policy.next_payment_attempt_date ? format(new Date(policy.on_expiry_policy.next_payment_attempt_date), 'MMM dd, yyyy') : 'scheduled date'}`
                        : 'Auto-renewal is disabled'
                    }
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// Policy Details Section Component
const PolicyDetailsSection = ({ policy, compact = false }: { policy: PolicyDetails | null; compact?: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!policy) return null;

    const hasExpiryPolicy = policy.on_expiry_policy !== null;
    const hasReenrollmentPolicy = policy.reenrollment_policy !== null;
    const hasPolicyActions = policy.policy_actions && policy.policy_actions.length > 0;

    if (!hasExpiryPolicy && !hasReenrollmentPolicy && !hasPolicyActions) return null;

    return (
        <div className="mt-2 space-y-2">
            {/* Expiry Policy Info */}
            {hasExpiryPolicy && (
                <div className="rounded-md bg-neutral-50/80 p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                            Expiry Policy
                        </span>
                        <AutoRenewalBadge policy={policy} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {policy.on_expiry_policy?.final_expiry_date && (
                            <div className="flex items-center gap-1">
                                <Calendar className="size-3 text-red-400" />
                                <span className="text-neutral-600">
                                    Final: {format(new Date(policy.on_expiry_policy.final_expiry_date), 'MMM dd, yyyy')}
                                </span>
                            </div>
                        )}
                        {policy.on_expiry_policy?.waiting_period_in_days !== undefined && policy.on_expiry_policy.waiting_period_in_days > 0 && (
                            <div className="flex items-center gap-1">
                                <Clock className="size-3 text-amber-400" />
                                <span className="text-neutral-600">
                                    {policy.on_expiry_policy.waiting_period_in_days} day grace
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Re-enrollment Info */}
            {hasReenrollmentPolicy && (
                <div className="rounded-md bg-neutral-50/80 p-2">
                    <div className="flex items-center gap-2 text-[10px]">
                        {policy.reenrollment_policy?.allow_reenrollment_after_expiry ? (
                            <>
                                <CheckCircle2 className="size-3 text-green-500" />
                                <span className="text-neutral-600">
                                    Re-enrollment{' '}
                                    {policy.reenrollment_policy.next_eligible_enrollment_date
                                        ? `from ${format(new Date(policy.reenrollment_policy.next_eligible_enrollment_date), 'MMM dd, yyyy')}`
                                        : 'available'
                                    }
                                    {policy.reenrollment_policy.reenrollment_gap_in_days > 0 && (
                                        <span className="text-neutral-400 ml-1">
                                            ({policy.reenrollment_policy.reenrollment_gap_in_days} day gap)
                                        </span>
                                    )}
                                </span>
                            </>
                        ) : (
                            <>
                                <Ban className="size-3 text-red-400" />
                                <span className="text-neutral-500">Re-enrollment not allowed</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Policy Actions Timeline (Expandable) */}
            {hasPolicyActions && !compact && (
                <div className="rounded-md bg-neutral-50/80 overflow-hidden">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between p-2 text-[10px] font-medium text-neutral-500 hover:bg-neutral-100/50 transition-colors"
                    >
                        <span className="uppercase tracking-wide">Policy Actions ({policy.policy_actions.length})</span>
                        {isExpanded ? (
                            <ChevronUp className="size-3" />
                        ) : (
                            <ChevronDown className="size-3" />
                        )}
                    </button>
                    {isExpanded && (
                        <div className="px-2 pb-2">
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

const StudentPlanDetails = ({ userId, instituteId }: StudentPlanDetailsProps) => {
    const [activePlan, setActivePlan] = useState<UserPlan | null>(null);
    const [isLoadingActive, setIsLoadingActive] = useState(false);
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
            const response = await getUserPlans(1, 1, ['ACTIVE'], userId, instituteId);

            if (response.content && response.content.length > 0) {
                const plan = response.content[0];
                if (plan) {
                    setActivePlan(plan);
                }
            }
        } catch (error) {
            console.error('Error loading active plan:', error);
        } finally {
            setIsLoadingActive(false);
        }
    }, [userId, instituteId]);

    // Load active plan on component mount
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

    const getStatusColor = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'ACTIVE':
                return 'bg-green-100 text-green-800';
            case 'EXPIRED':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
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

    const getPlanValidity = (plan: UserPlan): number | undefined => {
        return plan.payment_plan_dto?.validity_in_days;
    };

    const getExpiryDate = (plan: UserPlan): string | null => {
        // Use end_date from plan if available
        if (plan.end_date) {
            return formatDate(new Date(plan.end_date), 'dd MMM yyyy');
        }
        // Fallback to calculated validity
        const validityDays = getPlanValidity(plan);
        if (validityDays && plan.start_date) {
            const startDate = new Date(plan.start_date);
            startDate.setDate(startDate.getDate() + validityDays);
            return formatDate(startDate, 'dd MMM yyyy');
        }
        return null;
    };

    return (
        <>
            {/* Plan Details Card */}
            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                <div className="mb-2 flex items-center gap-2.5">
                    <div className="rounded-md bg-gradient-to-br from-primary-50 to-primary-100 p-1.5">
                        <Clock className="size-4 text-primary-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="mb-0.5 text-xs font-medium text-neutral-700">Active Plan</h4>
                    </div>
                </div>

                {isLoadingActive ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="size-4 animate-spin text-primary-400" />
                    </div>
                ) : activePlan ? (
                    <div className="space-y-2">
                        <div className="rounded-md bg-neutral-50 p-2.5">
                            <div className="flex items-center justify-between">
                                <span className="mb-2 text-xs font-semibold text-neutral-900">
                                    {getOptionName(activePlan)} - {getPlanName(activePlan)}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                    {activePlan.payment_plan_dto?.status || activePlan.status}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {getExpiryDate(activePlan) && (
                                    <span className="text-[10px] text-neutral-600">
                                        Valid till {getExpiryDate(activePlan)}
                                    </span>
                                )}
                            </div>

                            {/* Policy Details Section - New! */}
                            <PolicyDetailsSection
                                policy={getFirstPolicy(activePlan)}
                                compact={true}
                            />
                        </div>

                        <MyButton
                            onClick={handleViewDetails}
                            buttonType="secondary"
                            scale="small"
                            className="w-full text-xs"
                        >
                            <Eye className="mr-1 size-3" />
                            View All Plans
                        </MyButton>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 rounded-md bg-blue-50 p-2 text-[10px] text-blue-700">
                        <AlertCircle className="size-3 shrink-0" />
                        <span>No active plan</span>
                    </div>
                )}
            </div>

            {/* Plans History Dialog */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-h-[80vh] w-[700px] overflow-y-auto ">
                    <DialogHeader>
                        <DialogTitle>Payment Plans History</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        {isLoadingHistory ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="size-6 animate-spin text-primary-400" />
                            </div>
                        ) : allPlans.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                                <AlertCircle className="size-4 shrink-0" />
                                <span>No plans found.</span>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {allPlans.map((plan) => {
                                        const policy = getFirstPolicy(plan);
                                        return (
                                            <Card
                                                key={plan.id}
                                                className="rounded-md border border-neutral-200 p-3"
                                            >
                                                <div className="mb-2 flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h5 className="text-sm font-semibold text-neutral-900">
                                                            {getOptionName(plan)} - {getPlanName(plan)}
                                                        </h5>
                                                        <p className="mt-1 text-xs text-neutral-600">
                                                            Type: {plan.payment_option.type}
                                                        </p>
                                                        {policy?.package_session_name && (
                                                            <p className="mt-0.5 text-xs text-neutral-500">
                                                                Session: {policy.package_session_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Badge
                                                        className={`text-xs ${getStatusColor(
                                                            plan.payment_plan_dto?.status || plan.status
                                                        )}`}
                                                    >
                                                        {plan.payment_plan_dto?.status || plan.status}
                                                    </Badge>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    {getPlanCurrency(plan) !== 'N/A' && (
                                                        <span className="text-xs text-neutral-600">
                                                            {getCurrencySymbol(getPlanCurrency(plan))}
                                                            {getPlanAmount(plan)}
                                                        </span>
                                                    )}
                                                    {plan.start_date && (
                                                        <span className="text-xs text-neutral-500">
                                                            Started: {formatDate(new Date(plan.start_date), 'dd MMM yyyy')}
                                                        </span>
                                                    )}
                                                    {getExpiryDate(plan) && (
                                                        <span className="text-xs text-neutral-600">
                                                            Ends: {getExpiryDate(plan)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Policy Details Section in Dialog */}
                                                <PolicyDetailsSection policy={policy} />
                                            </Card>
                                        );
                                    })}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t pt-4">
                                        <span className="text-sm text-neutral-600">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <div className="flex gap-2">
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                disable={currentPage === 1 || isLoadingHistory}
                                                onClick={() => handlePageChange(currentPage - 1)}
                                            >
                                                Previous
                                            </MyButton>
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                disable={
                                                    currentPage === totalPages || isLoadingHistory
                                                }
                                                onClick={() => handlePageChange(currentPage + 1)}
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
