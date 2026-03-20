import { useAddSession } from '@/services/study-library/session-management/addSession';
import { AddSessionDialog } from './session-operations/add-session/add-session-dialog';
import { AddSessionDataType } from './session-operations/add-session/add-session-form';
import { toast } from 'sonner';
import { useRef, useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { Plus } from '@phosphor-icons/react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { NoCourseDialog } from '@/components/common/students/no-course-dialog';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export default function SessionHeader() {
    const [disableAddButton, setDisableAddButton] = useState(true);
    const { instituteDetails } = useInstituteDetailsStore();
    const addSessionMutation = useAddSession();
    const [isAddSessionDiaogOpen, setIsAddSessionDiaogOpen] = useState(false);
    const handleOpenAddSessionDialog = () => {
        setIsAddSessionDiaogOpen(!isAddSessionDiaogOpen);
    };
    const [isOpen, setIsOpen] = useState(false);
    const handleAddSession = (sessionData: AddSessionDataType) => {
        const processedData = structuredClone(sessionData);

        const transformedData = {
            ...processedData,
            levels: processedData.levels.map((level) => ({
                id: level.level_dto.id,
                new_level: level.level_dto.new_level === true,
                level_name: level.level_dto.level_name,
                duration_in_days: level.level_dto.duration_in_days,
                thumbnail_file_id: level.level_dto.thumbnail_file_id,
                package_id: level.level_dto.package_id,
            })),
        };

        // Use type assertion since we know this is the correct format for the API
        addSessionMutation.mutate(
            { requestData: transformedData as unknown as AddSessionDataType },
            {
                onSuccess: () => {
                    toast.success(
                        ` ${getTerminology(
                            ContentTerms.Session,
                            SystemTerms.Session
                        )} added successfully`
                    );
                    setIsAddSessionDiaogOpen(false);
                },
                onError: (error) => {
                    toast.error(
                        error.message ||
                        `Failed to add ${getTerminology(
                            ContentTerms.Session,
                            SystemTerms.Session
                        ).toLocaleLowerCase()}`
                    );
                },
            }
        );
    };

    const formSubmitRef = useRef(() => { });

    const submitButton = (
        <div className="flex items-center justify-end">
            <MyButton
                type="submit"
                buttonType="primary"
                layoutVariant="default"
                scale="large"
                className="w-[140px]"
                disable={disableAddButton}
                onClick={() => formSubmitRef.current()}
            >
                Add
            </MyButton>
        </div>
    );

    const submitFn = (fn: () => void) => {
        formSubmitRef.current = fn;
    };

    return (
        <div className="flex flex-col gap-4 text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
                <div className="text-lg font-[600] sm:text-xl">
                    Manage Your {getTerminology(ContentTerms.Session, SystemTerms.Session)}
                </div>
                <div className="text-sm sm:text-base">
                    Effortlessly organize, upload, and track educational resources in one place.
                    Provide{' '}
                    {getTerminology(RoleTerms.Learner, SystemTerms.Learner).toLocaleLowerCase()}s
                    with easy access to the materials they need to succeed, ensuring a seamless
                    learning experience.
                </div>
            </div>
            <div className="self-end sm:self-auto">
                {!instituteDetails?.batches_for_sessions.length ? (
                    <div className="flex flex-col items-center gap-1">
                        <NoCourseDialog
                            isOpen={isOpen}
                            setIsOpen={setIsOpen}
                            type="Adding Sessions"
                            content="You need to create a course before"
                            trigger={
                                <MyButton>
                                    <Plus /> Add New{' '}
                                    {getTerminology(ContentTerms.Session, SystemTerms.Session)}
                                </MyButton>
                            }
                        />
                    </div>
                ) : (
                    <AddSessionDialog
                        isAddSessionDiaogOpen={isAddSessionDiaogOpen}
                        handleOpenAddSessionDialog={handleOpenAddSessionDialog}
                        handleSubmit={handleAddSession}
                        trigger={
                            <div className="flex flex-col items-center gap-1">
                                <MyButton disable={!instituteDetails?.batches_for_sessions.length}>
                                    <Plus /> Add New{' '}
                                    {getTerminology(ContentTerms.Session, SystemTerms.Session)}
                                </MyButton>
                            </div>
                        }
                        submitButton={submitButton}
                        setDisableAddButton={setDisableAddButton}
                        submitFn={submitFn}
                    />
                )}
            </div>
        </div>
    );
}
