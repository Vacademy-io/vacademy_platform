import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyInput } from '@/components/design-system/input';
import { MultiSelect } from '@/components/design-system/multi-select';
import { getInstituteId } from '@/constants/helper';
import { reportApiError } from '@/lib/report-api-error';
import { fetchEmployees, hrKeys } from '@/routes/erp/-shared/hr-service';
import { formatEmployeeLabel } from '@/routes/erp/-shared/EmployeePicker';
import type { ShiftDTO } from '@/routes/erp/-shared/hr-types';
import { useAssignShift } from '../-hooks/use-attendance';
import { todayIso } from './attendance-meta';

/** One page of active employees — the assign list, same size the employee picker uses. */
const DIRECTORY_SIZE = 200;

interface AssignShiftDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shifts: ShiftDTO[];
}

/**
 * Put a group of employees on a shift from a given date.
 *
 * Deliberately date-scoped rather than "current shift": the backend closes any
 * assignment still open on or after `effective_from`, so this is how a shift
 * change is recorded historically — last month's attendance keeps being judged
 * against last month's shift.
 */
export const AssignShiftDialog = ({ open, onOpenChange, shifts }: AssignShiftDialogProps) => {
    const mutation = useAssignShift();
    const [shiftId, setShiftId] = useState<string>('');
    const [employeeIds, setEmployeeIds] = useState<string[]>([]);
    const [effectiveFrom, setEffectiveFrom] = useState<string>(() => todayIso());
    const [error, setError] = useState<string | null>(null);

    const employees = useQuery({
        queryKey: hrKeys.employees({ purpose: 'shift-assign', size: DIRECTORY_SIZE }),
        queryFn: () => fetchEmployees({ page: 0, size: DIRECTORY_SIZE, status: 'ACTIVE' }),
        enabled: open && !!getInstituteId(),
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (!open) return;
        setShiftId(shifts.find((shift) => shift.is_default)?.id ?? shifts[0]?.id ?? '');
        setEmployeeIds([]);
        setEffectiveFrom(todayIso());
        setError(null);
    }, [open, shifts]);

    const shiftOptions = useMemo(
        () =>
            shifts
                .filter((shift) => !!shift.id)
                .map((shift) => ({
                    id: shift.id as string,
                    label: shift.code
                        ? `${shift.name ?? shift.code} (${shift.code})`
                        : shift.name ?? '',
                })),
        [shifts]
    );

    const employeeOptions = useMemo(
        () =>
            (employees.data?.content ?? [])
                .filter((employee) => !!employee.id)
                .map((employee) => ({
                    label: formatEmployeeLabel(employee),
                    value: employee.id as string,
                })),
        [employees.data?.content]
    );

    const selectedShiftLabel =
        shiftOptions.find((option) => option.id === shiftId)?.label ?? undefined;

    const onSubmit = async () => {
        if (!shiftId) {
            setError('Pick the shift to assign.');
            return;
        }
        if (employeeIds.length === 0) {
            setError('Pick at least one employee.');
            return;
        }
        if (!effectiveFrom) {
            setError('Pick the date the assignment starts from.');
            return;
        }
        setError(null);
        try {
            await mutation.mutateAsync({
                shift_id: shiftId,
                employee_ids: employeeIds,
                effective_from: effectiveFrom,
            });
            toast.success(
                `${employeeIds.length} ${employeeIds.length === 1 ? 'employee' : 'employees'} assigned`
            );
            onOpenChange(false);
        } catch (assignError) {
            setError(
                reportApiError(assignError, {
                    feature: 'erp-attendance',
                    tags: { action: 'assign-shift' },
                    fallbackMessage: 'Could not assign the shift.',
                })
            );
        }
    };

    return (
        <MyDialog
            heading="Assign a shift"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-xl"
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
                        onAsyncClick={onSubmit}
                        loadingText="Assigning…"
                    >
                        Assign shift
                    </MyButton>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-2 rounded-md bg-info-50 p-3 text-caption text-neutral-600">
                    <Info size={16} className="mt-0.5 shrink-0 text-info-600" />
                    <span>
                        Assigning closes any shift these employees are already on from the effective
                        date onwards — an employee is only ever on one shift at a time. Days before
                        that date keep being judged against their old shift.
                    </span>
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className="text-body text-foreground">Shift</span>
                    <MyDropdown
                        currentValue={selectedShiftLabel}
                        placeholder="Select a shift"
                        dropdownList={shiftOptions.map((option) => option.label)}
                        handleChange={(value) =>
                            setShiftId(
                                shiftOptions.find((option) => option.label === String(value))?.id ??
                                    ''
                            )
                        }
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className="text-body text-foreground">Employees</span>
                    <MultiSelect
                        options={employeeOptions}
                        selected={employeeIds}
                        onChange={setEmployeeIds}
                        disabled={employees.isLoading || employees.isError}
                        placeholder={
                            employees.isLoading
                                ? 'Loading employees…'
                                : employees.isError
                                  ? 'Employees unavailable'
                                  : 'Select employees'
                        }
                        /* Inside a dialog: a portalled list can't be scrolled through react-remove-scroll. */
                        portal={false}
                    />
                    {employees.isError && (
                        <span className="text-caption text-danger-600">
                            Could not load employees. Close this and try again.
                        </span>
                    )}
                    {!employees.isLoading &&
                        !employees.isError &&
                        (employees.data?.total_elements ?? 0) > employeeOptions.length && (
                            <span className="text-caption text-muted-foreground">
                                Showing the first {employeeOptions.length} of{' '}
                                {employees.data?.total_elements} active employees.
                            </span>
                        )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className="text-body text-foreground">Effective from</span>
                    <MyInput
                        inputType="date"
                        input={effectiveFrom}
                        onChangeFunction={(event) => setEffectiveFrom(event.target.value)}
                        inputPlaceholder=""
                        className="w-full sm:w-full"
                    />
                </div>

                {error && <p className="text-caption text-danger-600">{error}</p>}
            </div>
        </MyDialog>
    );
};
