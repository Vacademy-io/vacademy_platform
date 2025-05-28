import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Sliders, X } from "phosphor-react";
import { Checkbox } from "@/components/ui/checkbox";
import "react-quill/dist/quill.snow.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PopoverClose } from "@radix-ui/react-popover";
import SelectField from "@/components/design-system/select-field";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { QuestionPaperTemplateFormProps } from "../../../-utils/question-paper-template-form";
import { formatStructure } from "../../../-utils/helper";
import { QUESTION_TYPES } from "@/constants/dummy-data";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export const TrueFalseQuestionPaperTemplateMainView = ({
    form,
    currentQuestionIndex,
    className,
}: QuestionPaperTemplateFormProps) => {
    const { control, getValues, setValue } = form;
    const answersType = getValues("answersType") || "Answer:";
    const explanationsType = getValues("explanationsType") || "Explanation:";
    const optionsType = getValues("optionsType") || "";
    const questionsType = getValues("questionsType") || "";
    const allQuestions = getValues("questions") || [];

    const option1 = getValues(`questions.${currentQuestionIndex}.trueFalseOptions.${0}`);
    const option2 = getValues(`questions.${currentQuestionIndex}.trueFalseOptions.${1}`);
    const tags = getValues(`questions.${currentQuestionIndex}.tags`) || [];
    const level = getValues(`questions.${currentQuestionIndex}.level`) || "";

    const handleOptionChange = (optionIndex: number) => {
        const options = [0, 1];

        // Check current state of the selected option
        const isCurrentlySelected = getValues(
            `questions.${currentQuestionIndex}.trueFalseOptions.${optionIndex}.isSelected`,
        );

        options.forEach((option) => {
            setValue(
                `questions.${currentQuestionIndex}.trueFalseOptions.${option}.isSelected`,
                option === optionIndex ? !isCurrentlySelected : false,
                { shouldDirty: true, shouldValidate: true },
            );
        });
        form.trigger(`questions.${currentQuestionIndex}.trueFalseOptions`);
    };

    useEffect(() => {
        setValue(`questions.${currentQuestionIndex}.trueFalseOptions.${0}.name`, "True");
        setValue(`questions.${currentQuestionIndex}.trueFalseOptions.${1}.name`, "False");
    }, [currentQuestionIndex, setValue]);

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
            {/* options */}
            <div className="flex w-full grow flex-col gap-4">
                <span className="-mb-3">{answersType}</span>
                <div className="flex gap-4">
                    <div
                        className={`flex w-1/2 items-center justify-between gap-4 rounded-md bg-neutral-100 p-4 ${
                            option1?.isSelected ? "border border-primary-300 bg-primary-50" : ""
                        }`}
                    >
                        <div className="flex w-full items-center gap-4">
                            <div className="flex size-10 items-center justify-center rounded-full bg-white px-3">
                                <span className="!p-0 text-sm">
                                    {optionsType ? formatStructure(optionsType, "a") : "(a.)"}
                                </span>
                            </div>
                            <div>True</div>
                            {/* <FormField
                                control={control}
                                name={`questions.${currentQuestionIndex}.trueFalseOptions.${0}.name`}
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <div>{option1.name}</div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            /> */}
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-full bg-white px-4">
                            <FormField
                                control={control}
                                name={`questions.${currentQuestionIndex}.trueFalseOptions.${0}.isSelected`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={() => handleOptionChange(0)}
                                                className={`mt-1 size-5 rounded-xl border-2 shadow-none ${
                                                    field.value
                                                        ? "border-none bg-green-500 text-white" // Blue background and red tick when checked
                                                        : "" // Default styles when unchecked
                                                }`}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                    <div
                        className={`flex w-1/2 items-center justify-between gap-4 rounded-md bg-neutral-100 p-4 ${
                            option2?.isSelected ? "border border-primary-300 bg-primary-50" : ""
                        }`}
                    >
                        <div className="flex w-full items-center gap-4">
                            <div className="flex size-10 items-center justify-center rounded-full bg-white px-3">
                                <span className="!p-0 text-sm">
                                    {optionsType ? formatStructure(optionsType, "b") : "(b.)"}
                                </span>
                            </div>
                            <div>False</div>
                            {/* <FormField
                                control={control}
                                name={`questions.${currentQuestionIndex}.trueFalseOptions.${1}.name`}
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            /> */}
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-full bg-white px-4">
                            <FormField
                                control={control}
                                name={`questions.${currentQuestionIndex}.trueFalseOptions.${1}.isSelected`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={() => handleOptionChange(1)}
                                                className={`mt-1 size-5 rounded-xl border-2 shadow-none ${
                                                    field.value
                                                        ? "border-none bg-green-500 text-white" // Blue background and red tick when checked
                                                        : "" // Default styles when unchecked
                                                }`}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </div>
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
