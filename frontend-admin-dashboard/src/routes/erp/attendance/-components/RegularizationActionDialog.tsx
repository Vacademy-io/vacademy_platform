import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Form } from '@/components/ui/form';
import { formatDate } from '@/lib/formatters';
import { reportApiError } from '@/lib/report-api-error';
import { HrTextareaField } from '@/routes/erp/people/-components/HrFormFields';
import { humanizeToken } from '@/routes/erp/people/-components/EmployeeFields';
import type { RegularizationDTO } from '@/routes/erp/-shared/hr-types';
import { useActOnRegularization } from '../-hooks/use-attendance';
import { formatClockTime } from './attendance-meta';

export type RegularizationDecision = 'APPROVED' | 'REJECTED';

/**
 * Remarks are required on a rejection and optional on an approval.
 *
 * A rejection is the one outcome the employee has to act on — they raised the
 * request because their record is wrong, and "rejected" with no reason leaves
 * them with a wrong record and nothing to do about it. An approval explains
 * itself: the record now says what they asked for.
 */
const schema = (decision: RegularizationDecision) =>
    z.object({
        remarks:
            decision === 'REJECTED'
                ? z.string().trim().min(1, 'Tell them why this was rejected')
                : z.string().trim(),
    });

type ActionForm = { remarks: string };

interface RegularizationActionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    request: RegularizationDTO | null;
    decision: RegularizationDecision;
}

export const RegularizationActionDialog = ({
    open,
    onOpenChange,
    request,
    decision,
}: RegularizationActionDialogProps) => {
    const mutation = useActOnRegularization();
    const isReject = decision === 'REJECTED';

    const form = useForm<ActionForm>({
        resolver: zodResolver(schema(decision)),
        defaultValues: { remarks: '' },
        mode: 'onBlur',
    });

    useEffect(() => {
        if (open) form.reset({ remarks: '' });
    }, [open, decision, form]);

    const onSubmit = async (values: ActionForm) => {
        if (!request?.id) return;
        try {
            await mutation.mutateAsync({
                id: request.id,
                date: request.attendance_date,
                payload: {
                    approval_status: decision,
                    ...(values.remarks.trim() ? { remarks: values.remarks.trim() } : {}),
                },
            });
            toast.success(isReject ? 'Request rejected' : 'Request approved');
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-attendance',
                tags: { action: isReject ? 'reject-regularization' : 'approve-regularization' },
                fallbackMessage: 'Could not record the decision.',
            });
        }
    };

    return (
        <MyDialog
            heading={isReject ? 'Reject this request' : 'Approve this request'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onAsyncClick={form.handleSubmit(onSubmit)}
                        loadingText="Saving…"
                    >
                        {isReject ? 'Reject request' : 'Approve request'}
                    </MyButton>
                </div>
            }
        >
            <Form {...form}>
                <form className="flex flex-col gap-4" noValidate>
                    {request && (
                        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                            <p className="text-body font-semibold text-foreground">
                                {request.employee_name || request.employee_code || 'Employee'}
                            </p>
                            <p className="text-caption text-muted-foreground">
                                {request.attendance_date
                                    ? formatDate(request.attendance_date)
                                    : 'Unknown date'}
                                {' · '}
                                {humanizeToken(request.original_status) || 'No record'} →{' '}
                                {humanizeToken(request.requested_status) || '—'}
                            </p>
                            <p className="text-caption text-muted-foreground">
                                Times {formatClockTime(request.original_check_in)}–
                                {formatClockTime(request.original_check_out)} →{' '}
                                {formatClockTime(request.requested_check_in)}–
                                {formatClockTime(request.requested_check_out)}
                            </p>
                            {request.reason && (
                                <p className="text-body text-foreground">“{request.reason}”</p>
                            )}
                        </div>
                    )}

                    <p className="text-caption text-muted-foreground">
                        {isReject
                            ? 'The attendance record stays exactly as it is. Your remarks are what the employee sees.'
                            : 'Approving rewrites the attendance record for that day — the requested status and times replace what is stored, and the day counts that way in payroll.'}
                    </p>

                    <HrTextareaField
                        control={form.control}
                        name="remarks"
                        label="Remarks"
                        required={isReject}
                        placeholder={
                            isReject
                                ? 'Why this cannot be accepted'
                                : 'Optional note for the record'
                        }
                    />
                </form>
            </Form>
        </MyDialog>
    );
};
