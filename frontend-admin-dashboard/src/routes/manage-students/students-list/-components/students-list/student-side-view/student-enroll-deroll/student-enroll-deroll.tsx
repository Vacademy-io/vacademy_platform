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
    CheckCircle,
    Info,
    Book,
    ShieldCheck,
    PlusCircle
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
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useSimpleEnrollmentStore } from '@/stores/students/simple-enrollment-store';
import { SimpleEnrollmentWizard } from '@/components/common/students/enroll-manually/simple-enrollment-wizard';

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
        mutationFn: ({ user_plan_id }: { user_plan_id: string }) => cancelUserPlan(user_plan_id, true),
        onSuccess: () => {
            toast.success('Action completed successfully');
            queryClient.invalidateQueries({ queryKey: ['user-plans', userId] });
            setIsActionModalOpen(false);
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to cancel plan');
        }
    });

    const handleNewEnrollmentClick = (label: string, type: 'RENT' | 'BUY' | 'MEMBERSHIP') => {
        if (!userId) {
            toast.error("No student selected");
            return;
        }
        // Open the new simplified wizard
        openModal(type, userId);
    };

    const handleActionIcon = (label: string) => {
        if (label.includes('Return')) return <ArrowCounterClockwise className="size-5 text-amber-600" />;
        if (label.includes('Rent')) return <BookOpen className="size-5 text-blue-600" />;
        if (label.includes('Buy')) return <ShoppingCart className="size-5 text-emerald-600" />;
        if (label.includes('Membership')) return <UserMinus className="size-5 text-rose-600" />;
        if (label.includes('Purchase')) return <CreditCard className="size-5 text-primary-600" />;
        return <Package className="size-5 text-neutral-600" />;
    };

    const confirmAction = () => {
        if (currentAction?.type === 'CANCEL' && currentAction.user_plan_id) {
            cancelMutation.mutate({ user_plan_id: currentAction.user_plan_id });
        }
    };

    // Simplified Filtering Logic based on 'name'
    const { activeMemberships, rentedBooks } = useMemo(() => {
        // First, filter out any TERMINATED plans to ensure they never appear
        const plans = (plansData?.content || []).filter(plan => plan.status == 'ACTIVE');

        const memberships = plans.filter(plan => {
            const name = (plan.enroll_invite?.name || '').trim().toUpperCase();
            // STRICT CONDITION: Only show if name starts with "DEFAULT" (Case-insensitive)
            // Removed tag check as it was causing unrelated items (like rented books) to appear here.
            return name.startsWith('DEFAULT');
        });

        const books = plans.filter(plan => {
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
            return items.filter(item => {
                const name = getDisplayName(item);
                if (seen.has(name)) return false;
                seen.add(name);
                return true;
            });
        };

        return {
            activeMemberships: getUniqueByName(memberships).map(plan => ({
                plan, // Keep original structure: plan is the item itself now
                displayName: getDisplayName(plan)
            })),
            rentedBooks: getUniqueByName(books).map(plan => ({
                plan,
                displayName: getDisplayName(plan)
            }))
        };
    }, [plansData]);

    const enrollmentActions = [
        { label: 'Rent a book', type: 'RENT' as const, bg: 'bg-blue-50', border: 'hover:border-blue-200' },
        { label: 'Buy a book', type: 'BUY' as const, bg: 'bg-emerald-50', border: 'hover:border-emerald-200' },
        { label: 'Purchase membership', type: 'MEMBERSHIP' as const, bg: 'bg-primary-50', border: 'hover:border-primary-200' }
    ];

    return (
        <div className="animate-fadeIn flex flex-col gap-5 p-1 pb-10">
            {/* 1. Cancel Membership Section */}
            <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-xl bg-rose-50 p-2.5">
                        <UserMinus className="size-5 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-neutral-800">Cancel Membership</h3>
                        <p className="text-[10px] text-neutral-500">Terminate current active subscription</p>
                    </div>
                </div>

                {isLoadingPlans ? (
                    <div className="h-20 animate-pulse rounded-xl bg-neutral-50" />
                ) : activeMemberships.length > 0 ? (
                    <div className="space-y-3">
                        {activeMemberships.map(({ plan, displayName }) => (
                            <div key={plan.id} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 transition-all hover:bg-white hover:border-neutral-200">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-lg bg-white p-2 shadow-sm text-neutral-400">
                                        <Package className="size-5" />
                                    </div>
                                    <div className="max-w-[140px]">
                                        <p className="text-sm font-semibold text-neutral-800 truncate" title={displayName}>
                                            {displayName}
                                        </p>
                                        <p className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                                            <Calendar className="size-3" />
                                            Active since {new Date(plan.start_date || plan.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setCurrentAction({ type: 'CANCEL', label: 'Cancel Membership', user_plan_id: plan.id });
                                        setIsActionModalOpen(true);
                                    }}
                                    className="rounded-lg bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 transition-all hover:bg-rose-100 active:scale-95 whitespace-nowrap"
                                >
                                    CANCEL
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 border border-neutral-100">
                        <Info className="size-3 text-neutral-400" />
                        <p className="text-[10px] text-neutral-400 italic">No current membership</p>
                    </div>
                )}
            </div>

            {/* 2. Return Rent Book Section */}
            <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-xl bg-amber-50 p-2.5">
                        <Book className="size-5 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-neutral-800">Return a Rent Book</h3>
                        <p className="text-[10px] text-neutral-500">Manage all rented publications</p>
                    </div>
                </div>

                {isLoadingPlans ? (
                    <div className="h-20 animate-pulse rounded-xl bg-neutral-50" />
                ) : rentedBooks.length > 0 ? (
                    <div className="space-y-3">
                        {rentedBooks.map(({ plan, displayName }) => (
                            <div key={plan.id} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 transition-all hover:bg-white hover:border-neutral-200">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-lg bg-white p-2 shadow-sm text-neutral-400">
                                        <BookOpen className="size-5" />
                                    </div>
                                    <div className="max-w-[140px]">
                                        <p className="text-sm font-semibold text-neutral-800 truncate" title={displayName}>
                                            {displayName}
                                        </p>
                                        <p className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                                            <Calendar className="size-3" />
                                            Rented on {new Date(plan.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setCurrentAction({ type: 'CANCEL', label: 'Return Rent Book', user_plan_id: plan.id });
                                        setIsActionModalOpen(true);
                                    }}
                                    className="rounded-lg bg-amber-50 px-4 py-2 text-xs font-bold text-amber-600 transition-all hover:bg-amber-100 active:scale-95 whitespace-nowrap"
                                >
                                    RETURN
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50/50 border border-neutral-100">
                        <BookOpen className="size-3 text-neutral-400" />
                        <p className="text-[10px] text-neutral-400 italic">No current rented books</p>
                    </div>
                )}
            </div>

            {/* 3. New Enrollment Section */}
            <div className="rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50/30 p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-xl bg-primary-50 p-2.5">
                        <ArrowsLeftRight className="size-5 text-primary-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-neutral-800">New Enrollment</h3>
                        <p className="text-[10px] text-neutral-500">Rent, purchase, or subscribe</p>
                    </div>
                </div>

                <div className="grid gap-3">
                    {enrollmentActions.map((action, index) => (
                        <button
                            key={index}
                            onClick={() => handleNewEnrollmentClick(action.label, action.type)}
                            className={`flex w-full items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3.5 transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${action.border} active:scale-[0.99] group`}
                        >
                            <div className={`rounded-xl ${action.bg} p-2.5 transition-colors group-hover:bg-white`}>
                                {handleActionIcon(action.label)}
                            </div>
                            <span className="text-sm font-medium text-neutral-700">{action.label}</span>
                            <PlusCircle className="ml-auto size-4 text-neutral-300 group-hover:text-primary-500 transition-colors" />
                        </button>
                    ))}
                </div>
            </div>

            {/* New Simplified Enrollment Wizard */}
            <SimpleEnrollmentWizard />

            {/* Confirmation Dialog for Cancellations */}
            <AlertDialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
                <AlertDialogContent className="rounded-2xl border-neutral-100 shadow-2xl overflow-hidden p-0 gap-0">
                    <div className="h-2 w-full bg-rose-500" />
                    <div className="p-6">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-3 text-2xl font-bold text-neutral-800">
                                {handleActionIcon(currentAction?.label || '')}
                                {currentAction?.label}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm leading-relaxed text-neutral-500 pt-2">
                                You are about to proceed with <strong>{currentAction?.label}</strong> for <strong>{selectedStudent?.full_name}</strong>.
                                <br /><br />
                                Termination is immediate and access will be revoked.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 gap-3">
                            <AlertDialogCancel className="rounded-xl border-neutral-200 bg-neutral-50 hover:bg-neutral-100 h-11 px-8 font-semibold text-neutral-600">
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => { e.preventDefault(); confirmAction(); }}
                                disabled={cancelMutation.isPending}
                                className="rounded-xl h-11 px-8 font-semibold text-white shadow-lg transition-all active:scale-95 bg-rose-500 hover:bg-rose-600"
                            >
                                {cancelMutation.isPending ? (
                                    <div className="flex items-center gap-2">
                                        <CircleNotch className="size-4 animate-spin" />
                                        Processing...
                                    </div>
                                ) : (
                                    'Confirm Action'
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            {/* Compliance Note */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 flex gap-4 items-start">
                <ShieldCheck className="size-5 text-indigo-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-indigo-700 leading-normal">
                    This action is audit-protected. All enrollment changes are logged with timestamps and administrator details for compliance tracking.
                </p>
            </div>
        </div>
    );
};
