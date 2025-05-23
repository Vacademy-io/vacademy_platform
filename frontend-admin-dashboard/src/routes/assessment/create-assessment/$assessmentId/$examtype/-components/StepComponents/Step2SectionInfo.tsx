import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import React, { MutableRefObject, useEffect, useState } from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { PencilSimpleLine, TrashSimple, X } from 'phosphor-react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import useDialogStore from '@/routes/assessment/question-papers/-global-states/question-paper-dialogue-close';
import { MyButton } from '@/components/design-system/button';
import { QuestionPaperUpload } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { QuestionPapersTabs } from '@/routes/assessment/question-papers/-components/QuestionPapersTabs';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { MainViewQuillEditor } from '@/components/quill/MainViewQuillEditor';
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
    const [enableSectionName, setEnableSectionName] = useState(true);
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
            <AccordionTrigger className="flex items-center justify-between" id="section-details">
                <div className="flex w-full items-center justify-between">
                    {allSections?.[index] ? (
                        <div className="flex items-center justify-start text-primary-500">
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
                                                disabled={enableSectionName}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
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
                                            disabled={enableSectionName}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                    <div className="flex items-center gap-4">
                        <PencilSimpleLine
                            size={20}
                            className="text-neutral-600"
                            onClick={() => setEnableSectionName(!enableSectionName)}
                        />
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
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Step2GenerateQuestionsFromAI form={form} index={index} />
                </div>
                <div className="flex flex-col gap-2" id="section-instructions">
                    <h1 className="font-thin">Section Description</h1>
                    <FormField
                        control={control}
                        name={`section.${index}.section_description`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MainViewQuillEditor
                                        onChange={field.onChange}
                                        value={field.value}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
                {watch(`testDuration.questionWiseDuration`) && (
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
                {watch(`testDuration.sectionWiseDuration`) && (
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
                                                            field.value.includes('.'))
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
                                                                field.value.includes('.'))
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
                        <h1 className="mb-4 text-primary-500">Adaptive Marking Rules</h1>
                        <Table>
                            <TableHeader className="bg-primary-200">
                                <TableRow>
                                    <TableHead>Q.No.</TableHead>
                                    <TableHead>Question</TableHead>
                                    <TableHead>Question Type</TableHead>
                                    <TableHead>Marks</TableHead>
                                    <TableHead>Penalty</TableHead>
                                    {watch(`testDuration.questionWiseDuration`) && (
                                        <TableHead>Time</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody className="bg-neutral-50">
                                {allSections[index] &&
                                    allSections[index]?.adaptive_marking_for_each_question?.map(
                                        (question, idx) => {
                                            return (
                                                <TableRow key={idx}>
                                                    <TableCell>{idx + 1}</TableCell>
                                                    <TableCell
                                                        dangerouslySetInnerHTML={{
                                                            __html: question.questionName || '',
                                                        }}
                                                    />
                                                    <TableCell>{question.questionType}</TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={control}
                                                            name={`section.${index}.adaptive_marking_for_each_question.${idx}.questionMark`}
                                                            render={({ field: { ...field } }) => (
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
                                                    <TableCell>
                                                        <FormField
                                                            control={control}
                                                            name={`section.${index}.adaptive_marking_for_each_question.${idx}.questionPenalty`}
                                                            render={({ field: { ...field } }) => (
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
                                                    {watch(`testDuration.questionWiseDuration`) && (
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
        </AccordionItem>
    );
};

export default Step2SectionInfo;
