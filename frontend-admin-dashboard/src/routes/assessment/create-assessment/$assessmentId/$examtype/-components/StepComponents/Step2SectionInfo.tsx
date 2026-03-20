import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import React, { MutableRefObject, useEffect, useState, useRef } from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { PencilSimpleLine, TrashSimple, X, Check } from '@phosphor-icons/react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import useDialogStore from '@/routes/assessment/question-papers/-global-states/question-paper-dialogue-close';
import { MyButton } from '@/components/design-system/button';
import { QuestionPaperUpload } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { QuestionPapersTabs } from '@/routes/assessment/question-papers/-components/QuestionPapersTabs';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { calculateTotalMarks, getQuestionTypeCounts, getStepKey } from '../../-utils/helper';
import { MyInput } from '@/components/design-system/input';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { getAssessmentDetails } from '../../-services/assessment-services';
import { useSuspenseQuery } from '@tanstack/react-query';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import sectionDetailsSchema from '../../-utils/section-details-schema';
import { useSavedAssessmentStore } from '../../-utils/global-states';
import { Route } from '../..';
import { useQuestionsForSection } from '../../-hooks/getQuestionsDataForSection';
import { calculateAveragePenalty } from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-utils/helper';
import Step2GenerateQuestionsFromAI from './-components/Step2GenerateQuestionsFromAI';
import { CriteriaStatusBadge } from './-components/CriteriaStatusBadge';
import { CriteriaPreviewDialog } from './-components/CriteriaPreviewDialog';
import { AddEditCriteriaDialog } from './-components/AddEditCriteriaDialog';
import {
    CriteriaJson,
    CriteriaSource,
    parseCriteria,
    generateAICriteria,
    stringifyCriteria,
} from '../../-services/criteria-services';
import { MainViewQuillEditor } from '@/components/quill/MainViewQuillEditor';
import TipTapEditor from '@/components/tiptap/TipTapEditor';
import { Sparkle, Spinner } from 'phosphor-react';
import { toast } from 'sonner';

type SectionFormType = z.infer<typeof sectionDetailsSchema>;

export const Step2SectionInfo = ({
    form,
    index,
    currentStep,
    oldData,
}: {
    form: UseFormReturn<SectionFormType>;
    index: number;
    currentStep: number;
    oldData: MutableRefObject<SectionFormType>;
}) => {
    const { assessmentId, examtype } = Route.useParams();
    const [enableSectionName, setEnableSectionName] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [originalSectionName, setOriginalSectionName] = useState<string>('');
    const sectionNameInputRef = React.useRef<HTMLInputElement>(null);

    // Criteria management state
    const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
    const [criteriaPreview, setCriteriaPreview] = useState<CriteriaJson | null>(null);

    // Bulk AI generation state
    const [bulkGenerating, setBulkGenerating] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

    // Auto-focus input when edit mode is enabled
    useEffect(() => {
        if (enableSectionName && sectionNameInputRef.current) {
            sectionNameInputRef.current.focus();
            sectionNameInputRef.current.select();
        }
    }, [enableSectionName, index]);

    // Ref to track if bulk generation should be cancelled
    const cancelBulkGeneration = useRef(false);

    // Bulk generate AI criteria for all questions
    const handleBulkGenerateCriteria = async () => {
        const questions = allSections[index]?.adaptive_marking_for_each_question || [];

        if (questions.length === 0) {
            toast.error('No questions in this section');
            return;
        }

        // Confirm with user
        const confirmed = window.confirm(
            `Generate AI criteria for all ${questions.length} questions in this section?`
        );

        if (!confirmed) return;

        cancelBulkGeneration.current = false;
        setBulkGenerating(true);
        setBulkProgress({ current: 0, total: questions.length });

        const updatedSections = [...allSections];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < questions.length; i++) {
            // Check if user cancelled
            if (cancelBulkGeneration.current) {
                toast.info('Generation cancelled by user');
                break;
            }

            const question = questions[i];

            try {
                setBulkProgress({ current: i + 1, total: questions.length });

                // Skip if criteria already exists
                if ((question as any).evaluation_criteria_json) {
                    toast.info(`Question ${i + 1} already has criteria`);
                    continue;
                }

                if (question?.questionMark === '0') {
                    toast.info(`Question ${i + 1} has 0 marks, skipping`);
                    continue;
                }

                // Generate AI criteria
                const criteriaJson = await generateAICriteria({
                    question_text: question?.questionName || '',
                    question_type: question?.questionType || '',
                    subject: '', // Can be enhanced to get from parent form
                    max_marks: Number(question?.questionMark) || 0,
                });

                // Update the question with generated criteria
                (
                    updatedSections[index]!.adaptive_marking_for_each_question[i] as any
                ).evaluation_criteria_json = stringifyCriteria(criteriaJson);
                (
                    updatedSections[index]!.adaptive_marking_for_each_question[i] as any
                ).criteria_source = 'ai';

                successCount++;

                // Small delay to avoid overwhelming the API
                await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (error) {
                toast.error(`Failed to generate criteria for question ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
                failCount++;
            }
        }

        // Update form with all changes
        setValue('section', updatedSections);

        setBulkGenerating(false);
        setBulkProgress({ current: 0, total: 0 });
        cancelBulkGeneration.current = false;

        // Show summary
        if (successCount > 0) {
            toast.success(`Generated criteria for ${successCount} questions!`);
        }
        if (failCount > 0) {
            toast.error(`Failed to generate criteria for ${failCount} questions`);
        }
    };

    const handleCancelBulkGeneration = () => {
        cancelBulkGeneration.current = true;
    };

    // Store original section name when editing starts
    useEffect(() => {
        if (enableSectionName) {
            const currentValue = form.getValues(`section.${index}.sectionName`);
            setOriginalSectionName(currentValue || '');
        }
    }, [enableSectionName, form, index]);

    // Reset focus state when edit mode is disabled
    useEffect(() => {
        if (!enableSectionName) {
            setIsInputFocused(false);
        }
    }, [enableSectionName]);
    const { instituteDetails } = useInstituteDetailsStore();
    const { savedAssessmentId } = useSavedAssessmentStore();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const { data: assessmentDetails, isLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId !== 'defaultId' ? assessmentId : savedAssessmentId,
            instituteId: instituteDetails?.id,
            type: examtype,
        })
    );

    const adaptiveMarking = useQuestionsForSection(
        assessmentId,
        form.getValues(`section.${index}.sectionId`)
    );

    const {
        isManualQuestionPaperDialogOpen,
        isUploadFromDeviceDialogOpen,
        setIsManualQuestionPaperDialogOpen,
        setIsUploadFromDeviceDialogOpen,
        isSavedQuestionPaperDialogOpen,
        setIsSavedQuestionPaperDialogOpen,
    } = useDialogStore();

    const { setValue, getValues, control, watch } = form;
    const allSections = getValues('section');

    const { remove } = useFieldArray({
        control,
        name: 'section', // Matches the key in defaultValues
    });

    const handleDeleteSection = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        remove(index);
    };

    // Safety check to ensure section name is never empty or undefined
    useEffect(() => {
        const currentSectionName = getValues(`section.${index}.sectionName`);

        if (
            !currentSectionName ||
            currentSectionName === 'N/A' ||
            currentSectionName.trim() === ''
        ) {
            setValue(`section.${index}.sectionName`, `Section ${index + 1}`);
        }
    }, [getValues, setValue, index]);

    useEffect(() => {
        const marksPerQuestion = getValues(`section.${index}`).marks_per_question;

        // Loop through adaptive_marking_for_each_question and assign questionMark
        const updatedQuestions = getValues(
            `section.${index}`
        ).adaptive_marking_for_each_question.map((question) => ({
            ...question,
            questionMark: marksPerQuestion, // Assign marks_per_question to questionMark
        }));

        // Update the section's adaptive_marking_for_each_question
        setValue(`section.${index}.adaptive_marking_for_each_question`, updatedQuestions);
        setValue(
            `section.${index}.total_marks`,
            calculateTotalMarks(getValues(`section.${index}.adaptive_marking_for_each_question`))
        );
    }, [watch(`section.${index}.marks_per_question`)]);

    useEffect(() => {
        const negative_marking = getValues(`section.${index}`).negative_marking.value;

        // Loop through adaptive_marking_for_each_question and assign questionMark
        const updatedQuestions = getValues(
            `section.${index}`
        ).adaptive_marking_for_each_question.map((question) => ({
            ...question,
            questionPenalty: negative_marking, // Assign marks_per_question to questionMark
        }));

        // Update the section's adaptive_marking_for_each_question
        setValue(`section.${index}.adaptive_marking_for_each_question`, updatedQuestions);
    }, [watch(`section.${index}.negative_marking.value`)]);

    useEffect(() => {
        const questionDurationHrs = getValues(`section.${index}`).question_duration?.hrs;
        const questionDurationMin = getValues(`section.${index}`).question_duration?.min;

        // Loop through adaptive_marking_for_each_question and assign questionMark
        const updatedQuestions = getValues(
            `section.${index}`
        ).adaptive_marking_for_each_question.map((question) => ({
            ...question,
            questionDuration: {
                hrs: questionDurationHrs,
                min: questionDurationMin,
            },
        }));

        // Update the section's adaptive_marking_for_each_question
        setValue(`section.${index}.adaptive_marking_for_each_question`, updatedQuestions);
    }, [
        watch(`section.${index}.question_duration.hrs`),
        watch(`section.${index}.question_duration.min`),
    ]);

    useEffect(() => {
        if (assessmentId !== 'defaultId') {
            setValue(
                `section.${index}.adaptive_marking_for_each_question`,
                adaptiveMarking.adaptiveMarking
            );
            // setValue(
            //     `section.${index}.marks_per_question`,
            //     String(calculateAverageMarks(adaptiveMarking.adaptiveMarking)),
            // );
            setValue(
                `section.${index}.negative_marking.checked`,
                calculateAveragePenalty(adaptiveMarking.adaptiveMarking) > 0 ? true : false
            );
            setValue(
                `section.${index}.negative_marking.value`,
                String(calculateAveragePenalty(adaptiveMarking.adaptiveMarking))
            );
            if (oldData.current?.section && oldData.current.section[index]) {
                oldData.current.section[index]!.adaptive_marking_for_each_question =
                    adaptiveMarking.adaptiveMarking;
            }
        }
    }, [watch(`section.${index}`)]);

    if (isLoading || adaptiveMarking.isLoading) return <DashboardLoader />;

    return (
        <AccordionItem value={`section-${index}`} key={index}>
            <AccordionTrigger
                className="flex items-center justify-between"
                id="section-details"
                onKeyDown={(e) => {
                    // Prevent accordion toggle when section name editing is enabled or input is focused
                    if (enableSectionName || isInputFocused) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                    return true;
                }}
                onKeyUp={(e) => {
                    // Prevent accordion toggle when section name editing is enabled or input is focused
                    if (enableSectionName || isInputFocused) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                    return true;
                }}
                onClick={(e) => {
                    // Prevent accordion toggle when section name editing is enabled or input is focused
                    if (enableSectionName || isInputFocused) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                    return true;
                }}
            >
                <div className="flex w-full items-center justify-between">
                    {allSections?.[index] ? (
                        <div className="flex items-center justify-start gap-2 text-primary-500">
                            <FormField
                                control={control}
                                name={`section.${index}.sectionName`}
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onChangeFunction={field.onChange}
                                                size="large"
                                                {...field}
                                                ref={sectionNameInputRef}
                                                className="!ml-0 w-20 border-none !pl-0 text-primary-500"
                                                disabled={!enableSectionName}
                                                onClick={(e) => {
                                                    // Prevent accordion toggle when clicking on input
                                                    e.stopPropagation();
                                                }}
                                                onKeyDown={(e) => {
                                                    // Handle Enter key to save and exit edit mode
                                                    if (e.key === 'Enter' && enableSectionName) {
                                                        e.preventDefault();
                                                        e.stopPropagation();

                                                        // Save the changes and exit edit mode
                                                        setEnableSectionName(false);
                                                        form.trigger(
                                                            `section.${index}.sectionName`
                                                        );
                                                        return;
                                                    }

                                                    // Handle Escape key to cancel editing
                                                    if (e.key === 'Escape' && enableSectionName) {
                                                        e.preventDefault();
                                                        e.stopPropagation();

                                                        // Cancel editing and restore original value
                                                        setEnableSectionName(false);
                                                        form.setValue(
                                                            `section.${index}.sectionName`,
                                                            originalSectionName
                                                        );
                                                        return;
                                                    }

                                                    // Prevent accordion toggle when typing in the input field
                                                    if (enableSectionName) {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                                onKeyUp={(e) => {
                                                    // Prevent accordion toggle when typing in the input field
                                                    if (enableSectionName) {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                                onKeyPress={(e) => {
                                                    // Prevent accordion toggle when typing in the input field
                                                    if (enableSectionName) {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                                onFocus={(e) => {
                                                    setIsInputFocused(true);
                                                }}
                                                onBlur={(e) => {
                                                    setIsInputFocused(false);
                                                }}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {enableSectionName ? (
                                <Check
                                    size={16}
                                    className="cursor-pointer text-primary-600 transition-colors hover:text-primary-700"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent accordion toggle
                                        setEnableSectionName(false);
                                        // Trigger form validation to save the changes
                                        form.trigger(`section.${index}.sectionName`);
                                    }}
                                />
                            ) : (
                                <PencilSimpleLine
                                    size={16}
                                    className="cursor-pointer text-neutral-600 transition-colors hover:text-primary-600"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent accordion toggle
                                        setEnableSectionName(true);
                                    }}
                                />
                            )}
                            {allSections?.[index]!.adaptive_marking_for_each_question.length >
                                0 && (
                                <span className="font-thin !text-neutral-600">
                                    (MCQ(Single Correct):&nbsp;
                                    {allSections?.[index]?.adaptive_marking_for_each_question
                                        ? getQuestionTypeCounts(
                                              allSections[index]!.adaptive_marking_for_each_question
                                          ).MCQS
                                        : 0}
                                    ,&nbsp; MCQ(Multiple Correct):&nbsp;
                                    {allSections?.[index]?.adaptive_marking_for_each_question
                                        ? getQuestionTypeCounts(
                                              allSections[index]!.adaptive_marking_for_each_question
                                          ).MCQM
                                        : 0}
                                    ,&nbsp; Total:&nbsp;
                                    {allSections?.[index]?.adaptive_marking_for_each_question
                                        ? getQuestionTypeCounts(
                                              allSections[index]!.adaptive_marking_for_each_question
                                          ).totalQuestions
                                        : 0}
                                    )
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-start gap-2 text-primary-500">
                            <FormField
                                control={control}
                                name={`section.${index}.sectionName`}
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onChangeFunction={field.onChange}
                                                size="large"
                                                {...field}
                                                className="!ml-0 w-20 border-none !pl-0 text-primary-500"
                                                disabled={!enableSectionName}
                                                onClick={(e) => {
                                                    // Prevent accordion toggle when clicking on input
                                                    e.stopPropagation();
                                                }}
                                                onKeyDown={(e) => {
                                                    // Prevent accordion toggle when typing in the input field
                                                    if (enableSectionName) {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                                onKeyUp={(e) => {
                                                    // Prevent accordion toggle when typing in the input field
                                                    if (enableSectionName) {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                                onKeyPress={(e) => {
                                                    // Prevent accordion toggle when typing in the input field
                                                    if (enableSectionName) {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                                onFocus={(e) => {
                                                    setIsInputFocused(true);
                                                }}
                                                onBlur={(e) => {
                                                    setIsInputFocused(false);
                                                }}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {enableSectionName ? (
                                <Check
                                    size={16}
                                    className="cursor-pointer text-primary-600 transition-colors hover:text-primary-700"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent accordion toggle
                                        setEnableSectionName(false);
                                        // Trigger form validation to save the changes
                                        form.trigger(`section.${index}.sectionName`);
                                    }}
                                />
                            ) : (
                                <PencilSimpleLine
                                    size={16}
                                    className="cursor-pointer text-neutral-600 transition-colors hover:text-primary-600"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent accordion toggle
                                        setEnableSectionName(true);
                                    }}
                                />
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-4">
                        <TrashSimple
                            size={20}
                            className="text-danger-400"
                            onClick={(e) => handleDeleteSection(e, index)}
                        />
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-8">
                <div
                    className="flex flex-wrap items-center justify-start gap-5"
                    id="upload-question-paper"
                >
                    <h3>Upload Question Paper</h3>
                    <AlertDialog
                        open={isUploadFromDeviceDialogOpen}
                        onOpenChange={setIsUploadFromDeviceDialogOpen}
                    >
                        <AlertDialogTrigger>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                className="font-thin"
                            >
                                Upload from Device
                            </MyButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="p-0">
                            <div className="flex items-center justify-between rounded-md bg-primary-50">
                                <h1 className="rounded-sm p-4 font-bold text-primary-500">
                                    Upload Question Paper From Device
                                </h1>
                                <AlertDialogCancel
                                    className="border-none bg-primary-50 shadow-none hover:bg-primary-50"
                                    onClick={() => setIsUploadFromDeviceDialogOpen(false)}
                                >
                                    <X className="text-neutral-600" />
                                </AlertDialogCancel>
                            </div>
                            <QuestionPaperUpload
                                isManualCreated={false}
                                index={index}
                                sectionsForm={form}
                                currentQuestionIndex={currentQuestionIndex}
                                setCurrentQuestionIndex={setCurrentQuestionIndex}
                                examType={examtype}
                            />
                        </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog
                        open={isManualQuestionPaperDialogOpen}
                        onOpenChange={setIsManualQuestionPaperDialogOpen}
                    >
                        <AlertDialogTrigger>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                className="font-thin"
                            >
                                Create Manually
                            </MyButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="p-0">
                            <div className="flex items-center justify-between rounded-md bg-primary-50">
                                <h1 className="rounded-sm p-4 font-bold text-primary-500">
                                    Create Question Paper Manually
                                </h1>
                                <AlertDialogCancel
                                    className="border-none bg-primary-50 shadow-none hover:bg-primary-50"
                                    onClick={() => setIsManualQuestionPaperDialogOpen(false)}
                                >
                                    <X className="text-neutral-600" />
                                </AlertDialogCancel>
                            </div>
                            <QuestionPaperUpload
                                isManualCreated={true}
                                index={index}
                                sectionsForm={form}
                                currentQuestionIndex={currentQuestionIndex}
                                setCurrentQuestionIndex={setCurrentQuestionIndex}
                                examType={examtype}
                            />
                        </AlertDialogContent>
                    </AlertDialog>
                    <Dialog
                        open={isSavedQuestionPaperDialogOpen}
                        onOpenChange={setIsSavedQuestionPaperDialogOpen}
                    >
                        <DialogTrigger>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                className="font-thin"
                            >
                                Choose Saved Paper
                            </MyButton>
                        </DialogTrigger>
                        <DialogContent className="no-scrollbar !m-0 flex h-[90vh] !w-full !max-w-[90vw] flex-col items-start !gap-0 overflow-y-auto !p-0 [&>button]:hidden">
                            <DialogTitle className="sr-only">
                                Choose Saved Question Paper From List
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Select a previously saved question paper to add to this section
                            </DialogDescription>
                            <div className="flex h-14 w-full items-center justify-between rounded-md bg-primary-50">
                                <h1 className="rounded-sm p-4 font-bold text-primary-500">
                                    Choose Saved Question Paper From List
                                </h1>
                                <DialogClose
                                    className="mr-4 !border-none bg-primary-50 shadow-none hover:bg-primary-50"
                                    onClick={() => setIsSavedQuestionPaperDialogOpen(false)}
                                >
                                    <X className="text-neutral-600" />
                                </DialogClose>
                            </div>
                            <div className="h-full w-screen overflow-y-auto p-8">
                                <QuestionPapersTabs
                                    isAssessment={true}
                                    index={index}
                                    sectionsForm={form}
                                    currentQuestionIndex={currentQuestionIndex}
                                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                                    examType={examtype}
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Step2GenerateQuestionsFromAI form={form} index={index} />
                </div>

                {/* Evaluation Criteria Section */}
                {examtype !== 'SURVEY' &&
                    (allSections[index]?.adaptive_marking_for_each_question?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-4">
                            <h3 className="font-thin">Evaluation Criteria</h3>
                            <div className="flex items-center gap-3">
                                <MyButton
                                    type="button"
                                    buttonType={'secondary'}
                                    scale="large"
                                    onClick={() => {
                                        if (bulkGenerating) {
                                            handleCancelBulkGeneration();
                                        } else {
                                            handleBulkGenerateCriteria();
                                        }
                                    }}
                                >
                                    {bulkGenerating ? (
                                        <p className="ml-2 flex items-center gap-2 text-sm text-neutral-600">
                                            <span>
                                                Stop ({bulkProgress.current}/{bulkProgress.total})
                                            </span>
                                            <Spinner className="mr-2 animate-spin text-primary-500" />
                                        </p>
                                    ) : (
                                        <>
                                            <Sparkle size={16} className="mr-2" />
                                            AI Generate All Criteria
                                        </>
                                    )}
                                </MyButton>
                            </div>
                        </div>
                    )}

                <div className="flex flex-col gap-2" id="section-instructions">
                    <h1 className="font-thin">Section Description</h1>
                    <FormField
                        control={control}
                        name={`section.${index}.section_description`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <RichTextEditor
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        value={field.value}
                                        placeholder="Describe this section"
                                        minHeight={120}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
                {watch(`testDuration.questionWiseDuration`) && examtype !== 'SURVEY' && (
                    <div className="flex w-96 items-center justify-between text-sm font-thin">
                        <h1 className="font-normal">
                            Question Duration{' '}
                            {getStepKey({
                                assessmentDetails,
                                currentStep,
                                key: 'section_duration',
                            }) === 'REQUIRED' && (
                                <span className="text-subtitle text-danger-600">*</span>
                            )}
                        </h1>
                        <div className="flex items-center gap-4">
                            <FormField
                                control={control}
                                name={`section.${index}.question_duration.hrs`}
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onKeyPress={(e) => {
                                                    const charCode = e.key;
                                                    if (!/[0-9]/.test(charCode)) {
                                                        e.preventDefault(); // Prevent non-numeric input
                                                    }
                                                }}
                                                onChangeFunction={(e) => {
                                                    const inputValue = e.target.value.replace(
                                                        /[^0-9]/g,
                                                        ''
                                                    ); // Remove non-numeric characters
                                                    field.onChange(inputValue); // Call onChange with the sanitized value
                                                }}
                                                size="large"
                                                {...field}
                                                className="w-11"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <span>hrs</span>
                            <span>:</span>
                            <FormField
                                control={control}
                                name={`section.${index}.question_duration.min`}
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onKeyPress={(e) => {
                                                    const charCode = e.key;
                                                    if (!/[0-9]/.test(charCode)) {
                                                        e.preventDefault(); // Prevent non-numeric input
                                                    }
                                                }}
                                                onChangeFunction={(e) => {
                                                    const inputValue = e.target.value.replace(
                                                        /[^0-9]/g,
                                                        ''
                                                    ); // Remove non-numeric characters
                                                    field.onChange(inputValue); // Call onChange with the sanitized value
                                                }}
                                                size="large"
                                                {...field}
                                                className="w-11"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <span>minutes</span>
                        </div>
                    </div>
                )}
                {watch(`testDuration.sectionWiseDuration`) && examtype !== 'SURVEY' && (
                    <div className="flex w-96 items-center justify-between text-sm font-thin">
                        <h1 className="font-normal">
                            Section Duration{' '}
                            {getStepKey({
                                assessmentDetails,
                                currentStep,
                                key: 'section_duration',
                            }) === 'REQUIRED' && (
                                <span className="text-subtitle text-danger-600">*</span>
                            )}
                        </h1>
                        <div className="flex items-center gap-4">
                            <FormField
                                control={control}
                                name={`section.${index}.section_duration.hrs`}
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onKeyPress={(e) => {
                                                    const charCode = e.key;
                                                    if (!/[0-9]/.test(charCode)) {
                                                        e.preventDefault(); // Prevent non-numeric input
                                                    }
                                                }}
                                                onChangeFunction={(e) => {
                                                    const inputValue = e.target.value.replace(
                                                        /[^0-9]/g,
                                                        ''
                                                    ); // Remove non-numeric characters
                                                    field.onChange(inputValue); // Call onChange with the sanitized value
                                                }}
                                                size="large"
                                                {...field}
                                                className="w-11"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <span>hrs</span>
                            <span>:</span>
                            <FormField
                                control={control}
                                name={`section.${index}.section_duration.min`}
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onKeyPress={(e) => {
                                                    const charCode = e.key;
                                                    if (!/[0-9]/.test(charCode)) {
                                                        e.preventDefault(); // Prevent non-numeric input
                                                    }
                                                }}
                                                onChangeFunction={(e) => {
                                                    const inputValue = e.target.value.replace(
                                                        /[^0-9]/g,
                                                        ''
                                                    ); // Remove non-numeric characters
                                                    field.onChange(inputValue); // Call onChange with the sanitized value
                                                }}
                                                size="large"
                                                {...field}
                                                className="w-11"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <span>minutes</span>
                        </div>
                    </div>
                )}
                {examtype !== 'SURVEY' && (
                    <div id="marking-scheme" className="flex flex-col gap-8">
                        <div
                            className="flex items-center gap-4 text-sm font-thin"
                            id="marking-scheme"
                        >
                            <div className="flex flex-col font-normal">
                                <h1>
                                    Marks Per Question
                                    {getStepKey({
                                        assessmentDetails,
                                        currentStep,
                                        key: 'marks_per_question',
                                    }) === 'REQUIRED' && (
                                        <span className="text-subtitle text-danger-600">*</span>
                                    )}
                                </h1>
                                <h1>(Default)</h1>
                            </div>
                            <FormField
                                control={control}
                                name={`section.${index}.marks_per_question`}
                                render={({ field: { ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onKeyPress={(e) => {
                                                    const charCode = e.key;
                                                    if (
                                                        !/[0-9.]/.test(charCode) ||
                                                        (charCode === '.' &&
                                                            field.value?.includes('.'))
                                                    ) {
                                                        e.preventDefault(); // Prevent non-numeric and multiple decimals
                                                    }
                                                }}
                                                onChangeFunction={(e) => {
                                                    const inputValue = e.target.value.replace(
                                                        /[^0-9.]/g,
                                                        ''
                                                    ); // Allow numbers and decimal
                                                    if (inputValue.split('.').length > 2) return; // Prevent multiple decimals
                                                    field.onChange(inputValue);
                                                }}
                                                size="large"
                                                {...field}
                                                className="ml-3 w-11"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex w-1/2 items-center justify-between">
                            <div className="flex w-52 items-center justify-between gap-4">
                                <h1>
                                    Negative Marking
                                    {getStepKey({
                                        assessmentDetails,
                                        currentStep,
                                        key: 'negative_marking',
                                    }) === 'REQUIRED' && (
                                        <span className="text-subtitle text-danger-600">*</span>
                                    )}
                                </h1>
                                <FormField
                                    control={control}
                                    name={`section.${index}.negative_marking.value`}
                                    render={({ field: { ...field } }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MyInput
                                                    disabled={
                                                        form.getValues(
                                                            `section.${index}.negative_marking.checked`
                                                        )
                                                            ? false
                                                            : true
                                                    }
                                                    inputType="text"
                                                    inputPlaceholder="00"
                                                    input={field.value}
                                                    onKeyPress={(e) => {
                                                        const charCode = e.key;
                                                        if (
                                                            !/[0-9.]/.test(charCode) ||
                                                            (charCode === '.' &&
                                                                field.value?.includes('.'))
                                                        ) {
                                                            e.preventDefault(); // Prevent non-numeric and multiple decimals
                                                        }
                                                    }}
                                                    onChangeFunction={(e) => {
                                                        const inputValue = e.target.value.replace(
                                                            /[^0-9.]/g,
                                                            ''
                                                        ); // Allow numbers and decimal
                                                        if (inputValue.split('.').length > 2)
                                                            return; // Prevent multiple decimals
                                                        field.onChange(inputValue);
                                                    }}
                                                    size="large"
                                                    {...field}
                                                    className="mr-2 w-11"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={control}
                                name={`section.${index}.negative_marking.checked`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name={`section.${index}.partial_marking`}
                            render={({ field }) => (
                                <FormItem className="flex w-1/2 items-center justify-between">
                                    <FormLabel className="font-normal">
                                        Partial Marking
                                        {getStepKey({
                                            assessmentDetails,
                                            currentStep,
                                            key: 'partial_marking',
                                        }) === 'REQUIRED' && (
                                            <span className="text-subtitle text-danger-600">*</span>
                                        )}
                                    </FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        {/* will be adding it later
                        <div className="flex w-1/2 items-center justify-between">
                            <div className="flex w-52 items-center justify-between gap-4">
                                <h1>Cut off Marks</h1>
                                <FormField
                                    control={control}
                                    name={`section.${index}.cutoff_marks.value`}
                                    render={({ field: { ...field } }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MyInput
                                                    disabled={
                                                        form.getValues(
                                                            `section.${index}.cutoff_marks.checked`,
                                                        )
                                                            ? false
                                                            : true
                                                    }
                                                    onKeyPress={(e) => {
                                                        const charCode = e.key;
                                                        if (
                                                            !/[0-9.]/.test(charCode) ||
                                                            (charCode === "." &&
                                                                field.value.includes("."))
                                                        ) {
                                                            e.preventDefault(); // Prevent non-numeric and multiple decimals
                                                        }
                                                    }}
                                                    onChangeFunction={(e) => {
                                                        const inputValue = e.target.value.replace(
                                                            /[^0-9.]/g,
                                                            "",
                                                        ); // Allow numbers and decimal
                                                        if (inputValue.split(".").length > 2)
                                                            return; // Prevent multiple decimals
                                                        field.onChange(inputValue);
                                                    }}
                                                    inputType="text"
                                                    inputPlaceholder="00"
                                                    input={field.value}
                                                    size="large"
                                                    {...field}
                                                    className="mr-2 w-11"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={control}
                                name={`section.${index}.cutoff_marks.checked`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div> */}
                    </div>
                )}
                {examtype !== 'SURVEY' && (
                    <FormField
                        control={form.control}
                        name={`section.${index}.problem_randomization`}
                        render={({ field }) => (
                            <FormItem className="flex w-1/2 items-center justify-between">
                                <FormLabel className="font-normal">
                                    Problem Randomization
                                    {getStepKey({
                                        assessmentDetails,
                                        currentStep,
                                        key: 'problem_randomization',
                                    }) === 'REQUIRED' && (
                                        <span className="text-subtitle text-danger-600">*</span>
                                    )}
                                </FormLabel>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                )}
                {Boolean(allSections?.[index]?.adaptive_marking_for_each_question?.length) && (
                    <div>
                        <h1 className="mb-4 text-primary-500">
                            {examtype === 'SURVEY' ? 'Survey Questions' : 'Adaptive Marking Rules'}
                        </h1>
                        <Table>
                            <TableHeader className="bg-primary-200">
                                <TableRow>
                                    <TableHead>Q.No.</TableHead>
                                    <TableHead>
                                        {examtype === 'SURVEY' ? 'Survey Question' : 'Question'}
                                    </TableHead>
                                    <TableHead>Question Type</TableHead>
                                    {examtype !== 'SURVEY' && <TableHead>Marks</TableHead>}
                                    {examtype !== 'SURVEY' && <TableHead>Penalty</TableHead>}
                                    {watch(`testDuration.questionWiseDuration`) &&
                                        examtype !== 'SURVEY' && <TableHead>Time</TableHead>}
                                    {examtype !== 'SURVEY' && <TableHead>Criteria</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody className="bg-neutral-50">
                                {allSections[index] &&
                                    allSections[index]?.adaptive_marking_for_each_question?.map(
                                        (question, idx) => {
                                            return (
                                                <TableRow key={idx}>
                                                    <TableCell>{idx + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="w-full max-w-md">
                                                            <TipTapEditor
                                                                value={question.questionName || ''}
                                                                editable={false}
                                                                onChange={() => {}}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{question.questionType}</TableCell>
                                                    {examtype !== 'SURVEY' && (
                                                        <TableCell>
                                                            <FormField
                                                                control={control}
                                                                name={`section.${index}.adaptive_marking_for_each_question.${idx}.questionMark`}
                                                                render={({
                                                                    field: { ...field },
                                                                }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="text"
                                                                                placeholder="00"
                                                                                className="w-11"
                                                                                value={field.value}
                                                                                onChange={
                                                                                    field.onChange
                                                                                }
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    {examtype !== 'SURVEY' && (
                                                        <TableCell>
                                                            <FormField
                                                                control={control}
                                                                name={`section.${index}.adaptive_marking_for_each_question.${idx}.questionPenalty`}
                                                                render={({
                                                                    field: { ...field },
                                                                }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                disabled={
                                                                                    form.getValues(
                                                                                        `section.${index}.negative_marking.checked`
                                                                                    )
                                                                                        ? false
                                                                                        : true
                                                                                }
                                                                                type="text"
                                                                                placeholder="00"
                                                                                className="w-11"
                                                                                value={field.value}
                                                                                onChange={
                                                                                    field.onChange
                                                                                }
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    {watch(`testDuration.questionWiseDuration`) &&
                                                        examtype !== 'SURVEY' && (
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <FormField
                                                                        control={control}
                                                                        name={`section.${index}.adaptive_marking_for_each_question.${idx}.questionDuration.hrs`}
                                                                        render={({
                                                                            field: { ...field },
                                                                        }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <Input
                                                                                        type="text"
                                                                                        placeholder="00"
                                                                                        className="w-11"
                                                                                        value={
                                                                                            field.value
                                                                                        }
                                                                                        onChange={
                                                                                            field.onChange
                                                                                        }
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <span>:</span>
                                                                    <FormField
                                                                        control={control}
                                                                        name={`section.${index}.adaptive_marking_for_each_question.${idx}.questionDuration.min`}
                                                                        render={({
                                                                            field: { ...field },
                                                                        }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <Input
                                                                                        type="text"
                                                                                        placeholder="00"
                                                                                        className="w-11"
                                                                                        value={
                                                                                            field.value
                                                                                        }
                                                                                        onChange={
                                                                                            field.onChange
                                                                                        }
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                    {examtype !== 'SURVEY' && (
                                                        <TableCell>
                                                            <CriteriaStatusBadge
                                                                status={
                                                                    (question as any)
                                                                        ?.evaluation_criteria_json
                                                                        ? ((question as any)
                                                                              ?.criteria_source as CriteriaSource) ||
                                                                          'manual'
                                                                        : 'not-added'
                                                                }
                                                                onClick={() => {
                                                                    setSelectedQuestionIndex(idx);
                                                                    setCriteriaDialogOpen(true);
                                                                }}
                                                                onPreview={
                                                                    (question as any)
                                                                        ?.evaluation_criteria_json
                                                                        ? () => {
                                                                              setCriteriaPreview(
                                                                                  parseCriteria(
                                                                                      (
                                                                                          question as any
                                                                                      )
                                                                                          .evaluation_criteria_json!
                                                                                  )
                                                                              );
                                                                              setPreviewDialogOpen(
                                                                                  true
                                                                              );
                                                                          }
                                                                        : undefined
                                                                }
                                                            />
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            );
                                        }
                                    )}
                            </TableBody>
                        </Table>
                    </div>
                )}
                {examtype !== 'SURVEY' &&
                    (watch(`section.${index}.marks_per_question`) ||
                        watch(`section.${index}.total_marks`)) && (
                        <div className="flex items-center justify-end gap-1">
                            <span>Total Marks</span>
                            <span>:</span>
                            <h1>
                                {calculateTotalMarks(
                                    getValues(`section.${index}.adaptive_marking_for_each_question`)
                                )}
                            </h1>
                        </div>
                    )}
            </AccordionContent>

            {/* Criteria Dialogs */}
            {selectedQuestionIndex !== null && (
                <AddEditCriteriaDialog
                    question={{
                        text:
                            allSections[index]?.adaptive_marking_for_each_question[
                                selectedQuestionIndex
                            ]?.questionName || '',
                        question_type:
                            allSections[index]?.adaptive_marking_for_each_question[
                                selectedQuestionIndex
                            ]?.questionType || '',
                        max_marks: Number(
                            allSections[index]?.adaptive_marking_for_each_question[
                                selectedQuestionIndex
                            ]?.questionMark || 0
                        ),
                        subject: String(getValues('testCreation.subject' as any) ?? ''),
                    }}
                    existingCriteria={
                        allSections[index]?.adaptive_marking_for_each_question[
                            selectedQuestionIndex
                        ]?.evaluation_criteria_json
                            ? parseCriteria(
                                  allSections[index]?.adaptive_marking_for_each_question[
                                      selectedQuestionIndex
                                  ]?.evaluation_criteria_json!
                              ) ?? undefined
                            : undefined
                    }
                    open={criteriaDialogOpen}
                    onSave={(criteria: CriteriaJson, source: CriteriaSource) => {
                        // Update the question with criteria
                        const updatedQuestions = [
                            ...allSections[index]!.adaptive_marking_for_each_question,
                        ];
                        updatedQuestions[selectedQuestionIndex] = {
                            ...updatedQuestions[selectedQuestionIndex]!,
                            evaluation_criteria_json: stringifyCriteria(criteria),
                            criteria_source: source,
                        } as any;
                        setValue(
                            `section.${index}.adaptive_marking_for_each_question`,
                            updatedQuestions
                        );
                        setCriteriaDialogOpen(false);
                        setSelectedQuestionIndex(null);
                    }}
                    onClose={() => {
                        setCriteriaDialogOpen(false);
                        setSelectedQuestionIndex(null);
                    }}
                />
            )}

            {/* Criteria Preview Dialog */}
            <CriteriaPreviewDialog
                criteria={criteriaPreview}
                open={previewDialogOpen}
                onClose={() => {
                    setPreviewDialogOpen(false);
                    setCriteriaPreview(null);
                }}
            />
        </AccordionItem>
    );
};

export default Step2SectionInfo;
