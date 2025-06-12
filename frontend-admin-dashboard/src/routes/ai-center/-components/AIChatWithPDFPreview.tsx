import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import { AITaskIndividualListInterface } from '@/types/ai/generate-assessment/generate-complete-assessment';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dispatch, SetStateAction, useState } from 'react';
import {
    handleGetChatWithPDFInvidualTask,
    handleRetryAITask,
} from '../-services/ai-center-service';
import PlayWithPDF, {
    QuestionWithAnswerChatInterface,
} from '../ai-tools/vsmart-chat/-components/PlayWithPDF';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const AIChatWithPDFPreview = ({
    task,
    openAIPreview,
    setOpenAIPreview,
}: {
    task: AITaskIndividualListInterface;
    openAIPreview: boolean;
    setOpenAIPreview: Dispatch<SetStateAction<boolean>>;
}) => {
    const [noResponse, setNoResponse] = useState(false);
    const queryClient = useQueryClient();
    const [chatResponse, setChatResponse] = useState<QuestionWithAnswerChatInterface[]>([]);

    const getChatListMutation = useMutation({
        mutationFn: async ({ parentId }: { parentId: string }) => {
            return handleGetChatWithPDFInvidualTask(parentId);
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
            setChatResponse(response);
            setOpenAIPreview(true);
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
            setChatResponse(response);
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
                <PlayWithPDF
                    isListMode={openAIPreview}
                    chatResponse={chatResponse}
                    input_id={task.input_id}
                    parent_id={task.parent_id}
                    task_name={task.task_name}
                />
            )}
        </>
    );
};

export default AIChatWithPDFPreview;
