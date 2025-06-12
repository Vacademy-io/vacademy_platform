import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { handleGetListIndividualTopics } from '../-services/ai-center-service';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Badge } from '@/components/ui/badge';
import AIQuestionsPreview from './AIQuestionsPreview';
import { AITaskIndividualListInterface } from '@/types/ai/generate-assessment/generate-complete-assessment';
import { getTaskTypeFromFeature } from '../-helpers/GetImagesForAITools';
import AIChatWithPDFPreview from './AIChatWithPDFPreview';
import AIPlanLecturePreview from './AIPlanLecturePreview';
import AIEvaluatePreview from './AIEvaluatePreview';
import { ArrowCounterClockwise } from 'phosphor-react';
import { convertToLocalDateTime } from '@/constants/helper';
import { QuestionsFromTextData } from '../ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText';
import { UseFormReturn } from 'react-hook-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';
import { useAIQuestionDialogStore } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/zustand-global-states/ai-add-questions-dialog-zustand';

const AITasksList = ({
    heading,
    enableDialog = false,
    pollGenerateAssessment,
    handleGenerateQuestionsForAssessment,
    pollGenerateQuestionsFromText,
    pollGenerateQuestionsFromAudio,
    sectionsForm,
    currentSectionIndex,
}: {
    heading: string;
    enableDialog?: boolean;
    pollGenerateAssessment?: (prompt?: string, taskId?: string) => void;
    handleGenerateQuestionsForAssessment?: (
        pdfId?: string,
        prompt?: string,
        taskId?: string
    ) => void;
    pollGenerateQuestionsFromText?: (data: QuestionsFromTextData) => void;
    pollGenerateQuestionsFromAudio?: (data: QuestionsFromTextData, taskId: string) => void;
    sectionsForm?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}) => {
    const { isAIQuestionDialog9, setIsAIQuestionDialog9 } = useAIQuestionDialogStore();

    const [openQuestionsPreview, setOpenQuestionsPreview] = useState(false);
    const [allTasks, setAllTasks] = useState<AITaskIndividualListInterface[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const getAITasksIndividualListMutation = useMutation({
        mutationFn: async ({ taskType }: { taskType: string }) => {
            return handleGetListIndividualTopics(taskType);
        },
        onSuccess: (response) => {
            setAllTasks(response);
        },
        onError: (error: unknown) => {
            console.log(error);
        },
    });

    const handleRefreshList = (taskType: string) => {
        getAITasksIndividualListMutation.mutate({
            taskType,
        });
    };

    const { mutate } = getAITasksIndividualListMutation;

    useEffect(() => {
        if (isAIQuestionDialog9 && !openQuestionsPreview) {
            let count = 0;
            const maxRuns = 5;
            const interval = setInterval(() => {
                if (count >= maxRuns) {
                    clearInterval(interval);
                    return;
                }
                mutate({
                    taskType: getTaskTypeFromFeature(heading),
                });
                count++;
            }, 10000);

            return () => clearInterval(interval); // cleanup on unmount
        }
        return () => {};
    }, [mutate, heading, isAIQuestionDialog9, openQuestionsPreview]);

    useEffect(() => {
        const fetchTasks = async () => {
            setIsLoading(true);
            try {
                const taskType = getTaskTypeFromFeature(heading);
                const data = await handleGetListIndividualTopics(taskType);
                setAllTasks(data);
            } catch (error) {
                console.error('Failed to fetch tasks:', error);
                setAllTasks([]); // fallback or keep old state if preferred
            } finally {
                setIsLoading(false);
            }
        };

        fetchTasks();
    }, [heading]);

    useEffect(() => {
        setIsAIQuestionDialog9(enableDialog);
    }, [enableDialog]);

    if (isLoading) return <DashboardLoader />;

    return (
        <Dialog open={isAIQuestionDialog9} onOpenChange={setIsAIQuestionDialog9}>
            <DialogTrigger
                asChild
                onClick={(e) => {
                    e.stopPropagation(); // prevent card click
                }}
            >
                <MyButton
                    type="button"
                    scale="small"
                    buttonType="secondary"
                    className="text-normal border-none !text-blue-600 shadow-none hover:bg-transparent focus:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent"
                >
                    View All Tasks
                </MyButton>
            </DialogTrigger>
            <DialogContent
                onClick={(e) => e.stopPropagation()}
                className="no-scrollbar !m-0 flex size-[90%] flex-col !gap-0 overflow-hidden !p-0"
            >
                {/* Fixed Header */}
                <div className="z-1 sticky top-0 flex items-center justify-start gap-4 rounded-t-lg bg-primary-50 p-4">
                    <h1 className="font-semibold text-primary-500">{heading}</h1>
                    <div
                        className="cursor-pointer rounded-lg border p-2 px-3"
                        onClick={() => handleRefreshList(getTaskTypeFromFeature(heading))}
                    >
                        <ArrowCounterClockwise size={18} className="font-thin text-neutral-600" />
                    </div>
                </div>
                {getAITasksIndividualListMutation.status === 'pending' ? (
                    <DashboardLoader size={24} />
                ) : (
                    <div className="flex flex-col gap-4 overflow-y-auto p-4">
                        {allTasks.length === 0 ? (
                            <div className="flex h-[75vh] items-center justify-center">
                                <p>No task exists</p>
                            </div>
                        ) : (
                            allTasks?.map((task: AITaskIndividualListInterface) => {
                                async function handleDownload(url: string, file_name: string) {
                                    try {
                                        const response = await fetch(url);
                                        const blob = await response.blob();
                                        const downloadUrl = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = downloadUrl;
                                        a.download = file_name;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(downloadUrl);
                                        document.body.removeChild(a);
                                    } catch (error) {
                                        console.error('Download failed:', error);
                                    }
                                }

                                return (
                                    <div
                                        key={task.id}
                                        className="flex flex-col gap-1 rounded-lg border bg-neutral-50 p-4"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h1 className="text-neutral-600">{task.task_name}</h1>
                                            <h1 className="text-sm text-neutral-600">
                                                {convertToLocalDateTime(task.updated_at)}
                                            </h1>
                                        </div>

                                        <div className="flex items-center justify-start">
                                            <Badge
                                                className={`border border-gray-200 text-neutral-600 shadow-none ${
                                                    task.status === 'FAILED'
                                                        ? 'bg-red-100'
                                                        : task.status === 'COMPLETED'
                                                          ? 'bg-green-100'
                                                          : 'bg-blue-100'
                                                }`}
                                            >
                                                {task.status}
                                            </Badge>
                                            {task.status !== 'PROGRESS' &&
                                                heading === 'Vsmart Feedback' && (
                                                    <AIEvaluatePreview
                                                        task={task}
                                                        openEvaluatePreview={openQuestionsPreview}
                                                        setOpenEvaluatePreview={
                                                            setOpenQuestionsPreview
                                                        }
                                                    />
                                                )}

                                            {task.status !== 'PROGRESS' &&
                                                heading === 'Vsmart Lecturer' && (
                                                    <AIPlanLecturePreview
                                                        task={task}
                                                        openPlanLecturePreview={
                                                            openQuestionsPreview
                                                        }
                                                        setOpenPlanLecturePreview={
                                                            setOpenQuestionsPreview
                                                        }
                                                    />
                                                )}

                                            {task.status !== 'PROGRESS' &&
                                                heading === 'Vsmart Chat' && (
                                                    <AIChatWithPDFPreview
                                                        task={task}
                                                        openAIPreview={openQuestionsPreview}
                                                        setOpenAIPreview={setOpenQuestionsPreview}
                                                    />
                                                )}
                                            {heading !== 'Vsmart Lecturer' &&
                                                heading !== 'Vsmart Chat' &&
                                                heading !== 'Vsmart Feedback' &&
                                                (task.status === 'COMPLETED' ||
                                                    task.status === 'FAILED') && (
                                                    <AIQuestionsPreview
                                                        task={task}
                                                        pollGenerateAssessment={
                                                            pollGenerateAssessment
                                                        }
                                                        handleGenerateQuestionsForAssessment={
                                                            handleGenerateQuestionsForAssessment
                                                        }
                                                        pollGenerateQuestionsFromText={
                                                            pollGenerateQuestionsFromText
                                                        }
                                                        pollGenerateQuestionsFromAudio={
                                                            pollGenerateQuestionsFromAudio
                                                        }
                                                        heading={heading}
                                                        openQuestionsPreview={openQuestionsPreview}
                                                        setOpenQuestionsPreview={
                                                            setOpenQuestionsPreview
                                                        }
                                                        sectionsForm={sectionsForm}
                                                        currentSectionIndex={currentSectionIndex}
                                                    />
                                                )}
                                        </div>
                                        {task.file_detail && (
                                            <div className="mt-2 flex items-center justify-between rounded-md bg-neutral-100 p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="max-w-[200px] truncate text-sm text-neutral-600">
                                                        {task.file_detail.file_name}
                                                    </span>
                                                </div>
                                                <MyButton
                                                    type="button"
                                                    scale="small"
                                                    buttonType="secondary"
                                                    className="text-sm"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (task.file_detail) {
                                                            handleDownload(
                                                                task.file_detail.url,
                                                                task.file_detail.file_name
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Download File
                                                </MyButton>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default AITasksList;
