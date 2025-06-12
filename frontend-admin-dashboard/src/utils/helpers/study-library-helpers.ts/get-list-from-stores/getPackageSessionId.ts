import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";

export const useGetPackageSessionId = (
    packageId: string,
    sessionId: string,
    levelId: string,
): string | undefined => {
    const { instituteDetails } = useInstituteDetailsStore();

    if (!instituteDetails) return undefined;

    const matchingBatch = instituteDetails.batches_for_sessions.find(
        (batch) =>
            batch.package_dto.id === packageId &&
            batch.session.id === sessionId &&
            batch.level.id === levelId,
    );

    return matchingBatch?.id ?? undefined;
};
