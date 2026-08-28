import { PencilSimple } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/formatters';
import type { EmployeeProfileDTO } from '@/routes/erp/-shared/hr-types';
import { DetailField, EmploymentStatusChip, humanizeToken } from './EmployeeFields';

/**
 * The read view of an employee profile.
 *
 * PAN/UAN are shown exactly as the API returned them — masked for most callers.
 * Nothing here un-masks them; editing is where a fresh value is supplied.
 */
export function EmployeeProfileTab({
    employee,
    canEdit,
    onEdit,
}: {
    employee: EmployeeProfileDTO;
    canEdit: boolean;
    onEdit: () => void;
}) {
    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
                    <CardTitle className="text-title">Profile</CardTitle>
                    {canEdit && (
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={onEdit}
                        >
                            <PencilSimple size={16} /> Edit
                        </MyButton>
                    )}
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label="Employee code" value={employee.employee_code} />
                    <DetailField label="Name" value={employee.full_name} />
                    <DetailField
                        label="Employment status"
                        value={<EmploymentStatusChip status={employee.employment_status} />}
                    />
                    <DetailField label="Email" value={employee.email} />
                    <DetailField label="Mobile" value={employee.mobile_number} />
                    <DetailField
                        label="Employment type"
                        value={humanizeToken(employee.employment_type)}
                    />
                    <DetailField label="Department" value={employee.department_name} />
                    <DetailField label="Designation" value={employee.designation_name} />
                    <DetailField
                        label="Reporting manager"
                        value={employee.reporting_manager_name}
                    />
                    <DetailField
                        label="Join date"
                        value={employee.join_date ? formatDate(employee.join_date) : ''}
                    />
                    <DetailField
                        label="Notice period"
                        value={
                            employee.notice_period_days === undefined ||
                            employee.notice_period_days === null
                                ? ''
                                : `${employee.notice_period_days} days`
                        }
                    />
                    <DetailField label="Nationality" value={employee.nationality} />
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-title">Emergency contact</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <DetailField label="Name" value={employee.emergency_contact_name} />
                        <DetailField label="Phone" value={employee.emergency_contact_phone} />
                        <DetailField label="Relation" value={employee.emergency_contact_relation} />
                        <DetailField label="Blood group" value={employee.blood_group} />
                        <DetailField
                            label="Marital status"
                            value={humanizeToken(employee.marital_status)}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-title">Statutory identifiers</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <DetailField label="PAN" value={employee.pan_number} />
                            <DetailField label="UAN" value={employee.uan_number} />
                        </div>
                        <p className="text-caption text-muted-foreground">
                            Stored numbers are shown partly hidden. Editing replaces a number only
                            when you type a new one.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
