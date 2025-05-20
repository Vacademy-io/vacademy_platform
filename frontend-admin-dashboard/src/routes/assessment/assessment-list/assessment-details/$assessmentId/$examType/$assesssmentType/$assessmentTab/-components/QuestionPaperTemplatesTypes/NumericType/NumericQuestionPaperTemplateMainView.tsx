import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Sliders, X, Plus } from "phosphor-react";
import { Checkbox } from "@/components/ui/checkbox";
import "react-quill/dist/quill.snow.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PopoverClose } from "@radix-ui/react-popover";
import SelectField from "@/components/design-system/select-field";
import CustomInput from "@/components/design-system/custom-input";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { QUESTION_TYPES, NUMERIC_TYPES } from "@/constants/dummy-data";
import { MyInput } from "@/components/design-system/input";
import { useState, useEffect } from "react";
import { useWatch } from "react-hook-form";
import { SectionQuestionPaperFormProps } from "../../../-utils/assessment-question-paper";
import { CollapsibleQuillEditor } from "@/routes/assessment/question-papers/-components/QuestionPaperTemplatesTypes/CollapsibleQuillEditor";
import { formatStructure } from "@/routes/assessment/question-papers/-utils/helper";

export const NumericQuestionPaperTemplateMainView = ({
    form,
    currentQuestionIndex,
    className,
    selectedSectionIndex,
}: SectionQuestionPaperFormProps) => {
    const [isMultipleAnswersAllowed, setIsMultipleAnswersAllowed] = useState(false);

    const { control, getValues, trigger, watch } = form;

    const numericType = watch(
        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.numericType`,
    );
    const validAnswers = watch(
        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.validAnswers`,
    );
    useEffect(() => {
        if (validAnswers && validAnswers?.length > 1) setIsMultipleAnswersAllowed(true);
    });
    useEffect(() => {
        trigger(`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.validAnswers`);
    }, [numericType, currentQuestionIndex, trigger]);
    const formValues = useWatch({ control });
    useEffect(() => {
        console.log("Form data changed: ", formValues);
    }, [formValues]);
    const answersType = "Answer:";
    const explanationsType = "Explanation:";
    const questionsType = "";

    useEffect(() => {
        const validAnswrs = form.getValues(
            `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.validAnswers`,
        );
        if (!validAnswrs) {
            form.setValue(
                `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.validAnswers`,
                [0],
            );
        }
    }, []);

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
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.questionType`}
                                options={QUESTION_TYPES.map((option, index) => ({
                                    value: option.code,
                                    label: option.display,
                                    _id: index,
                                }))}
                                control={form.control}
                                className="!w-full"
                                required
                            />
                            <SelectField
                                label="Numerical Type"
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.numericType`}
                                options={NUMERIC_TYPES.map((option, index) => ({
                                    value: option,
                                    label: option,
                                    _id: index,
                                }))}
                                control={form.control}
                                className="!w-full"
                                required
                            />
                            <CustomInput
                                control={form.control}
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.decimals`}
                                label="Decimal Precision"
                                required
                            />
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            {getValues(
                `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.parentRichTextContent`,
            ) && (
                <div className="flex w-full flex-col !flex-nowrap items-start gap-1">
                    <span>Comprehension Text</span>
                    <FormField
                        control={control}
                        name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.parentRichTextContent`}
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
                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.questionName`}
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

            <div className="flex w-full flex-col gap-4">
                <FormField
                    control={control}
                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.validAnswers`}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <div className="flex flex-row justify-between">
                                    <div>{answersType}</div>
                                    <div className="flex flex-row items-center gap-2">
                                        <Checkbox
                                            checked={isMultipleAnswersAllowed}
                                            onCheckedChange={(checked) => {
                                                // const check =
                                                //     !!checked ||
                                                //     (validAnswers
                                                //         ? validAnswers?.length > 1
                                                //         : false);
                                                setIsMultipleAnswersAllowed(!!checked);
                                                if (!checked) {
                                                    // If unchecked, keep only the first answer
                                                    form.setValue(
                                                        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.validAnswers`,
                                                        field.value ? [field.value[0] || 0] : [0],
                                                    );
                                                }
                                            }}
                                        />
                                        <div>Contains Multiple Answers</div>
                                    </div>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.validAnswers`}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <div className="flex flex-row flex-wrap items-center gap-4">
                                    {Array.isArray(field.value) &&
                                        field.value.map((answer, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                {/* Input for each validAnswer */}
                                                <MyInput
                                                    input={answer.toString()}
                                                    onChangeFunction={(e) => {
                                                        const updatedAnswers = [
                                                            ...(field.value ?? []),
                                                        ];
                                                        updatedAnswers[index] =
                                                            parseFloat(e.target.value) || 0; // Ensure number
                                                        field.onChange(updatedAnswers);
                                                    }}
                                                    inputType="number"
                                                />
                                                {/* Remove button for each answer */}
                                                {isMultipleAnswersAllowed && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            field.onChange(
                                                                field.value?.filter(
                                                                    (_, i) => i !== index,
                                                                ),
                                                            );
                                                        }}
                                                    >
                                                        <X />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    {/* Add new answer */}
                                    {isMultipleAnswersAllowed && (
                                        <Button
                                            variant="outline"
                                            type="button"
                                            className="cursor-pointer"
                                            onClick={() => {
                                                field.onChange([...(field.value || []), 0]);
                                            }}
                                        >
                                            <Plus size={20} />
                                        </Button>
                                    )}
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
                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.explanation`}
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
