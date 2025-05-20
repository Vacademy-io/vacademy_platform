import { create } from 'zustand';
import {
    InstituteDetailsType,
    LevelType,
    SessionType,
    BatchForSessionType,
} from '@/schemas/student/student-list/institute-schema';

interface InstituteDetailsStore {
    instituteDetails: InstituteDetailsType | null;
    setInstituteDetails: (details: InstituteDetailsType) => void;
    getAllLevels: () => Array<LevelType>;
    getAllSessions: () => Array<SessionType>;
    resetStore: () => void;
    getLevelsFromPackage: (params?: {
        courseId?: string;
        sessionId?: string;
    }) => Array<{ id: string; name: string }>;
    getLevelsFromPackage2: (params?: { courseId?: string; sessionId?: string }) => Array<LevelType>;
    getCourseFromPackage: (params?: {
        levelId?: string;
        sessionId?: string;
    }) => Array<{ id: string; name: string }>;
    getSessionFromPackage: (params?: {
        courseId?: string;
        levelId?: string;
    }) => Array<{ id: string; name: string }>;
    getPackageSessionId: (params: {
        courseId: string;
        sessionId: string;
        levelId: string;
    }) => string | null;
    getPackageWiseLevels: (params?: { sessionId?: string }) => Array<{
        package_dto: {
            id: string;
            package_name: string;
            thumbnail_file_id: string | null;
        };
        level: Array<{
            level_dto: {
                id: string;
                level_name: string;
                duration_in_days: number | null;
                thumbnail_id: string | null;
            };
            package_session_id: string;
            package_session_status: string;
            start_date: string;
        }>;
    }>;
    getDetailsFromPackageSessionId: (params: {
        packageSessionId: string;
    }) => BatchForSessionType | null;
    getSessionNameById: (sessionId: string) => string | null;
}

export const useInstituteDetailsStore = create<InstituteDetailsStore>((set, get) => ({
    instituteDetails: null,
    setInstituteDetails: (details) => set({ instituteDetails: details }),

    getAllLevels: () => {
        const { instituteDetails } = get();
        return instituteDetails?.levels ?? [];
    },

    getAllSessions: () => {
        const { instituteDetails } = get();
        return instituteDetails?.sessions ?? [];
    },

    resetStore: () => set({ instituteDetails: null }),

    getLevelsFromPackage: (params) => {
        const { instituteDetails } = get();
        if (!instituteDetails) return [];

        const levels = instituteDetails.batches_for_sessions
            .filter((batch) => {
                if (params?.courseId && params?.sessionId) {
                    return (
                        batch.package_dto.id === params.courseId &&
                        batch.session.id === params.sessionId
                    );
                }
                if (params?.courseId) {
                    return batch.package_dto.id === params.courseId;
                }
                if (params?.sessionId) {
                    return batch.session.id === params.sessionId;
                }
                return true;
            })
            .map((batch) => ({
                id: batch.level.id,
                name: batch.level.level_name,
            }));

        // Create a map to track unique items by ID
        const uniqueMap = new Map();

        // Add each item to the map, using id as the key
        levels.forEach((item) => {
            uniqueMap.set(item.id, item);
        });

        // Convert the map values back to an array
        return Array.from(uniqueMap.values());
    },

    getLevelsFromPackage2: (params) => {
        const { instituteDetails } = get();
        if (!instituteDetails) return [];

        const levels = instituteDetails.batches_for_sessions
            .filter((batch) => {
                if (params?.courseId && params?.sessionId) {
                    return (
                        batch.package_dto.id === params.courseId &&
                        batch.session.id === params.sessionId
                    );
                }
                if (params?.courseId) {
                    return batch.package_dto.id === params.courseId;
                }
                if (params?.sessionId) {
                    return batch.session.id === params.sessionId;
                }
                return true;
            })
            .map((batch) => batch.level);

        // Create a map to track unique items by ID
        const uniqueMap = new Map();

        // Add each item to the map, using id as the key
        levels.forEach((item) => {
            uniqueMap.set(item.id, item);
        });

        // Convert the map values back to an array
        return Array.from(uniqueMap.values());
    },

    getCourseFromPackage: (params) => {
        const { instituteDetails } = get();
        if (!instituteDetails) return [];

        const courses = instituteDetails.batches_for_sessions
            .filter((batch) => {
                if (params?.levelId && params?.sessionId) {
                    return (
                        batch.level.id === params.levelId && batch.session.id === params.sessionId
                    );
                }
                if (params?.levelId) {
                    return batch.level.id === params.levelId;
                }
                if (params?.sessionId) {
                    return batch.session.id === params.sessionId;
                }
                return true;
            })
            .map((batch) => ({
                id: batch.package_dto.id,
                name: batch.package_dto.package_name,
            }));

        // Create a map to track unique items by ID
        const uniqueMap = new Map();

        // Add each item to the map, using id as the key
        courses.forEach((item) => {
            uniqueMap.set(item.id, item);
        });

        // Convert the map values back to an array
        return Array.from(uniqueMap.values());
    },

    getSessionFromPackage: (params) => {
        const { instituteDetails } = get();
        if (!instituteDetails) return [];

        const sessions = instituteDetails.batches_for_sessions
            .filter((batch) => {
                if (params?.courseId && params?.levelId) {
                    return (
                        batch.package_dto.id === params.courseId &&
                        batch.level.id === params.levelId
                    );
                }
                if (params?.courseId) {
                    return batch.package_dto.id === params.courseId;
                }
                if (params?.levelId) {
                    return batch.level.id === params.levelId;
                }
                return true;
            })
            .map((batch) => ({
                id: batch.session.id,
                name: batch.session.session_name,
            }));

        // Create a map to track unique items by ID
        const uniqueMap = new Map();

        // Add each item to the map, using id as the key
        sessions.forEach((item) => {
            uniqueMap.set(item.id, item);
        });

        // Convert the map values back to an array
        return Array.from(uniqueMap.values());
    },

    getPackageSessionId: (params) => {
        const { instituteDetails } = get();
        if (!instituteDetails) return null;

        const matchingBatch = instituteDetails.batches_for_sessions.find(
            (batch) =>
                batch.package_dto.id === params.courseId &&
                batch.level.id === params.levelId &&
                batch.session.id === params.sessionId
        );

        return matchingBatch?.id || null;
    },

    getPackageWiseLevels: (params?: { sessionId?: string }) => {
        const { instituteDetails } = get();
        if (!instituteDetails) return [];

        // Filter batches based on optional parameters
        const filteredBatches = instituteDetails.batches_for_sessions.filter((batch) => {
            if (params?.sessionId) {
                return batch.session.id === params.sessionId;
            }
            return true;
        });

        // Define the result type to match our interface
        type PackageGroupType = {
            package_dto: {
                id: string;
                package_name: string;
                thumbnail_file_id: string | null;
            };
            level: Array<{
                level_dto: {
                    id: string;
                    level_name: string;
                    duration_in_days: number | null;
                    thumbnail_id: string | null;
                };
                package_session_id: string;
                package_session_status: string;
                start_date: string;
            }>;
        };

        // Group batches by package_dto.id
        const packageGroups: Record<string, PackageGroupType> = {};

        // Process each batch and build the structure
        filteredBatches.forEach((batch) => {
            const packageId = batch.package_dto.id;

            // Initialize the package group if it doesn't exist
            if (!packageGroups[packageId]) {
                packageGroups[packageId] = {
                    package_dto: {
                        id: batch.package_dto.id,
                        package_name: batch.package_dto.package_name,
                        thumbnail_file_id: batch.package_dto.thumbnail_id || '',
                    },
                    level: [],
                };
            }

            // Use a non-null assertion to tell TypeScript that we know packageGroups[packageId] exists
            const packageGroup = packageGroups[packageId]!;

            // Create level object with the required format
            const levelEntry = {
                level_dto: {
                    id: batch.level.id,
                    level_name: batch.level.level_name,
                    duration_in_days: batch.level.duration_in_days,
                    thumbnail_id: batch.level.thumbnail_id,
                },
                package_session_id: batch.id,
                package_session_status: batch.status,
                start_date: batch.session.start_date,
            };

            // Only add the level if it's not already in the array
            const levelExists = packageGroup.level.some(
                (item) => item.level_dto.id === batch.level.id
            );

            if (!levelExists) {
                packageGroup.level.push(levelEntry);
            }
        });

        return Object.values(packageGroups);
    },

    getDetailsFromPackageSessionId: (params: { packageSessionId: string }) => {
        const { instituteDetails } = get();

        const matchingBatch = instituteDetails?.batches_for_sessions.find(
            (batch) => batch.id === params.packageSessionId
        );

        return matchingBatch || null;
    },

    getSessionNameById: (sessionId: string) => {
        const { instituteDetails } = get();
        if (!instituteDetails) return null;

        const session = instituteDetails.sessions.find((session) => session.id === sessionId);
        return session?.session_name || null;
    },
}));
