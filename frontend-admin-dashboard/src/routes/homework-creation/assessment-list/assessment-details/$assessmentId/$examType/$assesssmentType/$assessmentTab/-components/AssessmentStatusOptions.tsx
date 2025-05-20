import StudentAttemptDropdown from './assessment-submissions-dropdown-individual/student-attempt-dropdown';
import StudentOngoingDropdown from './assessment-submissions-dropdown-individual/student-ongoing-dropdown';
import StudentPendingDropdown from './assessment-submissions-dropdown-individual/student-pending-dropdown';
import { AssessmentRevaluateStudentInterface } from '@/types/assessments/assessment-overview';

export const AssessmentStatusOptions = ({
    student,
    studentType,
}: {
    student: AssessmentRevaluateStudentInterface;
    studentType: string;
}) => {
    return (
        <>
            {studentType === 'Attempted' && <StudentAttemptDropdown student={student} />}
            {studentType === 'Pending' && <StudentPendingDropdown student={student} />}
            {studentType === 'Ongoing' && <StudentOngoingDropdown student={student} />}
        </>
    );
};
