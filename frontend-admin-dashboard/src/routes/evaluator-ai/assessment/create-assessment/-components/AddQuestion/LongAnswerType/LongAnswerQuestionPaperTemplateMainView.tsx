import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import "react-quill/dist/quill.snow.css";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { formatStructure } from "@/routes/assessment/question-papers/-utils/helper";
import { useEffect } from "react";
import { CollapsibleQuillEditor } from "../CollapsibleQuillEditor";
import { QuestionPaperTemplateFormProps } from "../MainViewComponentFactory";

export const LongAnswerQuestionPaperTemplateMainView = ({
    form,
    currentQuestionIndex,
    className,
}: QuestionPaperTemplateFormProps) => {
    const { control, getValues } = form;
    const explanationsType = getValues("explanationsType") || "Explanation:";
    const questionsType = getValues("questionsType") || "";
    const allQuestions = getValues("questions") || [];

    useEffect(() => {
        const validAnswrs = form.getValues(`questions.${currentQuestionIndex}.validAnswers`);
        if (!validAnswrs) {
            form.setValue(`questions.${currentQuestionIndex}.validAnswers`, [0]);
        }
    }, []);

    if (allQuestions.length === 0) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <h1>Please add a question to show question details</h1>
            </div>
        );
    }

    return (
        <div className={className}>
            {getValues(`questions.${currentQuestionIndex}.parentRichTextContent`) && (
                <div className="flex w-full flex-col !flex-nowrap items-start gap-1">
                    <span>Comprehension Text</span>
                    <FormField
                        control={control}
                        name={`questions.${currentQuestionIndex}.parentRichTextContent`}
                        render={({ field }) => (
                            <FormItem className="w-full">
                                <FormControl>
                                    <CollapsibleQuillEditor
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            )}
            <div className="flex w-full flex-col !flex-nowrap items-start gap-1">
                <span>
                    Question&nbsp;
                    {questionsType
                        ? formatStructure(questionsType, currentQuestionIndex + 1)
                        : currentQuestionIndex + 1}
                </span>
                <FormField
                    control={control}
                    name={`questions.${currentQuestionIndex}.questionName`}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <MainViewQuillEditor
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="flex w-full flex-col !flex-nowrap items-start gap-1">
                <span>Answer</span>
                <FormField
                    control={control}
                    name={`questions.${currentQuestionIndex}.subjectiveAnswerText`}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <MainViewQuillEditor
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="mb-6 flex w-full flex-col !flex-nowrap items-start gap-1">
                <span>{explanationsType}</span>
                <FormField
                    control={control}
                    name={`questions.${currentQuestionIndex}.explanation`}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <MainViewQuillEditor
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};
