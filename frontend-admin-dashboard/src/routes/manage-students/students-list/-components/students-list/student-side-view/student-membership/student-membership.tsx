import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import StudentPlanDetails from '../student-overview/StudentPlanDetails';

export const StudentMembership = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();

    return (
        <div className="space-y-4">
            <StudentPlanDetails
                userId={
                    isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || ''
                }
            />
        </div>
    );
};
