import { FacultyFilterParams } from '@/routes/dashboard/-services/dashboard-services';
import { TeacherSelection } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/TeacherSelection';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { isUserAdmin } from '@/utils/userDetails';

export const AssigneeCell = ({ doubt }: { doubt: Doubt }) => {
    const isAdmin = isUserAdmin();
    const filters: FacultyFilterParams = {
        name: '',
        batches: [doubt.batch_id || ''],
        subjects: [doubt.subject_id || ''],
        status: [],
        sort_columns: { name: 'DESC' },
    };
    return (
        <TeacherSelection
            doubt={doubt}
            filters={filters}
            canChange={isAdmin || false}
            showCanAssign={false}
        />
    );
};
