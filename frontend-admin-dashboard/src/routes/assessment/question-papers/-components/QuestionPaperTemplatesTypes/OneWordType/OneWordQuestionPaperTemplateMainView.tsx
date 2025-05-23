import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Sliders, X } from "phosphor-react";
import "react-quill/dist/quill.snow.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PopoverClose } from "@radix-ui/react-popover";
import SelectField from "@/components/design-system/select-field";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { QuestionPaperTemplateFormProps } from "../../../-utils/question-paper-template-form";
import { formatStructure } from "../../../-utils/helper";
import { QUESTION_TYPES } from "@/constants/dummy-data";
import { MyInput } from "@/components/design-system/input";
import { useEffect } from "react";
import { CollapsibleQuillEditor } from "../CollapsibleQuillEditor";
import { Badge } from "@/components/ui/badge";

export const OneWordQuestionPaperTemplateMainView = ({
    form,
    currentQuestionIndex,
    className,
}: QuestionPaperTemplateFormProps) => {
    const { control, getValues } = form;
    const explanationsType = getValues("explanationsType") || "Explanation:";
    const questionsType = getValues("questionsType") || "";

    const allQuestions = getValues("questions") || [];
    const tags = getValues(`questions.${currentQuestionIndex}.tags`) || [];
    const level = getValues(`questions.${currentQuestionIndex}.level`) || "";

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
            <div className="-mb-8 flex justify-end">
                <Popover>
                    <PopoverTrigger>
                        <Button variant="outline" type="button" className="cursor-pointer px-3">
                            <Sliders size={32} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                        <div className="mb-2 flex flex-col gap-4">
                            <div className="flex w-full items-center justify-between">
                                <h1 className="text-primary-500">Questions Settings</h1>
                                <PopoverClose>
                                    <X size={16} />
                                </PopoverClose>
                            </div>
                            <SelectField
                                label="Question Type"
                                name={`questions.${currentQuestionIndex}.questionType`}
                                options={QUESTION_TYPES.map((option, index) => ({
                                    value: option.code,
                                    label: option.display,
                                    _id: index,
                                }))}
                                control={form.control}
                                className="!w-full"
                                required
                            />
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
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
                <div className="flex items-center gap-2">
                    <span>
                        Question&nbsp;
                        {questionsType
                            ? formatStructure(questionsType, currentQuestionIndex + 1)
                            : currentQuestionIndex + 1}
                    </span>
                    <Badge variant="outline">{level}</Badge>
                </div>
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
                <div className="mt-2 flex items-center gap-2">
                    {tags?.map((tag, idx) => {
                        return (
                            <Badge variant="outline" key={idx}>
                                {tag}
                            </Badge>
                        );
                    })}
                </div>
            </div>

            <div className="flex w-full flex-col gap-4">
                <span>Answer</span>

                <FormField
                    control={control}
                    name={`questions.${currentQuestionIndex}.subjectiveAnswerText`}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <div className="flex flex-row flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <MyInput
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                        />
                                    </div>
                                </div>
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
