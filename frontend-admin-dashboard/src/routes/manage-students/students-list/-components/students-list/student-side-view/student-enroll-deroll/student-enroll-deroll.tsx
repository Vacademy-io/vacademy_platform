import {
    ArrowCounterClockwise,
    BookOpen,
    ShoppingCart,
    UserMinus,
    CreditCard,
    ArrowsLeftRight,
    CircleNotch,
    Package,
    Calendar,
    Book,
    ShieldCheck,
    IdentificationCard,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserPlans } from '@/services/user-plan';
import { cancelUserPlan } from '@/services/enrollment-actions';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSimpleEnrollmentStore } from '@/stores/students/simple-enrollment-store';
import { SimpleEnrollmentWizard } from '@/components/common/students/enroll-manually/simple-enrollment-wizard';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileHero,
} from '../profile-ui';

// ── Tone for plan status ───────────────────────────────────────────────────────

type PlanTone = 'success' | 'warning' | 'neutral';

const deriveTone = (status: string): PlanTone => {
    const s = status?.toUpperCase();
    if (s === 'ACTIVE') return 'success';
    if (s === 'PENDING') return 'warning';
    return 'neutral';
};

// ── Action icon resolver (Phosphor only) ──────────────────────────────────────

const resolveActionIcon = (label: string): React.ReactElement => {
    if (label.includes('Return'))
        return <ArrowCounterClockwise className="size-4 text-warning-600" />;
    if (label.includes('Rent')) return <BookOpen className="size-4 text-primary-600" />;
    if (label.includes('Buy')) return <ShoppingCart className="size-4 text-success-600" />;
    if (label.includes('Membership')) return <UserMinus className="size-4 text-danger-600" />;
    if (label.includes('Purchase')) return <CreditCard className="size-4 text-primary-600" />;
    return <Package className="size-4 text-neutral-500" />;
};

// ── Plan item row inside a section card ───────────────────────────────────────

const PlanRow = ({
    displayName,
    dateLabel,
    dateValue,
    onAction,
    actionLabel,
    isActing,
}: {
    displayName: string;
    dateLabel: string;
    dateValue: string;
    onAction: () => void;
    actionLabel: string;
    isActing?: boolean;
}) => (
    <div className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0 flex-1">
            <p
                className="truncate text-sm font-medium text-neutral-800"
                title={displayName}
            >
                {displayName}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                <Calendar className="size-3 shrink-0" />
                {dateLabel} {dateValue}
            </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700 ring-1 ring-success-200">
                Active
            </span>
            <MyButton
                buttonType="secondary"
                scale="small"
                onClick={onAction}
                disable={isActing}
            >
                {isActing ? (
                    <CircleNotch className="size-3.5 animate-spin" />
                ) : null}
                {actionLabel}
            </MyButton>
        </div>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const StudentEnrollDeroll = () => {
    const { selectedStudent } = useStudentSidebar();
    const queryClient = useQueryClient();

    // New Store for Simple Wizard
    const { openModal } = useSimpleEnrollmentStore();

    const [isActionModalOpen, setIsActionModalOpen] = useState(false);

    const [currentAction, setCurrentAction] = useState<{
        type: 'ENROLL' | 'CANCEL';
        label: string;
        actionType?: 'RENT' | 'BUY' | 'MEMBERSHIP';
        user_plan_id?: string;
    } | null>(null);

    const userId = selectedStudent?.user_id || '';

    // Fetch active plans
    const { data: plansData, isLoading: isLoadingPlans } = useQuery({
        queryKey: ['user-plans', userId],
        queryFn: () => getUserPlans(1, 20, ['ACTIVE'], userId),
        enabled: !!userId,
    });

    // Cancellation Mutation
    const cancelMutation = useMutation({
        mutationFn: ({ user_plan_id }: { user_plan_id: string }) =>
            cancelUserPlan(user_plan_id, true),
        onSuccess: () => {
            toast.success('Action completed successfully');
            queryClient.invalidateQueries({ queryKey: ['user-plans', userId] });
            setIsActionModalOpen(false);
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to cancel plan');
        },
    });

    const handleNewEnrollmentClick = (label: string, type: 'RENT' | 'BUY' | 'MEMBERSHIP') => {
        if (!userId) {
            toast.error('No student selected');
            return;
        }
        // Open the new simplified wizard
        openModal(type, userId);
    };

    const confirmAction = () => {
        if (currentAction?.type === 'CANCEL' && currentAction.user_plan_id) {
            cancelMutation.mutate({ user_plan_id: currentAction.user_plan_id });
        }
    };

    // Simplified Filtering Logic based on 'name'
    const { activeMemberships, rentedBooks } = useMemo(() => {
        // First, filter out any TERMINATED plans to ensure they never appear
        const plans = (plansData?.content || []).filter((plan) => plan.status == 'ACTIVE');

        const memberships = plans.filter((plan) => {
            const name = (plan.enroll_invite?.name || '').trim().toUpperCase();
            // STRICT CONDITION: Only show if name starts with "DEFAULT" (Case-insensitive)
            // Removed tag check as it was causing unrelated items (like rented books) to appear here.
            return name.startsWith('DEFAULT');
        });

        const books = plans.filter((plan) => {
            const name = (plan.enroll_invite?.name || '').trim().toUpperCase();
            // STRICT CONDITION: Name starts with "RENT"
            return name.startsWith('RENT');
        });

        // Helper to get display name
        const getDisplayName = (plan: any) => {
            return plan.enroll_invite?.name || plan.payment_plan?.name || 'Active Plan';
        };

        const getUniqueByName = (items: typeof plans) => {
            const seen = new Set();
            return items.filter((item) => {
                const name = getDisplayName(item);
                if (seen.has(name)) return false;
                seen.add(name);
                return true;
            });
        };

        return {
            activeMemberships: getUniqueByName(memberships).map((plan) => ({
                plan,
                displayName: getDisplayName(plan),
            })),
            rentedBooks: getUniqueByName(books).map((plan) => ({
                plan,
                displayName: getDisplayName(plan),
            })),
        };
    }, [plansData]);

    // Determine hero content from the first active membership (or a fallback)
    const heroMembership = activeMemberships[0]?.plan ?? null;
    const heroName = activeMemberships[0]?.displayName ?? null;
    const heroTone = heroMembership ? deriveTone(heroMembership.status ?? 'ACTIVE') : 'neutral';
    const heroSubtitle = heroMembership
        ? `${heroMembership.status ?? 'Active'} · Expires ${
              heroMembership.end_date
                  ? new Date(heroMembership.end_date).toLocaleDateString()
                  : 'No expiry'
          }`
        : undefined;

    return (
        <div className="flex flex-col gap-4 pb-10">
            {/* ── HERO: Active membership ── */}
            {isLoadingPlans ? (
                <ProfileSkeleton blocks={1} />
            ) : (
                <ProfileHero
                    eyebrow="ACTIVE MEMBERSHIP"
                    title={heroName ?? 'No active membership'}
                    subtitle={heroSubtitle}
                    icon={IdentificationCard}
                    tone={heroTone}
                />
            )}

            {/* ── New enrollment: compact button row instead of 3 big tiles ── */}
            <ProfileSectionCard icon={CreditCard} heading="Enroll in something new">
                <div className="flex flex-wrap gap-2">
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={() =>
                            handleNewEnrollmentClick('Purchase membership', 'MEMBERSHIP')
                        }
                    >
                        <CreditCard className="size-4" />
                        Purchase Membership
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => handleNewEnrollmentClick('Rent a book', 'RENT')}
                    >
                        <BookOpen className="size-4" />
                        Rent Book
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => handleNewEnrollmentClick('Buy a book', 'BUY')}
                    >
                        <ShoppingCart className="size-4" />
                        Buy Book
                    </MyButton>
                </div>
            </ProfileSectionCard>

            {/* ── BODY: Cancel active membership ── */}
            <ProfileSectionCard icon={UserMinus} heading="Cancel Membership">
                {isLoadingPlans ? (
                    <ProfileSkeleton blocks={1} />
                ) : activeMemberships.length > 0 ? (
                    <dl className="divide-y divide-neutral-100">
                        {activeMemberships.map(({ plan, displayName }) => (
                            <PlanRow
                                key={plan.id}
                                displayName={displayName}
                                dateLabel="Active since"
                                dateValue={new Date(
                                    plan.start_date || plan.created_at
                                ).toLocaleDateString()}
                                actionLabel="Cancel"
                                isActing={
                                    cancelMutation.isPending &&
                                    currentAction?.user_plan_id === plan.id
                                }
                                onAction={() => {
                                    setCurrentAction({
                                        type: 'CANCEL',
                                        label: 'Cancel Membership',
                                        user_plan_id: plan.id,
                                    });
                                    setIsActionModalOpen(true);
                                }}
                            />
                        ))}
                    </dl>
                ) : (
                    <ProfileEmpty
                        icon={Package}
                        title="No active membership"
                        hint="This learner has no current subscription."
                    />
                )}
            </ProfileSectionCard>

            {/* ── BODY: Return rented books ── */}
            <ProfileSectionCard icon={Book} heading="Return a Rent Book">
                {isLoadingPlans ? (
                    <ProfileSkeleton blocks={1} />
                ) : rentedBooks.length > 0 ? (
                    <dl className="divide-y divide-neutral-100">
                        {rentedBooks.map(({ plan, displayName }) => (
                            <PlanRow
                                key={plan.id}
                                displayName={displayName}
                                dateLabel="Rented on"
                                dateValue={new Date(plan.created_at).toLocaleDateString()}
                                actionLabel="Return"
                                isActing={
                                    cancelMutation.isPending &&
                                    currentAction?.user_plan_id === plan.id
                                }
                                onAction={() => {
                                    setCurrentAction({
                                        type: 'CANCEL',
                                        label: 'Return Rent Book',
                                        user_plan_id: plan.id,
                                    });
                                    setIsActionModalOpen(true);
                                }}
                            />
                        ))}
                    </dl>
                ) : (
                    <ProfileEmpty
                        icon={BookOpen}
                        title="No rented books"
                        hint="This learner has not rented any books."
                    />
                )}
            </ProfileSectionCard>

            {/* ── Compliance note ── */}
            <ProfileSectionCard icon={ShieldCheck} heading="Compliance">
                <p className="text-xs text-neutral-500 leading-relaxed">
                    This action is audit-protected. All enrollment changes are logged with timestamps
                    and administrator details for compliance tracking.
                </p>
            </ProfileSectionCard>

            {/* New Simplified Enrollment Wizard */}
            <SimpleEnrollmentWizard />

            {/* Confirmation Dialog for Cancellations */}
            <AlertDialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                            {resolveActionIcon(currentAction?.label || '')}
                            {currentAction?.label}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-neutral-500">
                            You are about to proceed with{' '}
                            <strong>{currentAction?.label}</strong> for{' '}
                            <strong>{selectedStudent?.full_name}</strong>. Termination is
                            immediate and access will be revoked.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmAction();
                            }}
                            disabled={cancelMutation.isPending}
                            className="bg-danger-500 text-white hover:bg-danger-600 focus-visible:ring-danger-400"
                        >
                            {cancelMutation.isPending ? (
                                <span className="flex items-center gap-2">
                                    <CircleNotch className="size-4 animate-spin" />
                                    Processing…
                                </span>
                            ) : (
                                'Confirm Action'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
