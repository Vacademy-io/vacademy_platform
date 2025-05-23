import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

// Add interface for batch type
interface BatchForSession {
    id: string;
    session: {
        session_name: string;
    };
    level: {
        level_name: string;
    };
    package_dto: {
        package_name: string;
    };
}

export const usePackageSessionIds = (sessionName: string, batchNames?: string[]): string[] => {
    const { instituteDetails } = useInstituteDetailsStore();

    if (!instituteDetails?.batches_for_sessions) return [];

    if (!batchNames || batchNames.length === 0) {
        return instituteDetails.batches_for_sessions
            .filter((batch: BatchForSession) => batch.session.session_name === sessionName)
            .map((batch: BatchForSession) => batch.id);
    }

    const matchingBatches = instituteDetails.batches_for_sessions.filter(
        (batch: BatchForSession) => {
            if (batch.session.session_name !== sessionName) return false;
            const batchNameString = `${batch.level.level_name} ${batch.package_dto.package_name}`;
            return batchNames.includes(batchNameString);
        }
    );

    return matchingBatches.map((batch: BatchForSession) => batch.id);
};
