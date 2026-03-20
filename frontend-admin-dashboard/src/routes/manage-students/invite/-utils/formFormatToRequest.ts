import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import {
    BatchOptionJsonType,
    LearnerChoicePackagesType,
    LearnerChoiceSessionType,
    PreSelectedPackagesType,
    PreSelectedSessionType,
} from '../-types/create-invitation-types';

export function createBatchOptions(
    data: BatchForSessionType[],
    selectionMode: 'institute' | 'student' | 'both',
    maxValue: number,
    getPackageSessionId: (params: {
        courseId: string;
        sessionId: string;
        levelId: string;
    }) => string | null
): BatchOptionJsonType {
    const result: BatchOptionJsonType = {
        institute_assigned: selectionMode === 'institute',
        max_selectable_packages: selectionMode === 'institute' ? 0 : maxValue,
        pre_selected_packages: [],
        learner_choice_packages: [],
    };

    // Group by packages
    const packageMap = new Map<string, BatchForSessionType[]>();

    data.forEach((item) => {
        const packageId = item.package_dto.id;
        if (!packageMap.has(packageId)) {
            packageMap.set(packageId, []);
        }
        packageMap.get(packageId)!.push(item);
    });

    if (selectionMode === 'institute') {
        // Handle institute mode
        for (const [packageId, packageItems] of packageMap.entries()) {
            const packageData = packageItems[0]?.package_dto;
            const packageObj: PreSelectedPackagesType = {
                id: packageData?.id || packageId,
                name: packageData?.package_name || '',
                institute_assigned: true,
                max_selectable_sessions: 0,
                pre_selected_session_dtos: [],
                learner_choice_sessions: [],
            };

            // Group by sessions within this package
            const sessionMap = new Map<string, BatchForSessionType[]>();
            packageItems.forEach((item) => {
                const sessionId = item.session.id;
                if (!sessionMap.has(sessionId)) {
                    sessionMap.set(sessionId, []);
                }
                sessionMap.get(sessionId)!.push(item);
            });

            // Process each session
            for (const [sessionId, sessionItems] of sessionMap.entries()) {
                const sessionData = sessionItems[0]?.session;
                const sessionObj: PreSelectedSessionType = {
                    id: sessionData?.id || sessionId,
                    name: sessionData?.session_name || '',
                    institute_assigned: true,
                    max_selectable_levels: 0,
                    pre_selected_levels: [],
                    learner_choice_levels: [],
                };

                // Process levels within this session
                sessionItems.forEach((item) => {
                    const packageSessionId = getPackageSessionId({
                        courseId: item.package_dto.id,
                        sessionId: item.session.id,
                        levelId: item.level.id,
                    });
                    sessionObj.pre_selected_levels.push({
                        id: item.level.id,
                        name: item.level.level_name,
                        package_session_id: packageSessionId,
                    });
                });

                packageObj.pre_selected_session_dtos.push(sessionObj);
            }

            result.pre_selected_packages.push(packageObj);
        }
    } else {
        // Handle student mode
        for (const [packageId, packageItems] of packageMap.entries()) {
            const packageData = packageItems[0]?.package_dto;
            const packageObj: LearnerChoicePackagesType = {
                id: packageData?.id || packageId,
                name: packageData?.package_name || '',
                max_selectable_sessions: 0,
                learner_choice_sessions: [],
            };

            // Group by sessions within this package
            const sessionMap = new Map<string, BatchForSessionType[]>();
            packageItems.forEach((item) => {
                const sessionId = item.session.id;
                if (!sessionMap.has(sessionId)) {
                    sessionMap.set(sessionId, []);
                }
                sessionMap.get(sessionId)!.push(item);
            });

            // Process each session
            for (const [sessionId, sessionItems] of sessionMap.entries()) {
                const sessionData = sessionItems[0]?.session;
                const sessionObj: LearnerChoiceSessionType = {
                    id: sessionData?.id || sessionId,
                    name: sessionData?.session_name || '',
                    max_selectable_levels: 0,
                    learner_choice_levels: [],
                };

                // Process levels within this session
                sessionItems.forEach((item) => {
                    const packageSessionId = getPackageSessionId({
                        courseId: item.package_dto.id,
                        sessionId: item.session.id,
                        levelId: item.level.id,
                    });
                    sessionObj.learner_choice_levels.push({
                        id: item.level.id,
                        name: item.level.level_name,
                        package_session_id: packageSessionId,
                    });
                });

                packageObj.learner_choice_sessions.push(sessionObj);
            }

            result.learner_choice_packages.push(packageObj);
        }
    }

    return result;
}
