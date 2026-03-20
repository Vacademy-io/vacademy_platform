import { useState, useRef } from 'react';
import {
    CertificateGenerationSession,
    CertificateStudentData,
} from '@/types/certificate/certificate-types';
import { MyTable } from '@/components/design-system/table';
import { MyButton } from '@/components/design-system/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CertificateStudentSidebar } from '../student-sidebar/certificate-student-sidebar';
import { CsvUploadSection } from '../csv-upload/csv-upload-section';
import { CsvValidationResults } from '../csv-validation/csv-validation-results';
import { Download, Users, ArrowRight } from '@phosphor-icons/react';
import { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface StudentDataStepProps {
    session: CertificateGenerationSession;
    onSessionUpdate: (updates: Partial<CertificateGenerationSession>) => void;
    onNextStep: () => void;
}

// Define columns for the student table
const studentColumns: ColumnDef<CertificateStudentData>[] = [
    {
        accessorKey: 'user_id',
        header: 'User ID',
        size: 120,
    },
    {
        accessorKey: 'institute_enrollment_id',
        header: 'Enrollment ID',
        size: 150,
    },
    {
        accessorKey: 'full_name',
        header: 'Student Name',
        size: 200,
    },
    {
        accessorKey: 'email',
        header: 'Email',
        size: 200,
    },
    {
        accessorKey: 'linked_institute_name',
        header: 'Institute',
        size: 150,
    },
    {
        accessorKey: 'mobile_number',
        header: 'Phone Number',
        size: 150,
    },
];

export const StudentDataStep = ({ session, onSessionUpdate, onNextStep }: StudentDataStepProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<CertificateStudentData | null>(null);
    const tableRef = useRef<HTMLDivElement>(null);

    const handleDownloadTemplate = () => {
        // Create CSV template with the first 3 required columns
        const headers = ['user_id', 'enrollment_number', 'student_name'];
        const csvContent = [
            headers.join(','),
            ...session.selectedStudents.map((student) =>
                [
                    student.user_id,
                    student.institute_enrollment_id || '',
                    student.full_name || '',
                ].join(',')
            ),
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'certificate_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleStudentClick = (student: CertificateStudentData) => {
        setSelectedStudent(student);
        setIsSidebarOpen(true);
    };

    const canProceedToNext = session.uploadedCsvData && session.validationResult?.isValid;

    return (
        <div className="flex flex-col gap-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/30 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-100 p-2">
                            <Users className="size-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-700">
                                Selected {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}s (
                                {session.selectedStudents.length})
                            </h2>
                            <p className="text-sm text-neutral-500">
                                Review{' '}
                                {getTerminology(
                                    RoleTerms.Learner,
                                    SystemTerms.Learner
                                ).toLocaleLowerCase()}{' '}
                                data and upload dynamic information via CSV
                            </p>
                        </div>
                    </div>

                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2"
                    >
                        <Download className="size-4" />
                        Download Template
                    </MyButton>
                </div>

                {/* CSV Upload Section */}
                <CsvUploadSection session={session} onSessionUpdate={onSessionUpdate} />

                {/* Validation Results */}
                {session.validationResult && (
                    <CsvValidationResults validationResult={session.validationResult} />
                )}
            </div>

            {/* Students Table */}
            <div className="overflow-hidden rounded-xl border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 shadow-sm">
                <div className="max-w-full" ref={tableRef}>
                    <SidebarProvider
                        style={{ ['--sidebar-width' as string]: '565px' }}
                        defaultOpen={false}
                        open={isSidebarOpen}
                        onOpenChange={setIsSidebarOpen}
                    >
                        <MyTable<CertificateStudentData>
                            data={{
                                content: session.selectedStudents.map((student, index) => ({
                                    ...student,
                                    id: student.user_id || index.toString(),
                                })),
                                total_pages: 1,
                                page_no: 0,
                                page_size: session.selectedStudents.length,
                                total_elements: session.selectedStudents.length,
                                last: true,
                            }}
                            columns={studentColumns}
                            isLoading={false}
                            error={null}
                            onSort={() => {}}
                            tableState={{ columnVisibility: {} }}
                            currentPage={0}
                        />
                        <CertificateStudentSidebar student={selectedStudent} session={session} />
                    </SidebarProvider>
                </div>
            </div>

            {/* Action Footer */}
            <div className="flex justify-end rounded-lg border border-neutral-200/50 bg-gradient-to-r from-neutral-50/50 to-white p-4">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={onNextStep}
                    disabled={!canProceedToNext}
                    className={cn(
                        'flex items-center gap-2 transition-all duration-200',
                        canProceedToNext ? 'hover:scale-105' : 'cursor-not-allowed opacity-50'
                    )}
                >
                    Next: PDF Annotation
                    <ArrowRight className="size-4" />
                </MyButton>
            </div>
        </div>
    );
};
