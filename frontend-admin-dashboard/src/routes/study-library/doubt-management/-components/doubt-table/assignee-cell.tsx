import { FacultyFilterParams } from '@/routes/dashboard/-services/dashboard-services';
import { useInstituteTeachers } from '@/routes/dashboard/-hooks/useInstituteTeachers';
import { TeacherSelection } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/TeacherSelection';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { isUserAdmin } from '@/utils/userDetails';
import { getInstituteId } from '@/constants/helper';

const EMPTY_FACULTY_FILTERS: FacultyFilterParams = {
    name: '',
    batches: [],
    subjects: [],
    status: [],
    sort_columns: { name: 'DESC' },
};

export const AssigneeCell = ({ doubt }: { doubt: Doubt }) => {
    const isAdmin = isUserAdmin();
    const { teachers } = useInstituteTeachers(getInstituteId());

    return (
        <TeacherSelection
            doubt={doubt}
            filters={EMPTY_FACULTY_FILTERS}
            canChange={isAdmin || false}
            showCanAssign={false}
            teachersOverride={teachers}
        />
    );
};
