import { Dispatch, SetStateAction, useRef, useState } from 'react';
import { uploadQuestionPaperFormSchema } from '../-utils/upload-question-paper-form-schema';
import { z } from 'zod';
import { FormProvider, useForm, UseFormReturn } from 'react-hook-form';
import SelectField from '@/components/design-system/select-field';
import { UploadFileBg } from '@/svgs';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { File, X } from 'phosphor-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { QuestionPaperTemplate } from './QuestionPaperTemplate';
import CustomInput from '@/components/design-system/custom-input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadDocsFile } from '../-services/question-paper-services';
import { toast } from 'sonner';
import { addQuestionPaper, getQuestionPaperById } from '../-utils/question-paper-services';
import {
    MyQuestion,
    MyQuestionPaperFormInterface,
} from '../../../../types/assessments/question-paper-form';
import {
    getIdByLevelName,
    getIdBySubjectName,
    transformResponseDataToMyQuestionsSchema,
} from '../-utils/helper';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    ANSWER_LABELS,
    EXPLANATION_LABELS,
    OPTIONS_LABELS,
    QUESTION_LABELS,
} from '@/constants/dummy-data';
import { useFilterDataForAssesment } from '../../assessment-list/-utils.ts/useFiltersData';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import useDialogStore from '../-global-states/question-paper-dialogue-close';
import sectionDetailsSchema from '../../create-assessment/$assessmentId/$examtype/-utils/section-details-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import ConvertToHTML from '../-images/convertToHTML.png';
import { AssignmentFormType } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-form-schemas/assignmentFormSchema';

export type SectionFormType = z.infer<typeof sectionDetailsSchema>;
export type UploadQuestionPaperFormType = z.infer<typeof uploadQuestionPaperFormSchema>;
interface QuestionPaperUploadProps {
    isManualCreated: boolean;
    index?: number;
    sectionsForm?: UseFormReturn<SectionFormType>;
    studyLibraryAssignmentForm?: UseFormReturn<AssignmentFormType>;
    isStudyLibraryAssignment?: boolean;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
}

export const QuestionPaperUpload = ({
    isManualCreated,
    index,
    sectionsForm,
    studyLibraryAssignmentForm,
    isStudyLibraryAssignment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
}: QuestionPaperUploadProps) => {
    const queryClient = useQueryClient();
    const { instituteDetails } = useInstituteDetailsStore();

    const { YearClassFilterData, SubjectFilterData } = useFilterDataForAssesment(instituteDetails);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const form = useForm<UploadQuestionPaperFormType>({
        resolver: zodResolver(uploadQuestionPaperFormSchema),
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
            questions: [],
        },
    });
    const { getValues, setValue, watch } = form;

    const questionPaperId = getValues('questionPaperId');
    const title = getValues('title');
    const yearClass = getValues('yearClass');
    const subject = getValues('subject');
    const questionIdentifier = getValues('questionsType');
    const optionIdentifier = getValues('optionsType');
    const answerIdentifier = getValues('answersType');
    const explanationIdentifier = getValues('explanationsType');
    const fileUpload = getValues('fileUpload');
    const questions = getValues('questions');
    watch('fileUpload');

    const isFormValidWhenManuallyCreated = !!title && !!yearClass && !!subject;
    const isFormValidWhenUploaded = !!title && !!yearClass && !!subject && !!fileUpload;

    const [uploadProgress, setUploadProgress] = useState(0);
    const [isProgress, setIsProgress] = useState(false);
    const [isFormSubmitting, setIsFormSubmitting] = useState(false);
    const {
        setIsMainQuestionPaperAddDialogOpen,
        setIsManualQuestionPaperDialogOpen,
        setIsUploadFromDeviceDialogOpen,
    } = useDialogStore();
    // Your mutation setup
    const handleSubmitFormData = useMutation({
        mutationFn: ({ data }: { data: MyQuestionPaperFormInterface }) => addQuestionPaper(data),
        onMutate: () => {
            setIsFormSubmitting(true);
        },
        onSettled: () => {
            setIsFormSubmitting(false);
        },
        onSuccess: async (data) => {
            const getQuestionPaper = await getQuestionPaperById(data.saved_question_paper_id);
            const transformQuestionsData: MyQuestion[] = transformResponseDataToMyQuestionsSchema(
                getQuestionPaper.question_dtolist
            );
            setCurrentQuestionIndex(0);
            toast.success('Question Paper added successfully', {
                className: 'success-toast',
                duration: 2000,
            });
            if (isStudyLibraryAssignment) {
                studyLibraryAssignmentForm?.setValue(
                    'uploaded_question_paper',
                    data.saved_question_paper_id
                );
                studyLibraryAssignmentForm?.setValue(
                    `adaptive_marking_for_each_question`,
                    transformQuestionsData.map((question) => ({
                        questionId: question.questionId,
                        questionName: question.questionName,
                        questionType: question.questionType,
                        newQuestion: true,
                    }))
                );
            }
            if (index !== undefined) {
                // Check if index is defined

                sectionsForm?.setValue(
                    `section.${index}.adaptive_marking_for_each_question`,
                    transformQuestionsData.map((question) => ({
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
                sectionsForm?.trigger(`section.${index}.adaptive_marking_for_each_question`);
            }
            setIsMainQuestionPaperAddDialogOpen(false);
            setIsManualQuestionPaperDialogOpen(false);
            setIsUploadFromDeviceDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['GET_QUESTION_PAPER_FILTERED_DATA'] });
        },
        onError: (error: unknown) => {
            toast.error(error as string);
        },
    });

    function onSubmit(values: z.infer<typeof uploadQuestionPaperFormSchema>) {
        const getIdYearClass = getIdByLevelName(instituteDetails?.levels || [], values.yearClass);
        const getIdSubject = getIdBySubjectName(instituteDetails?.subjects || [], values.subject);

        if (index !== undefined) {
            sectionsForm?.setValue(`section.${index}`, {
                ...sectionsForm?.getValues(`section.${index}`), // Keep other section data intact
                questionPaperTitle: values.title,
                subject: values.subject || '',
                yearClass: values.yearClass || '',
                sectionName: values.subject,
            });
        }

        handleSubmitFormData.mutate({
            data: {
                ...values,
                yearClass: getIdYearClass,
                subject: getIdSubject,
            } as MyQuestionPaperFormInterface,
        });
    }

    const onInvalid = (err: unknown) => {
        console.error(err);
        toast.error('some of your questions are incomplete or needs attentions!', {
            className: 'error-toast',
            duration: 3000,
        });
    };

    const addDocsFileMutation = useMutation({
        mutationFn: ({
            questionIdentifier,
            optionIdentifier,
            answerIdentifier,
            explanationIdentifier,
            file,
            setUploadProgress,
        }: {
            questionIdentifier: string;
            optionIdentifier: string;
            answerIdentifier: string;
            explanationIdentifier: string;
            file: File;
            setUploadProgress: React.Dispatch<React.SetStateAction<number>>;
        }) =>
            uploadDocsFile(
                questionIdentifier,
                optionIdentifier,
                answerIdentifier,
                explanationIdentifier,
                file,
                setUploadProgress
            ),
        onMutate: () => {
            setIsProgress(true);
        },
        onSettled: () => {
            setIsProgress(false);
        },
        onSuccess: async (data) => {
            const transformQuestionsData = transformResponseDataToMyQuestionsSchema(data);
            setValue('questions', transformQuestionsData);
            console.log('question ', getValues('questions'));
            if (index !== undefined) {
                sectionsForm?.setValue(`section.${index}`, {
                    ...sectionsForm?.getValues(`section.${index}`), // Keep other section data intact
                    adaptive_marking_for_each_question: transformQuestionsData.map((question) => ({
                        questionId: question.questionId,
                        questionName: question.questionName,
                        questionType: question.questionType,
                        questionMark: question.questionMark,
                        questionPenalty: question.questionPenalty,
                        questionDuration: {
                            hrs: question.questionDuration.hrs,
                            min: question.questionDuration.min,
                        },
                        decimals: question.decimals,
                        numericType: question.numericType,
                        validAnswers: question.validAnswers,
                        parentRichText: question.parentRichTextContent,
                        subjectiveAnswerText: question.subjectiveAnswerText,
                    })),
                });
            }
            form.trigger('questions');
        },
        onError: (error: unknown) => {
            toast.error(error as string);
        },
    });

    const handleFileSubmit = (file: File) => {
        setValue('fileUpload', file);
        addDocsFileMutation.mutate({
            questionIdentifier,
            optionIdentifier,
            answerIdentifier,
            explanationIdentifier,
            file,
            setUploadProgress,
        });
    };

    const handleFileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click(); // Trigger the file input click
        }
    };

    const handleRemoveQuestionPaper = () => {
        setValue('fileUpload', null as unknown as File);
        setValue('questions', []);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset the file input to clear the selection
        }
    };

    return (
        <>
            <FormProvider {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                    className="no-scrollbar max-h-[60vh] space-y-8 overflow-y-auto p-4 pt-2"
                >
                    {!isFormSubmitting ? (
                        <>
                            {!isManualCreated && (
                                <>
                                    <div className="ml-4 flex flex-col gap-4">
                                        <SelectField
                                            label="Questions"
                                            name="questionsType"
                                            options={QUESTION_LABELS.map((option, index) => ({
                                                value: option,
                                                label: option,
                                                _id: index,
                                            }))}
                                            control={form.control}
                                            required
                                        />
                                        <SelectField
                                            label="Options"
                                            name="optionsType"
                                            options={OPTIONS_LABELS.map((option, index) => ({
                                                value: option,
                                                label: option,
                                                _id: index,
                                            }))}
                                            control={form.control}
                                            required
                                        />
                                        <SelectField
                                            label="Answers"
                                            name="answersType"
                                            options={ANSWER_LABELS.map((option, index) => ({
                                                value: option,
                                                label: option,
                                                _id: index,
                                            }))}
                                            control={form.control}
                                            required
                                        />
                                        <SelectField
                                            label="Explanations"
                                            name="explanationsType"
                                            options={EXPLANATION_LABELS.map((option, index) => ({
                                                value: option,
                                                label: option,
                                                _id: index,
                                            }))}
                                            control={form.control}
                                            required
                                        />
                                    </div>

                                    <div className="flex flex-col gap-6">
                                        <div
                                            className="flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dotted border-primary-500 p-4"
                                            onClick={handleFileSelect}
                                        >
                                            <UploadFileBg className="mb-3" />
                                            <FileUploadComponent
                                                fileInputRef={fileInputRef}
                                                onFileSubmit={handleFileSubmit}
                                                control={form.control}
                                                name="fileUpload"
                                            />
                                        </div>
                                        <h1 className="-mt-4 text-xs text-red-500">
                                            If you are having a problem while uploading docx file
                                            then please convert your file in html{' '}
                                            <a
                                                href="https://wordtohtml.net/convert/docx-to-html"
                                                target="_blank"
                                                className="text-blue-500"
                                                rel="noreferrer"
                                            >
                                                here
                                            </a>{' '}
                                            and try to re-upload.
                                        </h1>
                                    </div>
                                    <div className="flex flex-col gap-6">
                                        <h1 className="-mt-4 text-xs text-red-500">
                                            Step 1 - Go to this website
                                        </h1>
                                        <h1 className="-mt-4 text-xs text-red-500">
                                            Step 2 - Enable embed image
                                        </h1>
                                        <h1 className="-mt-4 text-xs text-red-500">
                                            Step 3 - Download your html file after converting
                                        </h1>
                                        <img src={ConvertToHTML} alt="logo" />
                                    </div>
                                    {getValues('fileUpload') && (
                                        <div className="flex w-full items-center gap-2 rounded-md bg-neutral-100 p-2">
                                            <div className="rounded-md bg-primary-100 p-2">
                                                <File
                                                    size={32}
                                                    fillOpacity={1}
                                                    weight="fill"
                                                    className="text-primary-500"
                                                />
                                            </div>
                                            <div className="flex w-full flex-col">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="break-all text-sm font-bold">
                                                        {getValues('fileUpload')?.name}
                                                    </p>
                                                    <X
                                                        size={16}
                                                        className="mt-[2px] cursor-pointer"
                                                        onClick={handleRemoveQuestionPaper}
                                                    />
                                                </div>

                                                <p className="my-1 whitespace-normal text-xs">
                                                    {(
                                                        (((getValues('fileUpload')?.size || 0) /
                                                            (1024 * 1024)) *
                                                            uploadProgress) /
                                                        100
                                                    ).toFixed(2)}{' '}
                                                    MB /{' '}
                                                    {(
                                                        (getValues('fileUpload')?.size || 0) /
                                                        (1024 * 1024)
                                                    ).toFixed(2)}
                                                    &nbsp;MB
                                                </p>

                                                <div className="flex items-center gap-2">
                                                    <Progress
                                                        value={uploadProgress}
                                                        className="w-full bg-primary-500"
                                                    />
                                                    <span className="text-xs">
                                                        {uploadProgress}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            <CustomInput
                                control={form.control}
                                name="title"
                                label="Title"
                                placeholder="Enter Title"
                                required
                            />
                            <div className="flex items-center gap-4">
                                <SelectField
                                    label="Year/class"
                                    name="yearClass"
                                    options={YearClassFilterData.map((option, index) => ({
                                        value: option.name,
                                        label: option.name,
                                        _id: index,
                                    }))}
                                    control={form.control}
                                    required
                                    className="!w-full"
                                />
                                <SelectField
                                    label="Subject"
                                    name="subject"
                                    options={SubjectFilterData.map((option, index) => ({
                                        value: option.name,
                                        label: option.name,
                                        _id: index,
                                    }))}
                                    control={form.control}
                                    required
                                    className="!w-full"
                                />
                            </div>
                            <div className="flex justify-between">
                                {isProgress ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-52 border-2"
                                    >
                                        Loading...
                                    </Button>
                                ) : (
                                    !isManualCreated &&
                                    fileUpload && (
                                        <QuestionPaperTemplate
                                            form={form}
                                            questionPaperId={questionPaperId}
                                            isViewMode={false}
                                            buttonText="Preview"
                                            currentQuestionIndex={currentQuestionIndex}
                                            setCurrentQuestionIndex={setCurrentQuestionIndex}
                                        />
                                    )
                                )}
                                {isManualCreated && (
                                    <QuestionPaperTemplate
                                        form={form}
                                        questionPaperId={questionPaperId}
                                        isViewMode={false}
                                        isManualCreated={isManualCreated}
                                        buttonText="Add Questions"
                                        currentQuestionIndex={currentQuestionIndex}
                                        setCurrentQuestionIndex={setCurrentQuestionIndex}
                                    />
                                )}
                                {fileUpload && (
                                    <Button
                                        disabled={
                                            isManualCreated
                                                ? !isFormValidWhenManuallyCreated
                                                : !isFormValidWhenUploaded
                                        }
                                        type="submit"
                                        className="ml-[1.8rem] w-56 bg-primary-500 text-white"
                                    >
                                        Done
                                    </Button>
                                )}
                                {!fileUpload && !isManualCreated && (
                                    <Button
                                        disabled={
                                            isManualCreated
                                                ? !isFormValidWhenManuallyCreated
                                                : !isFormValidWhenUploaded
                                        }
                                        type="submit"
                                        className={`w-56 bg-primary-500 text-white`}
                                    >
                                        Done
                                    </Button>
                                )}
                                {!fileUpload && isManualCreated && (
                                    <Button
                                        disabled={
                                            isManualCreated
                                                ? !isFormValidWhenManuallyCreated
                                                : !isFormValidWhenUploaded
                                        }
                                        type="submit"
                                        className={`w-56 bg-primary-500 text-white ${
                                            questions.length > 0 ? 'block' : 'hidden'
                                        }`}
                                    >
                                        Done
                                    </Button>
                                )}
                            </div>
                        </>
                    ) : (
                        <DashboardLoader height="40vh" />
                    )}
                </form>
            </FormProvider>
        </>
    );
};
