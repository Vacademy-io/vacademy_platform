import { useState, useEffect } from 'react';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { InitiateReportDialog } from './InitiateReportDialog';
import { getStudentReports, getStudentReport } from '@/services/student-analysis';
import { StudentReport, StudentReportData } from '@/types/student-analysis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, FileText, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { StudentReportDetailsDialog } from './StudentReportDetailsDialog';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const StudentReports = () => {
    const { selectedStudent } = useStudentSidebar();
    const [reports, setReports] = useState<StudentReport[]>([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedReport, setSelectedReport] = useState<StudentReportData | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const [pendingProcesses, setPendingProcesses] = useState<string[]>([]);
    const [statusCheckLoading, setStatusCheckLoading] = useState(false);

    const checkPendingProcesses = () => {
        const storedProcesses = sessionStorage.getItem('student_analysis_processes');
        if (storedProcesses) {
            try {
                const processes: string[] = JSON.parse(storedProcesses);
                setPendingProcesses(processes);
            } catch (e) {
                console.error('Error parsing student_analysis_processes', e);
                setPendingProcesses([]);
            }
        } else {
            setPendingProcesses([]);
        }
    };

    useEffect(() => {
        checkPendingProcesses();
    }, []);

    const fetchReports = async () => {
        if (!selectedStudent?.user_id) return;
        setLoading(true);
        try {
            const response = await getStudentReports(
                selectedStudent.user_id,
                selectedStudent.institute_id,
                page,
                5
            );
            setReports(response.reports);
            setTotalPages(response.total_pages);

            // Cleanup session storage for completed processes
            const storedProcesses = sessionStorage.getItem('student_analysis_processes');
            if (storedProcesses) {
                try {
                    const processes: string[] = JSON.parse(storedProcesses);
                    const completedProcessIds = new Set(response.reports.map((r) => r.process_id));
                    const remainingProcesses = processes.filter(
                        (id) => !completedProcessIds.has(id)
                    );

                    if (remainingProcesses.length !== processes.length) {
                        if (remainingProcesses.length > 0) {
                            sessionStorage.setItem(
                                'student_analysis_processes',
                                JSON.stringify(remainingProcesses)
                            );
                        } else {
                            sessionStorage.removeItem('student_analysis_processes');
                        }
                        setPendingProcesses(remainingProcesses);
                    }
                } catch (e) {
                    console.error('Error parsing student_analysis_processes', e);
                }
            }
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [selectedStudent?.user_id, page]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 0 && newPage < totalPages) {
            setPage(newPage);
        }
    };

    const handleViewDetails = (report: StudentReportData) => {
        setSelectedReport(report);
        setDetailsOpen(true);
    };

    const handleCheckStatus = async () => {
        setStatusCheckLoading(true);
        try {
            const storedProcesses = sessionStorage.getItem('student_analysis_processes');
            if (!storedProcesses) return;

            const processes: string[] = JSON.parse(storedProcesses);
            const remainingProcesses: string[] = [];
            let hasUpdates = false;
            let stillPendingCount = 0;
            let completedCount = 0;
            let failedCount = 0;

            for (const processId of processes) {
                try {
                    const report = await getStudentReport(processId);
                    if (report.status === 'COMPLETED') {
                        hasUpdates = true;
                        completedCount++;
                    } else if (report.status === 'FAILED') {
                        hasUpdates = true;
                        failedCount++;
                    } else {
                        remainingProcesses.push(processId);
                        stillPendingCount++;
                    }
                } catch (error) {
                    console.error(`Error checking status for ${processId}`, error);
                    remainingProcesses.push(processId);
                }
            }

            if (hasUpdates) {
                fetchReports();
                if (remainingProcesses.length > 0) {
                    sessionStorage.setItem(
                        'student_analysis_processes',
                        JSON.stringify(remainingProcesses)
                    );
                } else {
                    sessionStorage.removeItem('student_analysis_processes');
                }
                setPendingProcesses(remainingProcesses);
            }

            if (completedCount > 0) {
                toast.success(`${completedCount} report(s) completed successfully`);
            }
            if (failedCount > 0) {
                toast.error(`${failedCount} report(s) failed`);
            }
            if (stillPendingCount > 0) {
                toast.info(`${stillPendingCount} report(s) are still processing`);
            }
        } catch (error) {
            console.error('Error checking statuses:', error);
            toast.error('Failed to check report statuses');
        } finally {
            setStatusCheckLoading(false);
        }
    };

    return (
        <div className="flex h-full flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                        {getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Reports
                    </h2>
                </div>
                <div className="flex gap-2">
                    {pendingProcesses.length > 0 ? (
                        <MyButton onClick={handleCheckStatus} disabled={statusCheckLoading}>
                            {statusCheckLoading ? 'Checking...' : 'Check Status'}
                        </MyButton>
                    ) : (
                        <InitiateReportDialog
                            onSuccess={() => {
                                fetchReports();
                                checkPendingProcesses();
                            }}
                        />
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="size-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
                </div>
            ) : reports.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-12 text-center">
                    <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
                        <FileText className="size-8 text-neutral-400" />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold text-neutral-900">
                        No reports found
                    </h3>
                    <p className="mb-6 text-sm text-neutral-500">
                        Generate a new report to analyze student performance.
                    </p>
                    <InitiateReportDialog onSuccess={fetchReports} />
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {reports.map((report) => (
                        <Card
                            key={report.process_id}
                            className="group relative overflow-hidden transition-all hover:shadow-md"
                        >
                            <CardHeader className="py-2">
                                <CardTitle className="mt-4 text-base font-semibold">
                                    {format(new Date(report.start_date_iso), 'MMM d')} -{' '}
                                    {format(new Date(report.end_date_iso), 'MMM d, yyyy')}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-1.5 text-xs">
                                    <Clock className="size-3.5" />
                                    Created {format(new Date(report.created_at), 'MMM d, yyyy')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {report.status === 'COMPLETED' && report.report && (
                                        <MyButton
                                            buttonType="secondary"
                                            onClick={() => handleViewDetails(report.report!)}
                                        >
                                            View Details
                                            <ChevronRight className="size-4" />
                                        </MyButton>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="mt-auto flex items-center justify-center gap-2 py-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 0}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm font-medium text-neutral-600">
                        Page {page + 1} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages - 1}
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            )}

            <StudentReportDetailsDialog
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                report={selectedReport}
            />
        </div>
    );
};
