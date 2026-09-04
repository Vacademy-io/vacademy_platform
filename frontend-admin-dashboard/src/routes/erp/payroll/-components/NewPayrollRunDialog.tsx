import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import {
    MonthPicker,
    previousMonthValue,
    type MonthValue,
} from '@/components/design-system/month-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { RUN_TYPE_LABELS, type PayrollRunType } from '@/routes/erp/-shared/payroll-status';
import type { CreateRunInput, CreateRunResult } from '@/routes/erp/payroll/-hooks/use-payroll-runs';

/**
 * What each run type actually pays.
 *
 * Picking the wrong type is the most expensive mistake available on this screen: a
 * REGULAR run pays everyone, while an OFF_CYCLE or BONUS run pays *nobody* if no
 * adjustment carries that scope — which looks identical to a broken run. So the
 * choice is never four bare labels; every option carries the sentence that says who
 * ends up on the payslip list.
 */
const RUN_TYPE_OPTIONS: { value: PayrollRunType; label: string; covers: string }[] = [
    {
        value: 'REGULAR',
        label: RUN_TYPE_LABELS.REGULAR,
        covers: 'Everyone employed during the month — the normal monthly salary run.',
    },
    {
        value: 'OFF_CYCLE',
        label: RUN_TYPE_LABELS.OFF_CYCLE,
        covers: 'Only employees who have a pending off-cycle adjustment for the month.',
    },
    {
        value: 'FNF',
        label: RUN_TYPE_LABELS.FNF,
        covers: 'Only employees exiting during the month — settles their final dues.',
    },
    {
        value: 'BONUS',
        label: RUN_TYPE_LABELS.BONUS,
        covers: 'Only employees who have a pending bonus adjustment for the month.',
    },
];

interface NewPayrollRunDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Creates the run; failures are already reported by the hook. */
    onCreate: (input: CreateRunInput) => Promise<CreateRunResult>;
    /** Only called when the new run's id could be resolved. */
    onCreated: (runId: string) => void;
}

/**
 * Create a payroll run for a month.
 *
 * Defaults to last month because that is the month you pay: an institute running
 * payroll on the 3rd wants August, not September. Future months are blocked
 * outright — there is no attendance to compute against yet.
 */
export const NewPayrollRunDialog = ({
    open,
    onOpenChange,
    onCreate,
    onCreated,
}: NewPayrollRunDialogProps) => {
    const [period, setPeriod] = useState<MonthValue>(() => previousMonthValue());
    const [runType, setRunType] = useState<PayrollRunType>('REGULAR');
    const [notes, setNotes] = useState('');

    // Reopening should not inherit the last attempt's choices — a failed "already
    // exists" attempt would otherwise be re-submitted verbatim.
    useEffect(() => {
        if (open) {
            setPeriod(previousMonthValue());
            setRunType('REGULAR');
            setNotes('');
        }
    }, [open]);

    const submit = async () => {
        const result = await onCreate({ period, runType, notes });
        if (!result.created) return;
        toast.success('Payroll run created. Process it when you are ready to compute salaries.');
        onOpenChange(false);
        // No id means the run exists but we cannot deep-link to it; the refreshed
        // list behind this dialog already shows it, so staying put is correct.
        if (result.runId) onCreated(result.runId);
    };

    return (
        <MyDialog
            heading="New payroll run"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-xl"
            footer={
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onAsyncClick={submit}
                        loadingText="Creating…"
                    >
                        Create run
                    </MyButton>
                </>
            }
        >
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <span className="text-body font-semibold text-neutral-700">Payroll month</span>
                    <MonthPicker
                        value={period}
                        onChange={setPeriod}
                        disableFuture
                        className="w-full sm:w-auto"
                    />
                    <p className="text-caption text-neutral-500">
                        Creating the run does not compute anything yet — you process it in the next
                        step.
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-body font-semibold text-neutral-700">Run type</span>
                    <RadioGroup
                        value={runType}
                        onValueChange={(value) => setRunType(value as PayrollRunType)}
                        className="flex flex-col gap-2"
                    >
                        {RUN_TYPE_OPTIONS.map((option) => (
                            <label
                                key={option.value}
                                htmlFor={`run-type-${option.value}`}
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                                    runType === option.value
                                        ? 'border-primary-500 bg-primary-50'
                                        : 'border-neutral-200 hover:border-primary-200'
                                )}
                            >
                                <RadioGroupItem
                                    value={option.value}
                                    id={`run-type-${option.value}`}
                                    className="mt-1"
                                />
                                <span className="flex flex-col gap-1">
                                    <span className="text-body font-semibold text-neutral-700">
                                        {option.label}
                                    </span>
                                    <span className="text-caption text-neutral-500">
                                        {option.covers}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </RadioGroup>
                </div>

                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="payroll-run-notes"
                        className="text-body font-semibold text-neutral-700"
                    >
                        Notes <span className="font-regular text-neutral-400">(optional)</span>
                    </label>
                    <Textarea
                        id="payroll-run-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        placeholder="Why this run exists — e.g. Diwali bonus approved by the board on 12 Oct."
                    />
                </div>
            </div>
        </MyDialog>
    );
};
