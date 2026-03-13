import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
    AIAssessmentResponseInterface,
    AITaskIndividualListInterface,
} from '@/types/ai/generate-assessment/generate-complete-assessment';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleGetQuestionsInvidualTask, handleRetryAITask } from '../-services/ai-center-service';
import { Dispatch, SetStateAction, useState, useRef, useEffect } from 'react';
import { FormProvider, useFieldArray, useForm, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { generateCompleteAssessmentFormSchema } from '../-utils/generate-complete-assessment-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { transformQuestionsToGenerateAssessmentAI } from '../-utils/helper';
import useInstituteLogoStore from '@/components/common/layout-container/sidebar/institutelogo-global-zustand';
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import {
    getPPTViewTitle,
    transformResponseDataToMyQuestionsSchema,
} from '@/routes/assessment/question-papers/-utils/helper';
import { QuestionType } from '@/constants/dummy-data';
import { DotsSixVertical } from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsThreeVertical, Copy, Trash } from '@phosphor-icons/react';
import { PPTComponentFactory } from '@/routes/assessment/question-papers/-components/QuestionPaperTemplatesTypes/PPTComponentFactory';

import { MainViewComponentFactory } from '@/routes/assessment/question-papers/-components/QuestionPaperTemplatesTypes/MainViewComponentFactory';
import ExportQuestionPaperAI from './export-ai-question-paper/ExportQuestionPaperAI';
import { toast } from 'sonner';
import type { QuestionsFromTextData } from '../ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText';
import { Badge } from '@/components/ui/badge';
import { AxiosError } from 'axios';
import { MyQuestion, MyQuestionPaperFormInterface } from '@/types/assessments/question-paper-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';
import { addQuestionPaper } from '@/routes/assessment/question-papers/-utils/question-paper-services';
import { getQuestionPaperById } from '@/routes/community/question-paper/-service/utils';
import { useAIQuestionDialogStore } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/zustand-global-states/ai-add-questions-dialog-zustand';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AIQuestionsPreviewProps {
    task: AITaskIndividualListInterface;
    pollGenerateAssessment?: (prompt?: string, taskId?: string) => void;
    handleGenerateQuestionsForAssessment?: (pdfId?: string, prompt?: string) => void;
    pollGenerateQuestionsFromText?: (data: QuestionsFromTextData) => void;
    pollGenerateQuestionsFromAudio?: (data: QuestionsFromTextData, taskId: string) => void;
    heading?: string;
    openQuestionsPreview: boolean;
    setOpenQuestionsPreview: Dispatch<SetStateAction<boolean>>;
    sectionsForm?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}

const AIQuestionsPreview = ({
    task,
    openQuestionsPreview,
    setOpenQuestionsPreview,
    sectionsForm,
    currentSectionIndex,
}: AIQuestionsPreviewProps) => {
    const {
        setIsAIQuestionDialog1,
        setIsAIQuestionDialog2,
        setIsAIQuestionDialog3,
        setIsAIQuestionDialog4,
        setIsAIQuestionDialog5,
        setIsAIQuestionDialog6,
        setIsAIQuestionDialog7,
        setIsAIQuestionDialog8,
        setIsAIQuestionDialog9,
    } = useAIQuestionDialogStore();
    const queryClient = useQueryClient();
    const { instituteLogo } = useInstituteLogoStore();
    const [assessmentData, setAssessmentData] = useState<AIAssessmentResponseInterface>({
        title: '',
        tags: [],
        difficulty: '',
        description: '',
        subjects: [],
        classes: [],
        questions: [],
    });
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const form = useForm<z.infer<typeof generateCompleteAssessmentFormSchema>>({
        resolver: zodResolver(generateCompleteAssessmentFormSchema),
        mode: 'onChange',
        defaultValues: {
            questionPaperId: '1',
            isFavourite: false,
            title: '',
            createdOn: new Date(),
            yearClass: '',
            subject: '',
            questionsType: '',
            optionsType: '',
            answersType: '',
            explanationsType: '',
            fileUpload: undefined,
            classess: [],
            subjects: [],
            tags: [],
            questions: [],
        },
    });

    const { getValues } = form;

    // UseFieldArray to manage questions array
    const { fields, move, insert, remove } = useFieldArray({
        control: form.control,
        name: 'questions', // Name of the field array
    });

    const questions = form.getValues('questions');

    const contentRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<string | number>('auto');

    useEffect(() => {
        const updateHeight = () => {
            if (contentRef.current) {
                // Calculate scaled height: content scrollHeight * scale factor (0.28)
                // Add a small buffer to prevent cut-off
                const scaled = contentRef.current.scrollHeight * 0.28 + 10;
                setContainerHeight(scaled);
            }
        };

        // Initial calculation with delay to allow DOM to render
        const timeoutId = setTimeout(updateHeight, 100);

        // Use ResizeObserver to track content size changes
        const resizeObserver = new ResizeObserver(() => {
            updateHeight();
        });

        if (contentRef.current) {
            resizeObserver.observe(contentRef.current);
        }

        return () => {
            clearTimeout(timeoutId);
            resizeObserver.disconnect();
        };
    }, [fields]);

    const [noResponse, setNoResponse] = useState(false);
    const getQuestionsListMutation = useMutation({
        mutationFn: async ({ taskId }: { taskId: string }) => {
            return handleGetQuestionsInvidualTask(taskId);
        },
        onSuccess: (response) => {
            if (!response.questions) {
                setTimeout(() => {
                    setNoResponse(false);
                }, 10000);
                setNoResponse(true);
                return;
            }
            setNoResponse(false);
            setAssessmentData(response);
            const transformQuestionsData = transformQuestionsToGenerateAssessmentAI(
                response.questions
            );
            form.reset({
                ...form.getValues(),
                title: response?.title,
                classess: response?.classes,
                subjects: response?.subjects,
                tags: response?.tags,
                questions: transformQuestionsData,
            });
            form.trigger();
        },
        onError: (error: unknown) => {
            console.log(error);
        },
    });

    const handlViewQuestionsList = (taskId: string) => {
        getQuestionsListMutation.mutate({
            taskId,
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
            if (!response.questions) {
                toast.success('No data exists!');
                return;
            }
            setAssessmentData(response);
            const transformQuestionsData = transformQuestionsToGenerateAssessmentAI(
                response.questions
            );
            form.reset({
                ...form.getValues(),
                title: response?.title,
                classess: response?.classes,
                subjects: response?.subjects,
                tags: response?.tags,
                questions: transformQuestionsData,
            });
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

    const handleSubmitFormData = useMutation({
        mutationFn: ({ data }: { data: MyQuestionPaperFormInterface }) =>
            addQuestionPaper(data, true),
        onSuccess: async (data) => {
            const getQuestionPaper = await getQuestionPaperById(data.saved_question_paper_id);
            const transformQuestionsData: MyQuestion[] = transformResponseDataToMyQuestionsSchema(
                getQuestionPaper.question_dtolist
            );
            if (currentSectionIndex !== undefined) {
                // Check if index is defined

                sectionsForm?.setValue(
                    `section.${currentSectionIndex}.adaptive_marking_for_each_question`,
                    transformQuestionsData.map((question) => ({
                        // Spread full question data (options, validAnswers, etc.) so that
                        // quiz context can read them via getValues. The Zod schema strips
                        // unknown fields on validation, so the assessment flow is unaffected.
                        ...question,
                        questionId: question.questionId,
                        questionName: question.questionName,
                        questionType: question.questionType,
                        questionMark: question.questionMark,
                        questionPenalty: question.questionPenalty,
                        ...(question.questionType === 'MCQM' && {
                            correctOptionIdsCnt: question?.multipleChoiceOptions?.filter(
                                (item) => item.isSelected
                            ).length,
                        }),
                        questionDuration: {
                            hrs: question.questionDuration.hrs,
                            min: question.questionDuration.min,
                        },
                        parentRichText: question.parentRichTextContent,
                    }))
                );
                sectionsForm?.trigger(
                    `section.${currentSectionIndex}.adaptive_marking_for_each_question`
                );
                setIsAIQuestionDialog1(false);
                setIsAIQuestionDialog2(false);
                setIsAIQuestionDialog3(false);
                setIsAIQuestionDialog4(false);
                setIsAIQuestionDialog5(false);
                setIsAIQuestionDialog6(false);
                setIsAIQuestionDialog7(false);
                setIsAIQuestionDialog8(false);
                setIsAIQuestionDialog9(false);
                setOpenQuestionsPreview(false);
            }
            queryClient.invalidateQueries({ queryKey: ['GET_QUESTION_PAPER_FILTERED_DATA'] });
        },
        onError: (error: unknown) => {
            toast.error(error as string);
        },
    });

    const handleSaveQuestionsInSection = () => {
        if (Object.values(form.formState.errors).length > 0) {
            toast.error('some of your questions are incomplete or needs attentions!', {
                className: 'error-toast',
                duration: 3000,
            });
            return;
        }
        handleSubmitFormData.mutate({
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            data: form.getValues(),
        });
    };

    return (
        <>
            <Dialog open={noResponse} onOpenChange={setNoResponse}>
                <DialogContent className="overflow-hidden rounded-lg p-0">
                    <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 p-4 text-destructive">
                        <span className="font-semibold">Failed to load questions</span>
                    </div>
                    <div className="flex flex-col gap-4 p-6">
                        <p className="text-sm text-muted-foreground">
                            We couldn't generate the questions for you. Please try again.
                        </p>
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="!text-primary w-fit text-sm font-semibold hover:underline"
                            onClick={() => handleRetryTask(task.id)}
                        >
                            Retry Now
                        </MyButton>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={openQuestionsPreview} onOpenChange={setOpenQuestionsPreview}>
                <DialogTrigger asChild>
                    {task.status === 'FAILED' ? (
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="border-none text-sm !text-destructive shadow-none hover:bg-destructive/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRetryTask(task.id);
                            }}
                        >
                            {getRetryMutation.status === 'pending' ? (
                                <>
                                    <div className="mr-2 size-3 animate-spin rounded-full border-2 border-destructive border-t-transparent"></div>
                                    <span>Retrying...</span>
                                </>
                            ) : (
                                'Retry'
                            )}
                        </MyButton>
                    ) : (
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="!text-primary hover:bg-primary/10 border-none text-sm shadow-none"
                            onClick={() => handlViewQuestionsList(task.id)}
                        >
                            {getQuestionsListMutation.status === 'pending' ? (
                                <>
                                    <div className="border-primary mr-2 size-3 animate-spin rounded-full border-2 border-t-transparent"></div>
                                    <span>Loading...</span>
                                </>
                            ) : (
                                'View'
                            )}
                        </MyButton>
                    )}
                </DialogTrigger>
                {form.getValues('questions') && form.getValues('questions').length > 0 && (
                    <DialogContent className="no-scrollbar !m-0 flex h-full !w-screen !max-w-none flex-col !gap-0 overflow-hidden !rounded-none bg-background !p-0 text-foreground [&>button]:hidden">
                        <FormProvider {...form}>
                            <form className="flex h-full flex-col">
                                {/* Header */}
                                <div className="z-10 flex h-16 w-full shrink-0 items-center justify-between border-b bg-background px-6 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={instituteLogo}
                                                alt="logo"
                                                className="size-9 rounded-full border bg-muted object-contain"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold leading-tight text-foreground/90">
                                                    {form.getValues('title')}
                                                </span>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                                    {form
                                                        .getValues('tags')
                                                        ?.slice(0, 3)
                                                        .map((tag, idx) => (
                                                            <Badge
                                                                variant="secondary"
                                                                key={idx}
                                                                className="border-transparent bg-muted/50 px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                                                            >
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    {form.getValues('tags') &&
                                                        form.getValues('tags')!.length > 3 && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="cursor-help border-transparent bg-muted/50 px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                                                                        >
                                                                            +
                                                                            {form.getValues('tags')!
                                                                                .length - 3}
                                                                        </Badge>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <div className="flex flex-col gap-1">
                                                                            {form
                                                                                .getValues('tags')
                                                                                ?.slice(3)
                                                                                .map((tag, idx) => (
                                                                                    <span
                                                                                        key={idx}
                                                                                        className="text-xs"
                                                                                    >
                                                                                        {tag}
                                                                                    </span>
                                                                                ))}
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {currentSectionIndex !== undefined &&
                                            (handleSubmitFormData.status === 'pending' ? (
                                                <MyButton type="button" disable scale="small">
                                                    <div className="mr-2 size-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                                    <span>Saving...</span>
                                                </MyButton>
                                            ) : (
                                                <MyButton
                                                    onClick={handleSaveQuestionsInSection}
                                                    type="button"
                                                    scale="small"
                                                >
                                                    Save Changes
                                                </MyButton>
                                            ))}
                                        <ExportQuestionPaperAI
                                            responseQuestionsData={assessmentData?.questions}
                                        />
                                        <div className="mx-1 h-5 w-px bg-border" />
                                        <MyButton
                                            type="button"
                                            scale="small"
                                            buttonType="secondary"
                                            className="text-muted-foreground hover:text-foreground md:min-w-[80px]"
                                            onClick={() => {
                                                setOpenQuestionsPreview(false);
                                            }}
                                        >
                                            Close
                                        </MyButton>
                                    </div>
                                </div>

                                {/* Content Body */}
                                <div className="flex flex-1 overflow-hidden">
                                    {/* Sidebar / Slides Strip */}
                                    <div className="flex w-56 flex-col border-r bg-muted/5">
                                        <div className="scrollbar-thin scrollbar-thumb-muted-foreground/20 flex-1 overflow-y-auto overflow-x-hidden p-4">
                                            <Sortable
                                                value={fields}
                                                onMove={({ activeIndex, overIndex }) =>
                                                    move(activeIndex, overIndex)
                                                }
                                            >
                                                <div
                                                    style={{
                                                        height: containerHeight,
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <div
                                                        ref={contentRef}
                                                        className="flex w-[350%] origin-top-left scale-[0.28] flex-col gap-6 pb-20"
                                                    >
                                                        {fields.map((field, index) => {
                                                            const hasError =
                                                                form.formState.errors?.questions?.[
                                                                    index
                                                                ];
                                                            const isSelected =
                                                                currentQuestionIndex === index;

                                                            return (
                                                                <SortableItem
                                                                    key={field.id}
                                                                    value={field.id}
                                                                    asChild
                                                                >
                                                                    <div
                                                                        key={index}
                                                                        onClick={() =>
                                                                            setCurrentQuestionIndex(
                                                                                index
                                                                            )
                                                                        }
                                                                        className={`group relative rounded-3xl border-4 p-6 transition-all duration-200
                                                                            ${
                                                                                isSelected
                                                                                    ? 'border-blue-600 bg-white ring-8 ring-blue-50'
                                                                                    : 'border-transparent bg-white shadow-sm hover:shadow-md'
                                                                            }`}
                                                                    >
                                                                        <div className="flex flex-col gap-4">
                                                                            <div className="flex items-center justify-between gap-4">
                                                                                <div className="flex items-center gap-4">
                                                                                    <span
                                                                                        className={`text-5xl font-bold ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}
                                                                                    >
                                                                                        {index + 1}
                                                                                    </span>
                                                                                    <span className="max-w-[400px] truncate text-3xl font-medium text-gray-500">
                                                                                        {getPPTViewTitle(
                                                                                            getValues(
                                                                                                `questions.${index}.questionType`
                                                                                            ) as QuestionType
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <DropdownMenu>
                                                                                        <DropdownMenuTrigger
                                                                                            asChild
                                                                                        >
                                                                                            <MyButton
                                                                                                type="button"
                                                                                                scale="large"
                                                                                                buttonType="secondary"
                                                                                                className="size-16 p-0 text-muted-foreground hover:text-foreground"
                                                                                                onClick={(
                                                                                                    e
                                                                                                ) =>
                                                                                                    e.stopPropagation()
                                                                                                }
                                                                                            >
                                                                                                <DotsThreeVertical className="!size-10" />
                                                                                            </MyButton>
                                                                                        </DropdownMenuTrigger>
                                                                                        <DropdownMenuContent
                                                                                            align="end"
                                                                                            className="w-56"
                                                                                        >
                                                                                            <DropdownMenuItem
                                                                                                className="py-3 text-lg"
                                                                                                onClick={(
                                                                                                    e
                                                                                                ) => {
                                                                                                    e.stopPropagation();
                                                                                                    insert(
                                                                                                        index +
                                                                                                            1,
                                                                                                        getValues(
                                                                                                            `questions.${index}`
                                                                                                        )
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                <Copy className="mr-3 size-5" />
                                                                                                Duplicate
                                                                                            </DropdownMenuItem>
                                                                                            <DropdownMenuItem
                                                                                                className="py-3 text-lg text-destructive focus:text-destructive"
                                                                                                onClick={(
                                                                                                    e
                                                                                                ) => {
                                                                                                    e.stopPropagation();
                                                                                                    remove(
                                                                                                        index
                                                                                                    );
                                                                                                    if (
                                                                                                        currentQuestionIndex >=
                                                                                                            index &&
                                                                                                        currentQuestionIndex >
                                                                                                            0
                                                                                                    ) {
                                                                                                        setCurrentQuestionIndex(
                                                                                                            currentQuestionIndex -
                                                                                                                1
                                                                                                        );
                                                                                                    }
                                                                                                }}
                                                                                            >
                                                                                                <Trash className="mr-3 size-5" />
                                                                                                Delete
                                                                                            </DropdownMenuItem>
                                                                                        </DropdownMenuContent>
                                                                                    </DropdownMenu>
                                                                                    <SortableDragHandle
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="size-16 cursor-grab opacity-50 hover:opacity-100 active:cursor-grabbing"
                                                                                    >
                                                                                        <DotsSixVertical className="!size-12" />
                                                                                    </SortableDragHandle>
                                                                                </div>
                                                                            </div>

                                                                            <div className="pointer-events-none opacity-90">
                                                                                <PPTComponentFactory
                                                                                    key={index}
                                                                                    type={
                                                                                        getValues(
                                                                                            `questions.${index}.questionType`
                                                                                        ) as QuestionType
                                                                                    }
                                                                                    props={{
                                                                                        form: form as any,
                                                                                        currentQuestionIndex:
                                                                                            index,
                                                                                        setCurrentQuestionIndex:
                                                                                            setCurrentQuestionIndex,
                                                                                        className:
                                                                                            'relative mt-4 rounded-xl border-2 border-gray-100 bg-white p-0 overflow-hidden',
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        {hasError && (
                                                                            <div className="absolute right-4 top-4 size-8 rounded-full bg-red-500 ring-4 ring-white" />
                                                                        )}
                                                                    </div>
                                                                </SortableItem>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </Sortable>
                                        </div>
                                    </div>

                                    <div className="relative size-full flex-1 overflow-hidden bg-muted/10">
                                        {questions && questions.length === 0 ? (
                                            <div className="flex size-full items-center justify-center">
                                                <h1 className="font-medium text-muted-foreground">
                                                    No Question Exists.
                                                </h1>
                                            </div>
                                        ) : (
                                            <div className="size-full overflow-y-auto p-8">
                                                <div className="mx-auto min-h-[600px] w-full max-w-5xl rounded-xl border bg-background p-10 shadow-sm">
                                                    <MainViewComponentFactory
                                                        key={currentQuestionIndex}
                                                        type={
                                                            getValues(
                                                                `questions.${currentQuestionIndex}.questionType`
                                                            ) as QuestionType
                                                        }
                                                        props={{
                                                            form: form as any,
                                                            currentQuestionIndex:
                                                                currentQuestionIndex,
                                                            setCurrentQuestionIndex:
                                                                setCurrentQuestionIndex,
                                                            className: 'flex w-full flex-col gap-6',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </FormProvider>
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
};

export default AIQuestionsPreview;
