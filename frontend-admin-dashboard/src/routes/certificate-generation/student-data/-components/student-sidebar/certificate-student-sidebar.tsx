import {
    CertificateStudentData,
    CertificateGenerationSession,
} from '@/types/certificate/certificate-types';
import { SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import {
    User,
    EnvelopeSimple,
    Phone,
    GraduationCap,
    Hash,
    Calendar,
    FileCsv,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface CertificateStudentSidebarProps {
    student: CertificateStudentData | null;
    session: CertificateGenerationSession;
}

export const CertificateStudentSidebar = ({ student, session }: CertificateStudentSidebarProps) => {
    if (!student) {
        return (
            <SidebarContent className="p-0">
                <div className="flex h-full items-center justify-center p-6">
                    <div className="text-center">
                        <div className="mx-auto mb-3 w-fit rounded-full bg-neutral-100 p-3">
                            <User className="size-5 text-neutral-400" />
                        </div>
                        <p className="text-sm text-neutral-500">Select a student to view details</p>
                    </div>
                </div>
            </SidebarContent>
        );
    }

    // Find matching CSV data for this student
    const csvData = session.uploadedCsvData?.find((row) => row.user_id === student.user_id);
    const dynamicFields = csvData
        ? Object.entries(csvData).filter(
              ([key]) => !['user_id', 'enrollment_number', 'student_name'].includes(key)
          )
        : [];

    const StudentField = ({
        icon: Icon,
        label,
        value,
        className,
    }: {
        icon: React.ComponentType<{ className?: string }>;
        label: string;
        value: string | number | undefined;
        className?: string;
    }) => (
        <div className={cn('flex items-start gap-3 rounded-lg p-3', className)}>
            <div className="mt-0.5 rounded-md bg-neutral-100 p-1.5">
                <Icon className="size-3.5 text-neutral-600" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-medium text-neutral-500">{label}</p>
                <p className="break-words text-sm text-neutral-700">{value || 'Not available'}</p>
            </div>
        </div>
    );

    return (
        <SidebarContent className="p-0">
            <div className="flex h-full flex-col">
                {/* Header */}
                <SidebarHeader className="border-b border-neutral-200 bg-gradient-to-r from-blue-50 to-blue-100/50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-100 p-2">
                            <User className="size-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-neutral-700">
                                {student.full_name}
                            </h3>
                            <p className="text-xs text-neutral-500">ID: {student.user_id}</p>
                        </div>
                    </div>
                </SidebarHeader>

                {/* Content */}
                <div className="flex-1 space-y-6 overflow-y-auto p-4">
                    {/* Basic Information */}
                    <div>
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700">
                            <GraduationCap className="size-4" />
                            Basic Information
                        </h4>
                        <div className="space-y-2">
                            <StudentField
                                icon={Hash}
                                label="Enrollment Number"
                                value={student.institute_enrollment_id}
                                className="bg-neutral-50"
                            />
                            <StudentField
                                icon={EnvelopeSimple}
                                label="Email"
                                value={student.email}
                                className="bg-neutral-50"
                            />
                            <StudentField
                                icon={Phone}
                                label="Phone Number"
                                value={student.mobile_number}
                                className="bg-neutral-50"
                            />
                            <StudentField
                                icon={Calendar}
                                label="Package Session"
                                value={student.package_session_id}
                                className="bg-neutral-50"
                            />
                        </div>
                    </div>

                    {/* Dynamic Fields from CSV */}
                    {session.uploadedCsvData && (
                        <div>
                            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700">
                                <FileCsv className="size-4" />
                                Dynamic Data
                                {dynamicFields.length > 0 && (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                        {dynamicFields.length} field
                                        {dynamicFields.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </h4>

                            {dynamicFields.length > 0 ? (
                                <div className="space-y-2">
                                    {dynamicFields.map(([key, value]) => {
                                        // Determine data type for styling
                                        const isNumber = typeof value === 'number';
                                        const isDate =
                                            typeof value === 'string' &&
                                            /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}-\d{2}-\d{4}$/.test(
                                                value
                                            );

                                        return (
                                            <div
                                                key={key}
                                                className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3"
                                            >
                                                <div
                                                    className={cn(
                                                        'mt-0.5 rounded-md p-1.5',
                                                        isNumber
                                                            ? 'bg-green-100'
                                                            : isDate
                                                              ? 'bg-purple-100'
                                                              : 'bg-blue-100'
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            'size-3.5 rounded',
                                                            isNumber
                                                                ? 'bg-green-600'
                                                                : isDate
                                                                  ? 'bg-purple-600'
                                                                  : 'bg-blue-600'
                                                        )}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="mb-1 text-xs font-medium capitalize text-blue-700">
                                                        {key.replace(/_/g, ' ')}
                                                    </p>
                                                    <p className="break-words text-sm text-blue-800">
                                                        {value?.toString() || 'Empty'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-blue-600">
                                                        Type:{' '}
                                                        {isNumber
                                                            ? 'Number'
                                                            : isDate
                                                              ? 'Date'
                                                              : 'Text'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : csvData ? (
                                <div className="py-6 text-center">
                                    <div className="mx-auto mb-2 w-fit rounded-full bg-neutral-100 p-2">
                                        <FileCsv className="size-4 text-neutral-400" />
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        No dynamic fields found for this student
                                    </p>
                                </div>
                            ) : (
                                <div className="py-6 text-center">
                                    <div className="mx-auto mb-2 w-fit rounded-full bg-yellow-100 p-2">
                                        <FileCsv className="size-4 text-yellow-600" />
                                    </div>
                                    <p className="mb-1 text-xs font-medium text-yellow-700">
                                        No CSV Data
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        This student was not found in the uploaded CSV
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Data Summary */}
                    <div className="rounded-lg bg-gradient-to-br from-neutral-50 to-neutral-100 p-4">
                        <h5 className="mb-2 text-xs font-semibold text-neutral-600">
                            Data Summary
                        </h5>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Basic Fields:</span>
                                <span className="font-medium text-neutral-700">4</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Dynamic Fields:</span>
                                <span className="font-medium text-neutral-700">
                                    {dynamicFields.length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Total Fields:</span>
                                <span className="font-semibold text-neutral-700">
                                    {4 + dynamicFields.length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarContent>
    );
};
