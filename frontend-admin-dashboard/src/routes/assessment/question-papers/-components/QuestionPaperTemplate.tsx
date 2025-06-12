import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DotsSixVertical, Plus, X } from "phosphor-react";
import { useState } from "react";
import { useFieldArray } from "react-hook-form";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sortable, SortableDragHandle, SortableItem } from "@/components/ui/sortable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PPTComponentFactory } from "./QuestionPaperTemplatesTypes/PPTComponentFactory";
import { MainViewComponentFactory } from "./QuestionPaperTemplatesTypes/MainViewComponentFactory";
import { QuestionPaperTemplateProps } from "@/types/assessments/question-paper-template";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getQuestionPaperById, updateQuestionPaper } from "../-utils/question-paper-services";
import {
    getIdByLevelName,
    getIdBySubjectName,
    transformResponseDataToMyQuestionsSchema,
    getPPTViewTitle,
} from "../-utils/helper";
import {
    MyQuestion,
    MyQuestionPaperFormEditInterface,
    MyQuestionPaperFormInterface,
} from "../../../../types/assessments/question-paper-form";
import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";
import { toast } from "sonner";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { QuestionPaperEditDialog } from "./QuestionPaperEditDialogue";
import { useRefetchStore } from "../-global-states/refetch-store";
import useInstituteLogoStore from "@/components/common/layout-container/sidebar/institutelogo-global-zustand";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { QuestionType } from "@/constants/dummy-data";
import { QuestionTypeSelection } from "./QuestionTypeSelection";
import { DialogClose } from "@radix-ui/react-dialog";

export function QuestionPaperTemplate({
    form,
    questionPaperId,
    isViewMode,
    isManualCreated,
    buttonText,
    isAssessment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
}: QuestionPaperTemplateProps) {
    console.log(form.getValues());
    const [isQuestionPaperTemplateDialog, setIsQuestionPaperTemplateDialog] = useState(false);
    const { instituteLogo } = useInstituteLogoStore();
    const { handleRefetchData } = useRefetchStore();
    const queryClient = useQueryClient();
    const { instituteDetails } = useInstituteDetailsStore();
    const [addQuestionDialogBox, setAddQuestionDialogBox] = useState(false);
    const { control, getValues, setValue, formState, watch } = form;
    const questions = watch("questions") || [];
    const title = getValues("title") || "";
    const yearClass = getValues("yearClass") || "";
    const subject = getValues("subject") || "";
    const [isQuestionDataLoading, setIsQuestionDataLoading] = useState(false);
    const [previousQuestionPaperData, setPreviousQuestionPaperData] = useState(
        {} as MyQuestionPaperFormEditInterface,
    );

    watch(`questions.${currentQuestionIndex}`);
    watch(`questions.${currentQuestionIndex}.questionType`);

    // UseFieldArray to manage questions array
    const { fields, append, move } = useFieldArray({
        control: form.control,
        name: "questions", // Name of the field array
    });

    // Function to handle adding a new question
    const handleAddNewQuestion = (newQuestionType: string) => {
        append({
            questionId: String(questions.length + 1),
            questionName: "",
            explanation: "",
            questionType: newQuestionType,
            questionPenalty: "",
            questionDuration: {
                hrs: "",
                min: "",
            },
            questionMark: "",
            singleChoiceOptions: [
                {
                    name: "",
                    isSelected: false,
                },
                {
                    name: "",
                    isSelected: false,
                },
                {
                    name: "",
                    isSelected: false,
                },
                {
                    name: "",
                    isSelected: false,
                },
            ],
            multipleChoiceOptions: [
                {
                    name: "",
                    isSelected: false,
                },
                {
                    name: "",
                    isSelected: false,
                },
                {
                    name: "",
                    isSelected: false,
                },
                {
                    name: "",
                    isSelected: false,
                },
            ],
        });
        setCurrentQuestionIndex(0);
        setAddQuestionDialogBox(false);
        form.trigger();
    };

    // Function to handle page navigation by question number
    const handlePageClick = (pageIndex: number) => {
        setCurrentQuestionIndex(pageIndex);
        form.trigger();
    };

    const handleUpdateQuestionPaper = useMutation({
        mutationFn: ({
            data,
            previousQuestionPaperData,
        }: {
            data: MyQuestionPaperFormInterface;
            previousQuestionPaperData: MyQuestionPaperFormEditInterface;
        }) => updateQuestionPaper(data, previousQuestionPaperData),
        onSuccess: () => {
            setCurrentQuestionIndex(0);
            handleRefetchData();
            toast.success("Question Paper updated successfully", {
                className: "success-toast",
                duration: 2000,
            });
            setIsQuestionPaperTemplateDialog(false);
            queryClient.invalidateQueries({ queryKey: ["GET_QUESTION_PAPER_FILTERED_DATA"] });
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleSaveClick = (values: MyQuestionPaperFormInterface) => {
        const changedValues = {
            ...values,
            ...(values.yearClass !== "N/A" && {
                yearClass: getIdByLevelName(instituteDetails?.levels || [], yearClass),
            }),
            ...(values.subject !== "N/A" && {
                subject: getIdBySubjectName(instituteDetails?.subjects || [], subject),
            }),
        };
        handleUpdateQuestionPaper.mutate({ data: changedValues, previousQuestionPaperData });
    };

    const handleMutationViewQuestionPaper = useMutation({
        mutationFn: ({ questionPaperId }: { questionPaperId: string | undefined }) =>
            getQuestionPaperById(questionPaperId),
        onMutate: () => {
            setIsQuestionDataLoading(true);
        },
        onSettled: () => {
            setIsQuestionDataLoading(false);
        },
        onSuccess: async (data) => {
            const transformQuestionsData: MyQuestion[] = transformResponseDataToMyQuestionsSchema(
                data.question_dtolist,
            );
            setPreviousQuestionPaperData({
                questionPaperId: questionPaperId,
                title: title,
                ...(data.yearClass !== "N/A" && {
                    level_id: getIdByLevelName(instituteDetails?.levels || [], yearClass),
                }),
                ...(data.subject !== "N/A" && {
                    subject_id: getIdBySubjectName(instituteDetails?.subjects || [], subject),
                }),
                questions: transformQuestionsData,
            });
            setValue("questions", transformQuestionsData);
            queryClient.invalidateQueries({ queryKey: ["GET_QUESTION_PAPER_FILTERED_DATA"] });
        },
        onError: (error: unknown) => {
            setIsQuestionDataLoading(false);
            throw error;
        },
    });

    const handleViewQuestionPaper = () => {
        handleMutationViewQuestionPaper.mutate({ questionPaperId });
    };

    const handleTriggerForm = () => {
        form.trigger();
        if (Object.values(form.formState.errors).length > 0) {
            toast.error("some of your questions are incomplete or needs attentions!", {
                className: "error-toast",
                duration: 3000,
            });
            return;
        }
        setIsQuestionPaperTemplateDialog(false);
    };

    return (
        <Dialog
            open={isQuestionPaperTemplateDialog}
            onOpenChange={setIsQuestionPaperTemplateDialog}
        >
            <DialogTrigger>
                {isViewMode ? (
                    <Button
                        type="button"
                        variant="outline"
                        className={`m-0 border-none pl-2 font-normal shadow-none ${
                            isAssessment ? "text-primary-500" : ""
                        }`}
                        onClick={handleViewQuestionPaper}
                    >
                        {buttonText}
                    </Button>
                ) : (
                    <Button type="button" variant="outline" className="w-52 border">
                        {isManualCreated ? (
                            <p className="flex items-center gap-1">
                                {buttonText} <Plus className="!size-4" />
                            </p>
                        ) : (
                            buttonText
                        )}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="no-scrollbar !m-0 !h-screen !w-full !max-w-full !gap-0 !overflow-hidden overflow-y-auto !rounded-none !p-0 [&>button]:hidden">
                {isQuestionDataLoading ? (
                    <DashboardLoader />
                ) : (
                    <div>
                        <div className="flex w-screen items-center justify-between bg-primary-100 p-2">
                            <div className="flex items-start gap-2">
                                <img
                                    src={instituteLogo}
                                    alt="logo"
                                    className="size-12 rounded-full"
                                />
                                <FormField
                                    control={control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    className="rounded-none border-none p-0 !text-[1.2rem] shadow-none focus-visible:ring-0 focus-visible:ring-transparent"
                                                    placeholder="Untitled"
                                                    disabled
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <QuestionPaperEditDialog form={form} />
                            </div>
                            <div className="flex items-center gap-4">
                                <Button
                                    type="submit"
                                    variant="outline"
                                    className="w-44 bg-transparent shadow-none hover:bg-transparent"
                                    onClick={
                                        isViewMode
                                            ? () =>
                                                  handleSaveClick(
                                                      form.getValues() as MyQuestionPaperFormInterface,
                                                  )
                                            : handleTriggerForm
                                    }
                                >
                                    Save
                                </Button>
                                <DialogClose>
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        className="w-44 bg-transparent shadow-none hover:bg-transparent"
                                    >
                                        Exit
                                    </Button>
                                </DialogClose>
                            </div>
                        </div>
                        <div className="flex h-screen items-start">
                            <div className="mt-4 flex w-40 flex-col items-center justify-center gap-2">
                                <AlertDialog
                                    open={addQuestionDialogBox}
                                    onOpenChange={setAddQuestionDialogBox}
                                >
                                    <AlertDialogTrigger>
                                        <Button
                                            type="button"
                                            className="max-w-sm bg-primary-500 text-xs text-white shadow-none"
                                        >
                                            Add Question
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="h-[80%] overflow-y-auto p-0">
                                        <div className="sticky top-0 flex items-center justify-between rounded-md bg-primary-50">
                                            <h1 className="rounded-sm p-4 font-bold text-primary-500">
                                                Add Question
                                            </h1>
                                            <AlertDialogCancel
                                                onClick={() => setAddQuestionDialogBox(false)}
                                                className="border-none bg-primary-50 shadow-none hover:bg-primary-50"
                                            >
                                                <X className="text-neutral-600" />
                                            </AlertDialogCancel>
                                        </div>
                                        <QuestionTypeSelection
                                            currentQuestionIndex={currentQuestionIndex}
                                            setCurrentQuestionIndex={setCurrentQuestionIndex}
                                            isDirectAdd={false}
                                            handleSelect={handleAddNewQuestion}
                                        ></QuestionTypeSelection>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <div className="flex h-[325vh] w-40 flex-col items-start justify-between gap-4 overflow-x-hidden overflow-y-scroll p-2">
                                    <Sortable
                                        value={fields}
                                        onMove={({ activeIndex, overIndex }) =>
                                            move(activeIndex, overIndex)
                                        }
                                    >
                                        <div className="flex origin-top-left scale-[0.26] flex-col gap-8 overflow-x-hidden">
                                            {fields.map((field, index) => {
                                                // Check if the current question has an error
                                                const hasError =
                                                    formState.errors?.questions?.[index];
                                                return (
                                                    <SortableItem
                                                        key={field.id}
                                                        value={field.id}
                                                        asChild
                                                    >
                                                        <div
                                                            key={index}
                                                            // onClick={() => handlePageClick(index)}
                                                            className={`rounded-xl border-4 bg-primary-50 p-6 ${
                                                                currentQuestionIndex === index
                                                                    ? "border-primary-500 bg-none"
                                                                    : "bg-none"
                                                            }`}
                                                            onMouseEnter={() =>
                                                                handlePageClick(index)
                                                            }
                                                        >
                                                            <TooltipProvider>
                                                                <Tooltip
                                                                    open={hasError ? true : false}
                                                                >
                                                                    <TooltipTrigger>
                                                                        <div className="flex flex-col">
                                                                            <div className="flex items-center justify-start gap-4">
                                                                                <h1 className="left-0 w-96 whitespace-nowrap text-4xl font-bold">
                                                                                    {index + 1}
                                                                                    &nbsp;
                                                                                    {getPPTViewTitle(
                                                                                        getValues(
                                                                                            `questions.${index}.questionType`,
                                                                                        ) as QuestionType,
                                                                                    )}
                                                                                </h1>
                                                                                <SortableDragHandle
                                                                                    variant="outline"
                                                                                    size="icon"
                                                                                    className="size-16"
                                                                                >
                                                                                    <DotsSixVertical className="!size-12" />
                                                                                </SortableDragHandle>
                                                                            </div>
                                                                            <PPTComponentFactory
                                                                                key={index}
                                                                                type={
                                                                                    getValues(
                                                                                        `questions.${index}.questionType`,
                                                                                    ) as QuestionType
                                                                                }
                                                                                props={{
                                                                                    form: form,
                                                                                    currentQuestionIndex:
                                                                                        index,
                                                                                    setCurrentQuestionIndex:
                                                                                        setCurrentQuestionIndex,
                                                                                    className:
                                                                                        "relative mt-4 rounded-xl border-4 border-primary-300 bg-white p-4",
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    {hasError && (
                                                                        <TooltipContent
                                                                            className="ml-3 border-2 border-danger-400 bg-primary-50"
                                                                            side="right"
                                                                        >
                                                                            <p>
                                                                                Question isn&apos;t
                                                                                complete
                                                                            </p>
                                                                        </TooltipContent>
                                                                    )}
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                    </SortableItem>
                                                );
                                            })}
                                        </div>
                                    </Sortable>
                                </div>
                            </div>
                            <Separator orientation="vertical" className="min-h-screen" />
                            {questions.length === 0 ? (
                                <div className="flex h-screen w-screen items-center justify-center">
                                    <h1>No Question Exists.</h1>
                                </div>
                            ) : (
                                <MainViewComponentFactory
                                    key={currentQuestionIndex}
                                    type={
                                        getValues(
                                            `questions.${currentQuestionIndex}.questionType`,
                                        ) as QuestionType
                                    }
                                    props={{
                                        form: form,
                                        currentQuestionIndex: currentQuestionIndex,
                                        setCurrentQuestionIndex: setCurrentQuestionIndex,
                                        className:
                                            "dialog-height overflow-auto ml-6 flex w-full flex-col gap-6 pr-6 pt-4",
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
