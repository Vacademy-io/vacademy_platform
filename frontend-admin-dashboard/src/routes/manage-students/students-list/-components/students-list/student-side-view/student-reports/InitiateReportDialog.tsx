import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { initiateStudentAnalysis } from '@/services/student-analysis';
import { toast } from 'sonner';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface InitiateReportDialogProps {
    onSuccess?: () => void;
}

export const InitiateReportDialog = ({ onSuccess }: InitiateReportDialogProps) => {
    const [open, setOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const { selectedStudent } = useStudentSidebar();

    const handleInitiate = async () => {
        if (!selectedStudent?.user_id) return;
        if (!startDate || !endDate) {
            toast.error('Please select both start and end dates');
            return;
        }

        setLoading(true);
        try {
            const response = await initiateStudentAnalysis(
                {
                    user_id: selectedStudent.user_id,
                    start_date_iso: startDate,
                    end_date_iso: endDate,
                },
                selectedStudent.institute_id
            );

            if (response.process_id) {
                // Store process_id in sessionStorage as requested
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
            onOpenChange={setOpen}
            trigger={<MyButton>New Report</MyButton>}
            heading={`Generate ${getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Report`}
            dialogWidth="sm:max-w-[425px]"
            content={
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-500">
                        Select a date range to analyze performance.
                    </p>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start-date" className="text-right">
                                Start Date
                            </Label>
                            <Input
                                id="start-date"
                                type="date"
                                className="col-span-3"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="end-date" className="text-right">
                                End Date
                            </Label>
                            <Input
                                id="end-date"
                                type="date"
                                className="col-span-3"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
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
