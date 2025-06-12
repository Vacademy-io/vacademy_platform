import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import {
    AITaskIndividualListInterface,
    PlanLectureDataInterface,
} from '@/types/ai/generate-assessment/generate-complete-assessment';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleGetLecturePlan, handleRetryAITask } from '../-services/ai-center-service';

import PlanLecturePreview from '../ai-tools/vsmart-lecture/-components/PlanLecturePreview';
import { Dispatch, SetStateAction, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AxiosError } from 'axios';

const AIPlanLecturePreview = ({
    task,
    openPlanLecturePreview,
    setOpenPlanLecturePreview,
}: {
    task: AITaskIndividualListInterface;
    openPlanLecturePreview: boolean;
    setOpenPlanLecturePreview: Dispatch<SetStateAction<boolean>>;
}) => {
    const [noResponse, setNoResponse] = useState(false);
    const queryClient = useQueryClient();
    const [planLectureData, setPlanLectureData] = useState<PlanLectureDataInterface>({
        heading: '',
        mode: '',
        duration: '',
        language: '',
        level: '',
        timeWiseSplit: [],
        assignment: {
            topicCovered: [],
            tasks: [],
        },
        summary: [],
    });
    const getChatListMutation = useMutation({
        mutationFn: async ({ parentId }: { parentId: string }) => {
            return handleGetLecturePlan(parentId);
        },
        onSuccess: (response) => {
            if (!response) {
                setTimeout(() => {
                    setNoResponse(false);
                }, 10000);
                setNoResponse(true);
                return;
            }
            setNoResponse(false);
            setPlanLectureData(response);
            setOpenPlanLecturePreview(true);
        },
        onError: (error: unknown) => {
            console.log(error);
        },
    });

    const handlViewChatList = (parentId: string) => {
        getChatListMutation.mutate({
            parentId,
        });
    };

    const getRetryMutation = useMutation({
        mutationFn: async ({ taskId }: { taskId: string }) => {
            return handleRetryAITask(taskId);
        },
        onSuccess: (response) => {
            setNoResponse(false);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA'] });
            }, 100);
            if (!response) {
                toast.success('No data exists!');
                return;
            }
            setPlanLectureData(response);
        },
        onError: (error: unknown) => {
            setNoResponse(false);
            if (error instanceof AxiosError) {
                toast.error(error.response?.data.ex, {
                    className: 'error-toast',
                    duration: 2000,
                });
            } else {
                // Handle non-Axios errors if necessary
                console.error('Unexpected error:', error);
            }
        },
    });

    const handleRetryTask = (taskId: string) => {
        getRetryMutation.mutate({
            taskId,
        });
    };
    return (
        <>
            <Dialog open={noResponse} onOpenChange={setNoResponse}>
                <DialogContent className="p-0">
                    <h1 className="rounded-t-lg bg-primary-50 p-2 text-primary-500">
                        Failed to load questions
                    </h1>
                    <h1 className="p-4">
                        Click{' '}
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="!w-0 !min-w-8 border-none !p-0 text-sm !text-blue-600 shadow-none hover:bg-transparent hover:underline focus:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent"
                            onClick={() => handleRetryTask(task.id)}
                        >
                            Here
                        </MyButton>{' '}
                        to retry
                    </h1>
                </DialogContent>
            </Dialog>
            {task.status === 'FAILED' ? (
                <MyButton
                    type="button"
                    scale="small"
                    buttonType="secondary"
                    className="border-none text-sm !text-blue-600 shadow-none hover:bg-transparent focus:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent"
                    onClick={() => handleRetryTask(task.id)}
                >
                    {getRetryMutation.status === 'pending' ? (
                        <DashboardLoader size={18} />
                    ) : (
                        'Retry'
                    )}
                </MyButton>
            ) : (
                <MyButton
                    type="button"
                    scale="small"
                    buttonType="secondary"
                    className="border-none text-sm !text-blue-600 shadow-none hover:bg-transparent focus:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent"
                    onClick={() => handlViewChatList(task.id)}
                >
                    {getChatListMutation.status === 'pending' ? (
                        <DashboardLoader size={18} />
                    ) : (
                        'View'
                    )}
                </MyButton>
            )}

            {getChatListMutation.status === 'success' && (
                <PlanLecturePreview
                    openDialog={openPlanLecturePreview}
                    planLectureData={planLectureData}
                />
            )}
        </>
    );
};

export default AIPlanLecturePreview;
