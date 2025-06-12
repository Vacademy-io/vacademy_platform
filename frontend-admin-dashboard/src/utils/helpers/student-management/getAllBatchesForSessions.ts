import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";
import { SessionType } from "@/schemas/student/student-list/institute-schema";
import { useMemo } from "react";

interface BatchObject {
    id: string;
    name: string;
    levelId: string;
    packageId: string;
}

interface SimplifiedBatch {
    id: string;
    name: string;
}

interface BatchIds {
    levelId: string;
    packageId: string;
}

export const useBatchSessionManagementForManualEnroll = () => {
    const getAllBatchesForSessions = () => {
        const instituteDetails = useInstituteDetailsStore.getState().instituteDetails;
        if (!instituteDetails) return [];
        return instituteDetails.batches_for_sessions;
    };

    const createFormattedBatchObjects = (): BatchObject[] => {
        const batches = getAllBatchesForSessions();

        // Create a Map to track unique level-package combinations
        const uniqueCombinations = new Map<string, BatchObject>();

        batches.forEach((batch) => {
            const key = `${batch.level.id}-${batch.package_dto.id}`;
            if (!uniqueCombinations.has(key)) {
                uniqueCombinations.set(key, {
                    id: crypto.randomUUID(),
                    name: `${batch.level.level_name} ${batch.package_dto.package_name}`,
                    levelId: batch.level.id,
                    packageId: batch.package_dto.id,
                });
            }
        });

        return Array.from(uniqueCombinations.values());
    };

    const getSimplifiedBatches = (): SimplifiedBatch[] => {
        const batchObjects = createFormattedBatchObjects();
        return batchObjects.map(({ id, name }) => ({
            id,
            name,
        }));
    };

    const getBatchIds = (batchId: string): BatchIds | null => {
        const batchObjects = createFormattedBatchObjects();
        const batchObject = batchObjects.find((batch) => batch.id === batchId);

        if (!batchObject) return null;

        return {
            levelId: batchObject.levelId,
            packageId: batchObject.packageId,
        };
    };

    const getSessionsForBatch = (levelId: string, packageId: string): SessionType[] => {
        const batches = getAllBatchesForSessions();

        // Filter all batches that match both levelId and packageId
        const matchingBatches = batches.filter(
            (batch) => batch.level.id === levelId && batch.package_dto.id === packageId,
        );

        // Extract and return unique sessions
        const uniqueSessions = new Map<string, SessionType>();
        matchingBatches.forEach((batch) => {
            uniqueSessions.set(batch.session.id, batch.session);
        });

        return Array.from(uniqueSessions.values());
    };

    // Memoize the formatted batch objects
    const memoizedBatchObjects = useMemo(() => createFormattedBatchObjects(), []);

    return {
        getAllBatchesForSessions,
        createFormattedBatchObjects: () => memoizedBatchObjects,
        getSimplifiedBatches,
        getBatchIds,
        getSessionsForBatch,
    };
};
