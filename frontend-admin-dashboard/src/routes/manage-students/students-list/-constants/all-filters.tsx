import { FilterConfig } from '@/routes/manage-students/students-list/-types/students-list-types';
import { InstituteDetailsType } from '@/schemas/student/student-list/institute-schema';

export const GetFilterData = (instituteDetails: InstituteDetailsType, currentSession: string) => {
    const batches = instituteDetails?.batches_for_sessions.filter(
        (batch) => batch.session.id === currentSession
    );
    const batchFilterList = batches?.map((batch) => ({
        id: batch.id,
        label: batch.level.level_name + ' ' + batch.package_dto.package_name,
    }));

    const statuses = instituteDetails?.student_statuses.map((status, index) => ({
        id: index.toString(),
        label: status,
    }));

    const genders = instituteDetails?.genders.map((gender, index) => ({
        id: index.toString(),
        label: gender,
    }));

    const sessionExpiry = instituteDetails?.session_expiry_days.map((days, index) => ({
        id: index.toString(),
        label: `Expiring in ${days} days`,
    }));

    const filterData: FilterConfig[] = [
        {
            id: 'batch',
            title: 'Batch',
            filterList: batchFilterList || [],
        },
        {
            id: 'statuses',
            title: 'Status',
            filterList: statuses || [],
        },
        {
            id: 'gender',
            title: 'Gender',
            filterList: genders || [],
        },
        {
            id: 'session_expiry_days',
            title: 'Session Expiry',
            filterList: sessionExpiry || [],
        },
    ];
    return filterData;
};
