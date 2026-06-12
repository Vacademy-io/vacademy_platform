import { FacultyFilterParams } from '@/routes/dashboard/-services/dashboard-services';
import { useInstituteAssignees } from '@/routes/dashboard/-hooks/useInstituteAssignees';
import { useTeacherList } from '@/routes/dashboard/-hooks/useTeacherList';
import { TeacherSelection } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/TeacherSelection';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { useDoubtQueryTypes } from '../../-services/use-doubt-query-types';
import { isUserAdmin } from '@/utils/userDetails';
import { getInstituteId } from '@/constants/helper';
import { useMemo } from 'react';

const EMPTY_FACULTY_FILTERS: FacultyFilterParams = {
    name: '',
    batches: [],
    subjects: [],
    status: [],
    sort_columns: { name: 'DESC' },
};

export const AssigneeCell = ({ doubt }: { doubt: Doubt }) => {
    const isAdmin = isUserAdmin();
    const instituteId = getInstituteId();

    // All institute staff — fills the dropdown so admin can pick from any role.
    const { assignees } = useInstituteAssignees(instituteId);

    // The batch's FSPSSM faculty are only meaningful "Default" assignees when this doubt's type
    // actually routes to subject/batch teachers. A type routed to specific staff / a role / none
    // (e.g. Technical, Payment) shouldn't surface the whole batch faculty as defaults — that's the
    // confusing "lots of DEFAULT users" noise. The built-in DOUBT type (no per-type assignee →
    // defers to the global cascade) keeps showing them.
    const { queryTypes } = useDoubtQueryTypes();
    const routesToFaculty = useMemo(() => {
        const cfg = queryTypes.find(
            (t) => t.key?.toUpperCase() === (doubt.type ?? 'DOUBT').toUpperCase()
        );
        const source = cfg?.assignee?.source;
        return (
            !source ||
            source === 'SUBJECT_TEACHER' ||
            source === 'BATCH_TEACHER' ||
            source === 'BOTH'
        );
    }, [queryTypes, doubt.type]);

    // FSPSSM-linked faculty for this doubt's batch (and subject when present). These are the
    // "default" teachers who should appear pre-selected even when doubt_assignee is empty.
    const fsmFilters = useMemo<FacultyFilterParams>(
        () => ({
            name: '',
            batches: doubt.batch_id ? [doubt.batch_id] : [],
            subjects: doubt.subject_id ? [doubt.subject_id] : [],
            status: ['ACTIVE'],
            sort_columns: { name: 'ASC' },
        }),
        [doubt.batch_id, doubt.subject_id]
    );

    const { data: fsmList } = useTeacherList(
        instituteId || '',
        0,
        100,
        fsmFilters,
        Boolean(instituteId && doubt.batch_id && routesToFaculty)
    );

    // Identify implicit assignees by USER id (not the FSPSSM mapping id). Everything downstream —
    // doubt.all_doubt_assignee.source_id, doubt.excluded_assignee_user_ids, and the backend's
    // exclusion persistence — speaks in user ids, so the Default pill has to match on user id or
    // the filters (explicit/serverExcluded) never fire. A teacher linked to multiple batch/subject
    // FSPSSMs would otherwise appear as duplicate Default pills.
    const implicitAssignees = useMemo(() => {
        if (!routesToFaculty) return [];
        const seen = new Set<string>();
        const result: { id: string; name: string }[] = [];
        (fsmList?.content ?? []).forEach((t) => {
            if (!t?.userId || !t?.name || seen.has(t.userId)) return;
            seen.add(t.userId);
            result.push({ id: t.userId, name: t.name });
        });
        return result;
    }, [fsmList?.content, routesToFaculty]);

    return (
        <TeacherSelection
            doubt={doubt}
            filters={EMPTY_FACULTY_FILTERS}
            canChange={isAdmin || false}
            showCanAssign={false}
            teachersOverride={assignees}
            implicitAssignees={implicitAssignees}
        />
    );
};
