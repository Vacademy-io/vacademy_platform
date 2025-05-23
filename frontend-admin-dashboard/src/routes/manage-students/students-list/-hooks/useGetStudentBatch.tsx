// hooks/student-list/useGetStudentBatch.ts
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

export const useGetStudentBatch = (
    package_session_id: string
): { packageName: string; levelName: string } => {
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);

    if (!instituteDetails) return { packageName: '', levelName: '' };

    const batch = instituteDetails.batches_for_sessions.find(
        (batch) => batch.id === package_session_id
    );

    return {
        levelName: batch?.level.level_name || '',
        packageName: batch?.package_dto.package_name || '',
    };
};
