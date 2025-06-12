import { Separator } from '@/components/ui/separator';
import AITasksList from '@/routes/ai-center/-components/AITasksList';
import { AIToolPageData } from '@/routes/ai-center/-constants/AIToolPageData';
import { GetImagesForAITools } from '@/routes/ai-center/-helpers/GetImagesForAITools';
import { StarFour } from 'phosphor-react';
import PlanLectureForm from './PlanLectureForm';
import { useAICenter } from '@/routes/ai-center/-contexts/useAICenterContext';
import { PlanLectureAIFormSchema } from '@/routes/ai-center/-utils/plan-lecture-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleGetPlanLecture } from '@/routes/ai-center/-services/ai-center-service';

const PlanLectureAI = () => {
    const queryClient = useQueryClient();
    const { key: keyContext, loader, setLoader, setKey } = useAICenter();
    const toolData = AIToolPageData['planLecture'];

    const pollGenerateQuestionsFromText = (data: PlanLectureAIFormSchema) => {
        getQuestionsFromTextMutation.mutate({
            taskName: data.taskName,
            prompt: data.prompt,
            level: data.level,
            teachingMethod: data.teachingMethod,
            language: data.language,
            lectureDuration: data.lectureDuration,
            isQuestionGenerated: data.isQuestionGenerated,
            isAssignmentHomeworkGenerated: data.isAssignmentHomeworkGenerated,
        });
    };

    const getQuestionsFromTextMutation = useMutation({
        mutationFn: async (data: PlanLectureAIFormSchema) => {
            setLoader(true);
            setKey('planLecture');
            return handleGetPlanLecture(
                data.taskName,
                data.prompt,
                data.level,
                data.teachingMethod,
                data.language,
                data.lectureDuration,
                data.isQuestionGenerated,
                data.isAssignmentHomeworkGenerated
            );
        },
        onSuccess: () => {
            setLoader(false);
            setKey(null);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA'] });
            }, 100);
        },
        onError: (error: unknown) => {
            console.log(error);
        },
    });

    return (
        <>
            {toolData && (
                <div className="flex w-full flex-col gap-4 px-8 text-neutral-600">
                    <div className="flex w-fit items-center justify-start gap-2">
                        <div className="flex items-center gap-2 text-h2 font-semibold">
                            <StarFour size={30} weight="fill" className="text-primary-500" />{' '}
                            {toolData.heading}
                        </div>
                        <AITasksList heading={toolData.heading} />
                    </div>
                    {GetImagesForAITools(toolData.key)}
                    <div className="flex flex-col gap-1">
                        <p className="text-h3 font-semibold">How to use {toolData.heading}</p>
                        <p className="text-subtitle">{toolData.instructionsHeading}</p>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-6">
                        {toolData.instructions.map((steps, index) => (
                            <div key={index}>
                                <div className="flex gap-2 text-title font-semibold">
                                    <p className="text-primary-500">Step {index + 1}</p>
                                    <p>{steps.stepHeading}</p>
                                </div>
                                <p>{steps.stepSubHeading}</p>
                                <ul className="flex flex-col text-body">
                                    {steps.steps.map((step, index) => (
                                        <li key={index}>
                                            <p>{step}</p>
                                        </li>
                                    ))}
                                </ul>
                                <p>{steps.stepFooter}</p>
                            </div>
                        ))}
                    </div>
                    <div>
                        <PlanLectureForm
                            handleSubmitSuccess={pollGenerateQuestionsFromText}
                            keyContext={keyContext}
                            loader={loader}
                        />
                    </div>
                </div>
            )}
            {getQuestionsFromTextMutation.status === 'success' && (
                <AITasksList heading="Vsmart Lecturer" enableDialog={true} />
            )}
        </>
    );
};

export default PlanLectureAI;
