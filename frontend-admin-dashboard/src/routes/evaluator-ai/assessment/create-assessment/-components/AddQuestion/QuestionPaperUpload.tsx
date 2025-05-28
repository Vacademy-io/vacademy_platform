import { Dispatch, SetStateAction, useRef, useState } from "react";
import { uploadQuestionPaperFormSchema } from "../../-utils/upload-question-paper-form-schema";
import { z } from "zod";
import { FormProvider, useForm, UseFormReturn } from "react-hook-form";
import SelectField from "@/components/design-system/select-field";
import { UploadFileBg } from "@/svgs";
import { FileUploadComponent } from "@/components/design-system/file-upload";
import { File, X } from "phosphor-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { QuestionPaperTemplate } from "./QuestionPaperTemplate";
import { useMutation } from "@tanstack/react-query";
import { uploadDocsFile } from "@/routes/assessment/question-papers/-services/question-paper-services";
import { toast } from "sonner";
import { transformResponseDataToMyQuestionsSchema } from "@/routes/assessment/question-papers/-utils/helper";
import {
    ANSWER_LABELS,
    EXPLANATION_LABELS,
    OPTIONS_LABELS,
    QUESTION_LABELS,
} from "@/constants/dummy-data";
import useDialogStore from "@/routes/assessment/question-papers/-global-states/question-paper-dialogue-close";
import sectionDetailsSchema from "../../-utils/section-details-sechma";
import { zodResolver } from "@hookform/resolvers/zod";
import ConvertToHTML from "@/routes/assessment/question-papers/-images/convertToHTML.png";

export type SectionFormType = z.infer<typeof sectionDetailsSchema>;
export type UploadQuestionPaperFormType = z.infer<typeof uploadQuestionPaperFormSchema>;
interface QuestionPaperUploadProps {
    isManualCreated: boolean;
    index?: number;
    sectionsForm?: UseFormReturn<SectionFormType>;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
}

export const QuestionPaperUpload = ({
    isManualCreated,
    index,
    sectionsForm,
    currentQuestionIndex,
    setCurrentQuestionIndex,
}: QuestionPaperUploadProps) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const form = useForm<UploadQuestionPaperFormType>({
        resolver: zodResolver(uploadQuestionPaperFormSchema),
        mode: "onChange",
        defaultValues: {
            questionPaperId: "1",
            createdOn: new Date(),
            questionsType: "",
            optionsType: "",
            answersType: "",
            explanationsType: "",
            fileUpload: undefined,
            questions: [],
        },
    });
    const { getValues, setValue, watch } = form;

    const questionPaperId = getValues("questionPaperId");
    const questionIdentifier = getValues("questionsType");
    const optionIdentifier = getValues("optionsType");
    const answerIdentifier = getValues("answersType");
    const explanationIdentifier = getValues("explanationsType");
    const fileUpload = getValues("fileUpload");
    const questions = getValues("questions");
    watch("fileUpload");

    const [uploadProgress, setUploadProgress] = useState(0);
    const [isProgress, setIsProgress] = useState(false);
    const {
        setIsMainQuestionPaperAddDialogOpen,
        setIsManualQuestionPaperDialogOpen,
        setIsUploadFromDeviceDialogOpen,
    } = useDialogStore();

    function onSubmit(values: z.infer<typeof uploadQuestionPaperFormSchema>) {
        console.log("get questions ", getValues("questions"));
        console.log("values ", values);
        setCurrentQuestionIndex(0);
        if (index !== undefined) {
            const ques = values.questions.map((question) => ({
                questionId: question.questionId,
                questionName: question.questionName,
                questionMark: question.questionMark,
                validAnswers: question.subjectiveAnswerText,
                parentRichText: question.parentRichTextContent,
            }));
            sectionsForm?.setValue(`section.${index}.adaptive_marking_for_each_question`, ques);
            toast.success("Question Paper added successfully", {
                className: "success-toast",
                duration: 2000,
            });
            sectionsForm?.trigger(`section.${index}.adaptive_marking_for_each_question`);
            console.log(sectionsForm?.getValues(`section.${index}`));
        }
        setIsMainQuestionPaperAddDialogOpen(false);
        setIsManualQuestionPaperDialogOpen(false);
        setIsUploadFromDeviceDialogOpen(false);
        if (index !== undefined) {
            sectionsForm?.setValue(`section.${index}`, {
                ...sectionsForm?.getValues(`section.${index}`), // Keep other section data intact
                sectionName: "Section 1",
            });
        }
    }

    const onInvalid = (err: unknown) => {
        console.error(err);
        toast.error("some of your questions are incomplete or needs attentions!", {
            className: "error-toast",
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
                setUploadProgress,
            ),
        onMutate: () => {
            setIsProgress(true);
        },
        onSettled: () => {
            setIsProgress(false);
        },
        onSuccess: async (data) => {
            const transformQuestionsData = transformResponseDataToMyQuestionsSchema(data);
            setValue("questions", transformQuestionsData);
            console.log("question ", getValues("questions"));
            if (index !== undefined) {
                sectionsForm?.setValue(`section.${index}`, {
                    ...sectionsForm?.getValues(`section.${index}`), // Keep other section data intact
                    adaptive_marking_for_each_question: transformQuestionsData.map((question) => ({
                        questionId: question.questionId,
                        questionName: question.questionName,
                        questionMark: question.questionMark,
                        validAnswers: question.validAnswers,
                        parentRichText: question.parentRichTextContent,
                        subjectiveAnswerText: question.subjectiveAnswerText,
                    })),
                });
            }
            form.trigger("questions");
        },
        onError: (error: unknown) => {
            toast.error(error as string);
        },
    });

    const handleFileSubmit = (file: File) => {
        setValue("fileUpload", file);
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
        setValue("fileUpload", null as unknown as File);
        setValue("questions", []);
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset the file input to clear the selection
        }
    };
    return (
        <>
            <FormProvider {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                    className="no-scrollbar max-h-[60vh] space-y-8 overflow-y-auto p-4 pt-2"
                >
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
                                    If you are having a problem while uploading docx file then
                                    please convert your file in html{" "}
                                    <a
                                        href="https://wordtohtml.net/convert/docx-to-html"
                                        target="_blank"
                                        className="text-blue-500"
                                        rel="noreferrer"
                                    >
                                        here
                                    </a>{" "}
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
                            {getValues("fileUpload") && (
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
                                                {getValues("fileUpload")?.name}
                                            </p>
                                            <X
                                                size={16}
                                                className="mt-[2px] cursor-pointer"
                                                onClick={handleRemoveQuestionPaper}
                                            />
                                        </div>

                                        <p className="my-1 whitespace-normal text-xs">
                                            {(
                                                (((getValues("fileUpload")?.size || 0) /
                                                    (1024 * 1024)) *
                                                    uploadProgress) /
                                                100
                                            ).toFixed(2)}{" "}
                                            MB /{" "}
                                            {(
                                                (getValues("fileUpload")?.size || 0) /
                                                (1024 * 1024)
                                            ).toFixed(2)}
                                            &nbsp;MB
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <Progress
                                                value={uploadProgress}
                                                className="w-full bg-primary-500"
                                            />
                                            <span className="text-xs">{uploadProgress}%</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="flex justify-between">
                        {isProgress ? (
                            <Button type="button" variant="outline" className="w-52 border-2">
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
                                disabled={!!fileUpload}
                                type="submit"
                                className="ml-[1.8rem] w-56 bg-primary-500 text-white"
                            >
                                Done
                            </Button>
                        )}
                        {!fileUpload && !isManualCreated && (
                            <Button
                                disabled={!!fileUpload}
                                type="submit"
                                className={`w-56 bg-primary-500 text-white`}
                            >
                                Done
                            </Button>
                        )}
                        {!fileUpload && isManualCreated && (
                            <Button
                                disabled={!!fileUpload}
                                type="submit"
                                className={`w-56 bg-primary-500 text-white ${
                                    questions.length > 0 ? "block" : "hidden"
                                }`}
                            >
                                Done
                            </Button>
                        )}
                    </div>
                </form>
            </FormProvider>
        </>
    );
};
