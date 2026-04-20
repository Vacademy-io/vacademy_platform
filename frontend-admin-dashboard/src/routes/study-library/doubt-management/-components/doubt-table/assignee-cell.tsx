import {
    FacultyFilterParams,
    fetchInstituteDashboardUsers,
} from '@/routes/dashboard/-services/dashboard-services';
import { TeacherSelection } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/TeacherSelection';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { isUserAdmin } from '@/utils/userDetails';
import { getInstituteId } from '@/constants/helper';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

const EMPTY_FACULTY_FILTERS: FacultyFilterParams = {
    name: '',
    batches: [],
    subjects: [],
    status: [],
    sort_columns: { name: 'DESC' },
};

interface InstituteUser {
    id: string;
    full_name?: string;
    username?: string;
    email?: string;
}

export const AssigneeCell = ({ doubt }: { doubt: Doubt }) => {
    const isAdmin = isUserAdmin();
    const instituteId = getInstituteId();

    const { data: teacherUsers } = useQuery({
        queryKey: ['DOUBT_ASSIGN_TEACHERS', instituteId],
        queryFn: () =>
            fetchInstituteDashboardUsers(
                instituteId,
                {
                    roles: [{ id: '5', name: 'TEACHER' }],
                    status: [{ id: '1', name: 'ACTIVE' }],
                },
                0,
                100
            ),
        enabled: Boolean(instituteId),
        staleTime: 5 * 60 * 1000,
    });

    const teachersOverride = useMemo(() => {
        const content = (teacherUsers?.content ?? []) as InstituteUser[];
        return content.map((user) => ({
            id: user.id,
            name: user.full_name || user.username || user.email || 'Unnamed',
        }));
    }, [teacherUsers?.content]);

    return (
        <TeacherSelection
            doubt={doubt}
            filters={EMPTY_FACULTY_FILTERS}
            canChange={isAdmin || false}
            showCanAssign={false}
            teachersOverride={teachersOverride}
        />
    );
};
