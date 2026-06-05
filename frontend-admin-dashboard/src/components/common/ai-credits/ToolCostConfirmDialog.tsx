import { Sparkle, Warning } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';

interface ToolCostConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    credits: number | null;
    currentBalance: number | null;
    balanceAfter: number | null;
    sufficient: boolean | null;
    /** Called when the user confirms. Closing is handled by the dialog. */
    onConfirm: () => void;
    heading?: string;
    confirmLabel?: string;
}

/**
 * Confirmation step shown for costlier actions (cost over a threshold or balance
 * would go low). Displays the estimated credit cost + resulting balance before the
 * tool runs. Phase 1: informational only — confirming proceeds to the existing
 * generation flow; nothing is deducted here.
 */
export function ToolCostConfirmDialog({
    open,
    onOpenChange,
    credits,
    currentBalance,
    balanceAfter,
    sufficient,
    onConfirm,
    heading = 'Confirm credit usage',
    confirmLabel = 'Continue',
}: ToolCostConfirmDialogProps) {
    const notEnough = sufficient === false;

    const footer = (
        <div className="flex w-full items-center justify-end gap-2">
            <MyButton buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)}>
                Cancel
            </MyButton>
            <MyButton
                buttonType="primary"
                scale="medium"
                disable={notEnough}
                onClick={() => {
                    onConfirm();
                    onOpenChange(false);
                }}
            >
                {confirmLabel}
            </MyButton>
        </div>
    );

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading={heading}
            footer={footer}
            dialogWidth="max-w-md"
        >
            <div className="flex flex-col items-center gap-4 px-6 py-6">
                <div className="flex items-center gap-2 rounded-full border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-2 text-purple-700">
                    <Sparkle className="size-5" weight="fill" />
                    <span className="text-h3 font-bold">
                        ≈ {credits == null ? '—' : credits} credits
                    </span>
                </div>

                <p className="text-center text-body text-neutral-500">
                    This action will use approximately{' '}
                    <span className="font-semibold text-neutral-700">{credits ?? '—'}</span> credits.
                    Larger inputs may cost slightly more.
                </p>

                {currentBalance != null && (
                    <div className="flex w-full flex-col gap-1 rounded-lg bg-neutral-50 p-3 text-body">
                        <div className="flex justify-between text-neutral-500">
                            <span>Current balance</span>
                            <span className="font-semibold text-neutral-700">
                                {currentBalance.toFixed(1)}
                            </span>
                        </div>
                        {balanceAfter != null && (
                            <div className="flex justify-between text-neutral-500">
                                <span>Balance after</span>
                                <span className="font-semibold text-neutral-700">
                                    {balanceAfter.toFixed(1)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {notEnough && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-caption text-amber-700">
                        <Warning className="size-4 shrink-0" weight="fill" />
                        <span>
                            This exceeds your current credit balance. Please top up to continue.
                        </span>
                    </div>
                )}
            </div>
        </MyDialog>
    );
}
