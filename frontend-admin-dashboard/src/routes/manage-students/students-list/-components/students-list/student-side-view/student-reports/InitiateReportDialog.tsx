import { useState } from 'react';
import { initiateStudentAnalysis } from '@/services/student-analysis';
import { toast } from 'sonner';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface InitiateReportDialogProps {
    onSuccess?: () => void;
}

/** Admin-selectable report modules. Keys must match the backend ReportModule keys. */
const REPORT_MODULES: { key: string; label: string }[] = [
    { key: 'attendance', label: 'Attendance' },
    { key: 'live_classes', label: 'Live Classes' },
    { key: 'academics', label: 'Academics & Marks' },
    { key: 'activity', label: 'Learning Activity' },
    { key: 'progress', label: 'Course Progress' },
    { key: 'certificates', label: 'Certificates' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'doubts', label: 'Doubts' },
    { key: 'login', label: 'Login Activity' },
];
const ALL_MODULE_KEYS = REPORT_MODULES.map((m) => m.key);

export const InitiateReportDialog = ({ onSuccess }: InitiateReportDialogProps) => {
    const [open, setOpen] = useState(false);
    const [reportName, setReportName] = useState('');
    const [sendEmail, setSendEmail] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedModules, setSelectedModules] = useState<string[]>(ALL_MODULE_KEYS);
    const [loading, setLoading] = useState(false);
    const { selectedStudent } = useStudentSidebar();

    const handleOpen = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) {
            // Reset to defaults each time the dialog opens
            setSelectedModules(ALL_MODULE_KEYS);
            setReportName('');
            setSendEmail(true);
        }
    };

    /** Live placeholder for the name field: "Report: <start> to <end>" */
    const namePlaceholder =
        startDate && endDate
            ? `Report: ${startDate} to ${endDate}`
            : startDate
              ? `Report: ${startDate} to …`
              : 'Report: (auto-generated)';

    const toggleModule = (key: string) => {
        setSelectedModules((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const handleInitiate = async () => {
        if (!selectedStudent?.user_id) return;
        if (!startDate || !endDate) {
            toast.error('Please select both start and end dates');
            return;
        }
        // An inverted range makes every collector query an empty window, and the report comes back
        // as a confident 0% across the board. Catch it here rather than shipping a wrong report.
        if (startDate > endDate) {
            toast.error('Start date must be on or before the end date');
            return;
        }
        if (selectedModules.length === 0) {
            toast.error('Select at least one module to include in the report');
            return;
        }

        // Package/session is taken from the selected student (not shown in the form).
        const packageSessionId = (selectedStudent.package_session_id ?? '').trim();

        setLoading(true);
        try {
            const trimmedName = reportName.trim();
            const response = await initiateStudentAnalysis(
                {
                    user_id: selectedStudent.user_id,
                    start_date_iso: startDate,
                    end_date_iso: endDate,
                    report_version: 'v2',
                    send_email: sendEmail,
                    include_modules: selectedModules,
                    ...(trimmedName ? { name: trimmedName } : {}),
                    ...(packageSessionId
                        ? { batch_id: packageSessionId, package_session_id: packageSessionId }
                        : {}),
                },
                selectedStudent.institute_id
            );

            if (response.process_id) {
                const storedProcesses = JSON.parse(
                    sessionStorage.getItem('student_analysis_processes') || '[]'
                );
                storedProcesses.push(response.process_id);
                sessionStorage.setItem(
                    'student_analysis_processes',
                    JSON.stringify(storedProcesses)
                );

                toast.success('Analysis initiated successfully');
                setOpen(false);
                onSuccess?.();
            } else {
                toast.error(response.message || 'Failed to initiate analysis');
            }
        } catch (error) {
            console.error('Error initiating analysis:', error);
            toast.error('Failed to initiate analysis');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={handleOpen}
            trigger={<MyButton>New Report</MyButton>}
            heading={`Generate ${getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Report`}
            dialogWidth="max-w-sm"
            content={
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-neutral-500">
                        Select a date range to analyze performance.
                    </p>
                    <div className="flex flex-col gap-4">
                        {/* Report Name (optional) */}
                        <div className="flex flex-col gap-1.5">
                            <Label
                                htmlFor="report-name"
                                className="text-xs font-medium text-neutral-600"
                            >
                                Report Name{' '}
                                <span className="font-normal text-neutral-400">(optional)</span>
                            </Label>
                            <Input
                                id="report-name"
                                type="text"
                                placeholder={namePlaceholder}
                                value={reportName}
                                onChange={(e) => setReportName(e.target.value)}
                            />
                        </div>

                        {/* Modules to include */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-neutral-600">
                                Modules to Include
                            </Label>
                            <p className="text-xs text-neutral-400">
                                Only selected modules are queried — uncheck what this institute
                                doesn&apos;t use.
                            </p>
                            <div className="mt-1 grid grid-cols-2 gap-2">
                                {REPORT_MODULES.map((m) => (
                                    <label
                                        key={m.key}
                                        htmlFor={`module-${m.key}`}
                                        className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600"
                                    >
                                        <Checkbox
                                            id={`module-${m.key}`}
                                            checked={selectedModules.includes(m.key)}
                                            onCheckedChange={() => toggleModule(m.key)}
                                        />
                                        {m.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Start Date */}
                        <div className="flex flex-col gap-1.5">
                            <Label
                                htmlFor="start-date"
                                className="text-xs font-medium text-neutral-600"
                            >
                                Start Date
                            </Label>
                            <Input
                                id="start-date"
                                type="date"
                                value={startDate}
                                max={endDate || undefined}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        {/* End Date */}
                        <div className="flex flex-col gap-1.5">
                            <Label
                                htmlFor="end-date"
                                className="text-xs font-medium text-neutral-600"
                            >
                                End Date
                            </Label>
                            <Input
                                id="end-date"
                                type="date"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        {/* Notify learner */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="send-email"
                                className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600"
                            >
                                <Checkbox
                                    id="send-email"
                                    checked={sendEmail}
                                    onCheckedChange={(c) => setSendEmail(c === true)}
                                />
                                Send email to learner
                            </label>
                            <p className="text-xs text-neutral-400">
                                Push &amp; in-app alerts are always sent; email is optional.
                            </p>
                        </div>
                    </div>
                </div>
            }
            footer={
                <>
                    <MyButton
                        buttonType="secondary"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                    >
                        Cancel
                    </MyButton>
                    <MyButton onClick={handleInitiate} disabled={loading}>
                        {loading ? 'Initiating...' : 'Generate'}
                    </MyButton>
                </>
            }
        />
    );
};
