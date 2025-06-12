import { useEffect, useState } from 'react';
import { ContentType } from '../-types/enroll-request-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { RequestCard } from './requestCard';

interface SelectedSessionsType {
    session_id: string;
    selected_levels: string[];
}

interface BatchOptionItemType {
    package_id: string;
    selected_sessions: SelectedSessionsType[];
}

// The response is an array, not a single object
type BatchOptionsType = BatchOptionItemType[];

export const LearnerRequest = ({ obj }: { obj: ContentType }) => {
    const { getDetailsFromPackageSessionId, getPackageSessionId } = useInstituteDetailsStore();
    const [selectedBatches, setSelectedBatches] = useState<BatchForSessionType[]>([]);

    useEffect(() => {
        try {
            // Reset selected batches to avoid duplications
            setSelectedBatches([]);

            // Parse JSON response - it's an array of batch options
            const batchJsonArray: BatchOptionsType = JSON.parse(
                obj.learner_invitation_response_dto.batch_selection_response_json
            );
            console.log('batchJsonArray: ', batchJsonArray);

            if (!Array.isArray(batchJsonArray)) {
                console.error('Expected array but got:', typeof batchJsonArray);
                return;
            }

            // Process each item in the array
            batchJsonArray.forEach((batchItem) => {
                console.log('Processing batch item with package_id:', batchItem.package_id);

                if (batchItem.selected_sessions && Array.isArray(batchItem.selected_sessions)) {
                    console.log('Selected sessions count:', batchItem.selected_sessions.length);

                    // Process each session in the current batch item
                    batchItem.selected_sessions.forEach((session) => {
                        const sessionId = session.session_id;
                        console.log('Processing session:', sessionId);

                        if (session.selected_levels && Array.isArray(session.selected_levels)) {
                            // Process each level in the current session
                            session.selected_levels.forEach((level) => {
                                console.log('Processing level:', level);

                                const pkgId = getPackageSessionId({
                                    courseId: batchItem.package_id,
                                    sessionId: sessionId,
                                    levelId: level,
                                });

                                if (pkgId) {
                                    const selectedBatch = getDetailsFromPackageSessionId({
                                        packageSessionId: pkgId,
                                    });

                                    console.log('Selected batch:', selectedBatch);

                                    if (selectedBatch) {
                                        setSelectedBatches((prevBatches) => [
                                            ...prevBatches,
                                            selectedBatch,
                                        ]);
                                    }
                                }
                            });
                        } else {
                            console.warn(
                                'No selected levels or not an array:',
                                session.selected_levels
                            );
                        }
                    });
                } else {
                    console.warn(
                        'No selected sessions or not an array:',
                        batchItem.selected_sessions
                    );
                }
            });
        } catch (error) {
            console.error('Error processing batch selection JSON:', error);
        }
    }, [obj, getDetailsFromPackageSessionId, getPackageSessionId]);

    // Handle empty state
    if (selectedBatches.length === 0) {
        return (
            <div className="p-4 text-neutral-600">
                <RequestCard obj={obj} />
            </div>
        );
    }

    // Return the list of request cards
    return (
        <>
            {selectedBatches.map((selectedBatch, index) => (
                <RequestCard key={index} obj={obj} batchDetails={selectedBatch} />
            ))}
        </>
    );
};
