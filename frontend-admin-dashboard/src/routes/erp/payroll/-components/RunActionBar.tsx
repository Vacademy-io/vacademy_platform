import { useState } from 'react';
import { toast } from 'sonner';
import {
    ArrowCounterClockwise,
    CheckCircle,
    Gear,
    Info,
    Money,
    Prohibit,
    Warning,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatMonthValue } from '@/components/design-system/month-picker';
import type { PayrollRunDTO } from '@/routes/erp/-shared/hr-types';
import type { RunTransitions } from '@/routes/erp/-shared/payroll-status';

type ActionKey = 'process' | 'approve' | 'reject' | 'markPaid' | 'cancel';

interface RunActionBarProps {
    run: PayrollRunDTO;
    transitions: RunTransitions;
    isHrAdmin: boolean;
    onProcess: () => Promise<string | null>;
    onApprove: () => Promise<string | null>;
    onReject: () => Promise<string | null>;
    onMarkPaid: () => Promise<string | null>;
    onCancel: () => Promise<string | null>;
}

/**
 * The only place a payroll run can be moved forward or back.
 *
 * Which buttons exist is decided entirely by `runTransitions(run.status)` — the same
 * predicates the backend enforces — so a user is never offered an action that ends
 * in a 400. Nothing here is disabled-but-visible: an action that cannot happen
 * simply isn't rendered, because a greyed "Approve" on a Draft run invites the
 * question "why not" and has no answer worth reading.
 *
 * Every action is confirmed first. These transitions move real money and several are
 * expensive to undo, so the confirmation copy states the side effects the API has
 * rather than asking "are you sure?".
 */
export const RunActionBar = ({
    run,
    transitions,
    isHrAdmin,
    onProcess,
    onApprove,
    onReject,
    onMarkPaid,
    onCancel,
}: RunActionBarProps) => {
    const [pending, setPending] = useState<ActionKey | null>(null);

    const period =
        run.month && run.year
            ? formatMonthValue({ month: run.month, year: run.year })
            : 'this month';

    /** Run an action, surface the server's own sentence, and close the confirmation. */
    const commit = async (action: () => Promise<string | null>) => {
        const message = await action();
        if (message === null) return; // already reported by the hook
        // Process returns "… N failed — see run errors" on a partial success, so the
        // server's wording is shown verbatim rather than a generic "Done".
        toast.success(message);
        setPending(null);
    };

    const anyAction =
        transitions.canProcess ||
        transitions.canApprove ||
        transitions.canReject ||
        transitions.canMarkPaid ||
        transitions.canCancel;

    if (!anyAction) return null;

    if (!isHrAdmin) {
        return (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
                <Info size={18} className="mt-1 shrink-0 text-neutral-400" />
                <p className="text-caption text-muted-foreground">
                    Processing, approving and paying a run is limited to HR admins. You can review
                    every figure here.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-wrap items-center gap-3">
                {transitions.canProcess && (
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={() => setPending('process')}
                    >
                        <Gear size={16} />
                        Process run
                    </MyButton>
                )}
                {transitions.canApprove && (
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={() => setPending('approve')}
                    >
                        <CheckCircle size={16} />
                        Approve run
                    </MyButton>
                )}
                {transitions.canMarkPaid && (
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={() => setPending('markPaid')}
                    >
                        <Money size={16} />
                        Mark as paid
                    </MyButton>
                )}
                {transitions.canReject && (
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => setPending('reject')}
                    >
                        <ArrowCounterClockwise size={16} />
                        Reject &amp; recalculate
                    </MyButton>
                )}
                {transitions.canCancel && (
                    <MyButton buttonType="text" scale="medium" onClick={() => setPending('cancel')}>
                        <Prohibit size={16} />
                        Cancel run
                    </MyButton>
                )}
            </div>

            {/* ── Process ── */}
            <MyDialog
                heading={`Process payroll for ${period}`}
                open={pending === 'process'}
                onOpenChange={(open) => !open && setPending(null)}
                dialogWidth="max-w-lg"
                footer={
                    <>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setPending(null)}
                        >
                            Not yet
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onAsyncClick={() => commit(onProcess)}
                            loadingText="Processing…"
                        >
                            Process run
                        </MyButton>
                    </>
                }
            >
                <div className="flex flex-col gap-3 text-body text-neutral-600">
                    <p>
                        This computes a payslip for every employee this run covers — earnings,
                        statutory deductions, loan EMIs and approved reimbursements.
                    </p>
                    <p>
                        It also{' '}
                        <span className="font-semibold">
                            locks {period}&apos;s attendance and leave
                        </span>
                        , so corrections after this point need the run rejected first.
                    </p>
                    <p className="text-caption text-neutral-500">
                        Processing runs synchronously and takes longer the more employees you have.
                        Employees it cannot compute are listed under Errors rather than failing the
                        whole run.
                    </p>
                </div>
            </MyDialog>

            {/* ── Approve ── */}
            <MyDialog
                heading={`Approve ${period} payroll`}
                open={pending === 'approve'}
                onOpenChange={(open) => !open && setPending(null)}
                dialogWidth="max-w-lg"
                footer={
                    <>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setPending(null)}
                        >
                            Keep reviewing
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onAsyncClick={() => commit(onApprove)}
                            loadingText="Approving…"
                        >
                            Approve run
                        </MyButton>
                    </>
                }
            >
                <div className="flex flex-col gap-3 text-body text-neutral-600">
                    <p>
                        Approving{' '}
                        <span className="font-semibold">posts the accounting journal</span> for this
                        run — salary expense, statutory liabilities and net payable all land in the
                        books.
                    </p>
                    <p>
                        Check the totals and any held employees first. Approval can still be undone
                        with Reject, but that reverses the journal too.
                    </p>
                </div>
            </MyDialog>

            {/* ── Mark paid ── */}
            <MyDialog
                heading={`Mark ${period} payroll as paid`}
                open={pending === 'markPaid'}
                onOpenChange={(open) => !open && setPending(null)}
                dialogWidth="max-w-lg"
                footer={
                    <>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setPending(null)}
                        >
                            Not yet
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onAsyncClick={() => commit(onMarkPaid)}
                            loadingText="Marking paid…"
                        >
                            Mark as paid
                        </MyButton>
                    </>
                }
            >
                <div className="flex flex-col gap-3 text-body text-neutral-600">
                    <p>
                        Do this once the money has actually left the bank. Every entry in the run is
                        marked paid and the run closes.
                    </p>
                    <p className="text-caption text-neutral-500">
                        A paid run can no longer be rejected or cancelled — it is the end of the
                        line.
                    </p>
                </div>
            </MyDialog>

            {/* ── Reject (destructive) ── */}
            <AlertDialog
                open={pending === 'reject'}
                onOpenChange={(open) => !open && setPending(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-danger-600">
                            <Warning size={20} weight="fill" />
                            Reject {period} payroll?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="flex flex-col gap-3 text-body text-neutral-600">
                                <p>This unwinds everything processing did:</p>
                                <ul className="list-inside list-disc space-y-1 text-caption">
                                    <li>Loan EMIs deducted by this run are reversed</li>
                                    <li>Reimbursements are unlinked and become claimable again</li>
                                    <li>Every computed payslip entry is deleted</li>
                                    <li>The accounting journal is reversed</li>
                                </ul>
                                <p>
                                    The run returns to <span className="font-semibold">Draft</span>{' '}
                                    so you can fix the data and process it again. Nothing is lost
                                    permanently, but the figures on this screen are.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep the run</AlertDialogCancel>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onAsyncClick={() => commit(onReject)}
                            loadingText="Rejecting…"
                        >
                            Reject &amp; return to Draft
                        </MyButton>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Cancel (destructive) ── */}
            <AlertDialog
                open={pending === 'cancel'}
                onOpenChange={(open) => !open && setPending(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-danger-600">
                            <Warning size={20} weight="fill" />
                            Cancel {period} payroll?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="flex flex-col gap-3 text-body text-neutral-600">
                                <p>
                                    The run is closed as cancelled and drops off the happy path. Any
                                    loan EMIs and reimbursements it had claimed are released back to
                                    the employees.
                                </p>
                                <p>
                                    A fresh run can then be created for {period} — cancelling is how
                                    you start over rather than correct.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep the run</AlertDialogCancel>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onAsyncClick={() => commit(onCancel)}
                            loadingText="Cancelling…"
                        >
                            Cancel this run
                        </MyButton>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
