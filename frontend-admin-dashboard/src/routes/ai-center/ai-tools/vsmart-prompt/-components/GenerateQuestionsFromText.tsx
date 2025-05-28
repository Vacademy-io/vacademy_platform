import { MyButton } from '@/components/design-system/button';
import { StarFour } from 'phosphor-react';
import { QuestionsFromTextDialog } from './QuestionsFromTextDialog';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleGetQuestionsFromText } from '../../../-services/ai-center-service';
import { useForm, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useAICenter } from '../../../-contexts/useAICenterContext';
import { GetImagesForAITools } from '@/routes/ai-center/-helpers/GetImagesForAITools';
import { AIToolPageData } from '@/routes/ai-center/-constants/AIToolPageData';
import { Separator } from '@/components/ui/separator';
import AITasksList from '@/routes/ai-center/-components/AITasksList';
import { languageSupport } from '@/constants/dummy-data';
import { SectionFormType } from '@/types/assessments/assessment-steps';

const formSchema = z.object({
    taskName: z.string().min(1),
    text: z.string().min(1),
    num: z.number().min(1),
    class_level: z.string().min(1),
    topics: z.string().min(1),
    question_type: z.string().min(1),
    question_language: z.string().min(1),
});

export type QuestionsFromTextData = z.infer<typeof formSchema>;

export const GenerateQuestionsFromText = ({
    form,
    currentSectionIndex,
}: {
    form?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}) => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [disableSubmitBtn, setDisableSubmitBtn] = useState(false);
    console.log(disableSubmitBtn);
    const formSubmitRef = useRef(() => {});
    const dialogForm = useForm<QuestionsFromTextData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            taskName: '',
            text: '',
            num: undefined,
            class_level: '',
            topics: '',
            question_type: '',
            question_language: languageSupport[0],
        },
    });
    const { key: keyContext, loader, setLoader, setKey } = useAICenter();

    const handleDisableSubmitBtn = (value: boolean) => {
        setDisableSubmitBtn(value);
    };
    const handleUploadClick = () => {
        setOpen(true);
    };
    const handleOpenChange = (open: boolean) => {
        setOpen(open);
    };

    const getQuestionsFromTextMutation = useMutation({
        mutationFn: async ({
            data,
            taskId,
        }: {
            data: {
                taskName: string;
                text: string;
                num: number;
                class_level: string;
                topics: string;
                question_type: string;
                question_language: string;
            };
            taskId: string;
        }) => {
            setLoader(true);
            setKey('text');
            return handleGetQuestionsFromText(
                data.taskName,
                data.text,
                data.num,
                data.class_level,
                data.topics,
                data.question_type,
                data.question_language,
                taskId
            );
        },
        onSuccess: () => {
            setLoader(false);
            setKey(null);
            dialogForm.reset();
            handleOpenChange(false);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA'] });
            }, 100);
        },
        onError: (error: unknown) => {
            console.log(error);
        },
    });

    const pollGenerateQuestionsFromText = (data: QuestionsFromTextData) => {
        const taskId = ''; // Generate a unique taskId if needed
        getQuestionsFromTextMutation.mutate({
            data: {
                taskName: data.taskName,
                text: data.text,
                num: data.num,
                class_level: data.class_level,
                topics: data.topics,
                question_type: data.question_type,
                question_language: data.question_language,
            },
            taskId: taskId,
        });
        dialogForm.reset();
    };
    const submitButton = (
        <div className="flex w-full items-center justify-center">
            {loader ? (
                <MyButton>
                    <DashboardLoader height="60px" size={20} color="#ffffff" />
                </MyButton>
            ) : (
                <MyButton onClick={() => formSubmitRef.current()}>Generate Questions</MyButton>
            )}
        </div>
    );

    const submitFormFn = (submitFn: () => void) => {
        formSubmitRef.current = submitFn;
    };

    const toolData = AIToolPageData['text'];
    return (
        <>
            {toolData && (
                <div className="flex w-full flex-col gap-4 px-8 text-neutral-600">
                    <div className="flex w-fit items-center justify-start gap-2">
                        <div className="flex items-center gap-2 text-h2 font-semibold">
                            <StarFour size={30} weight="fill" className="text-primary-500" />{' '}
                            {toolData.heading}
                        </div>
                        <AITasksList
                            heading={toolData.heading}
                            pollGenerateQuestionsFromText={pollGenerateQuestionsFromText}
                            sectionsForm={form}
                            currentSectionIndex={currentSectionIndex}
                        />
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
                        {loader && keyContext == 'text' ? (
                            <MyButton
                                type="button"
                                scale="medium"
                                buttonType="primary"
                                layoutVariant="default"
                                className="w-full text-sm"
                            >
                                <DashboardLoader size={20} color="#ffffff" />
                            </MyButton>
                        ) : (
                            <MyButton
                                type="button"
                                scale="medium"
                                buttonType="primary"
                                layoutVariant="default"
                                className="text-sm"
                                onClick={handleUploadClick}
                                disable={loader && keyContext != 'text' && keyContext != ''}
                            >
                                Generate
                            </MyButton>
                        )}
                    </div>
                </div>
            )}
            <QuestionsFromTextDialog
                open={open}
                onOpenChange={handleOpenChange}
                onSubmitSuccess={pollGenerateQuestionsFromText}
                submitButton={submitButton}
                handleDisableSubmitBtn={handleDisableSubmitBtn}
                submitForm={submitFormFn}
                form={dialogForm}
                taskId=""
            />
            {getQuestionsFromTextMutation.status === 'success' && (
                <AITasksList
                    heading="Vsmart Topics"
                    enableDialog={true}
                    sectionsForm={form}
                    currentSectionIndex={currentSectionIndex}
                />
            )}
        </>
    );
};
