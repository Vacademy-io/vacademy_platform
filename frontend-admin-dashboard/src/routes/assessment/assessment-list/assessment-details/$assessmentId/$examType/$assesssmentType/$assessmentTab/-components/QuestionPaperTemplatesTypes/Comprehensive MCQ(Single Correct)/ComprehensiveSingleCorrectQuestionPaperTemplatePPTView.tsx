import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Sliders, X } from "phosphor-react";
import { Checkbox } from "@/components/ui/checkbox";
import "react-quill/dist/quill.snow.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PopoverClose } from "@radix-ui/react-popover";
import SelectField from "@/components/design-system/select-field";
import CustomInput from "@/components/design-system/custom-input";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { QUESTION_TYPES } from "@/constants/dummy-data";
import { SectionQuestionPaperFormProps } from "../../../-utils/assessment-question-paper";
import { formatStructure } from "@/routes/assessment/question-papers/-utils/helper";

interface ImageDetail {
    imageId: string;
    imageName: string;
    imageTitle: string;
    imageFile: string;
    isDeleted: boolean;
}

interface ChoiceOption {
    name: string;
    isSelected: boolean;
    image: ImageDetail;
}

export const ComprehensiveSingleCorrectQuestionPaperTemplatePPTView = ({
    form,
    currentQuestionIndex,
    className,
    selectedSectionIndex,
}: SectionQuestionPaperFormProps) => {
    const { control, getValues, setValue } = form;
    const answersType = "Answer:";
    const explanationsType = "Explanation:";
    const optionsType = "";
    const questionsType = "";

    const option1 = getValues(
        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${0}`,
    ) as ChoiceOption;
    const option2 = getValues(
        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${1}`,
    ) as ChoiceOption;
    const option3 = getValues(
        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${2}`,
    ) as ChoiceOption;
    const option4 = getValues(
        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${3}`,
    ) as ChoiceOption;

    const handleOptionChange = (optionIndex: number) => {
        const options = [0, 1, 2, 3];

        // Check current state of the selected option
        const isCurrentlySelected = getValues(
            `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${optionIndex}.isSelected`,
        );

        options.forEach((option) => {
            setValue(
                `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${option}.isSelected`,
                option === optionIndex ? !isCurrentlySelected : false, // Toggle only the selected option
            );
        });
    };

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
                            <CustomInput
                                control={form.control}
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.questionMark`}
                                label="Marks"
                                required
                            />
                            <CustomInput
                                control={form.control}
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.questionPenalty`}
                                label="Negative Marking"
                                required
                            />
                            <div className="flex flex-col gap-2">
                                <h1 className="text-sm font-semibold">Time Limit</h1>
                                <div className="flex items-center gap-4 text-sm">
                                    <CustomInput
                                        control={form.control}
                                        name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.questionDuration.hrs`}
                                        label=""
                                        className="w-10"
                                    />
                                    <span>hrs</span>
                                    <span>:</span>
                                    <CustomInput
                                        control={form.control}
                                        name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.questionDuration.min`}
                                        label=""
                                        className="w-10"
                                    />
                                    <span>min</span>
                                </div>
                            </div>
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
                            {
                                <FormField
                                    control={control}
                                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${0}.name`}
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
                            }
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-full bg-white px-4">
                            <FormField
                                control={control}
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${0}.isSelected`}
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
                            {
                                <FormField
                                    control={control}
                                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${1}.name`}
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
                            }
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-full bg-white px-4">
                            <FormField
                                control={control}
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${1}.isSelected`}
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
                <div className="flex gap-4">
                    <div
                        className={`flex w-1/2 items-center justify-between gap-4 rounded-md bg-neutral-100 p-4 ${
                            option3?.isSelected ? "border border-primary-300 bg-primary-50" : ""
                        }`}
                    >
                        <div className="flex w-full items-center gap-4">
                            <div className="flex size-10 items-center justify-center rounded-full bg-white px-3">
                                <span className="!p-0 text-sm">
                                    {optionsType ? formatStructure(optionsType, "c") : "(c.)"}
                                </span>
                            </div>
                            {
                                <FormField
                                    control={control}
                                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${2}.name`}
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
                            }
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-full bg-white px-4">
                            <FormField
                                control={control}
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${2}.isSelected`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={() => handleOptionChange(2)}
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
                            option4?.isSelected ? "border border-primary-300 bg-primary-50" : ""
                        }`}
                    >
                        <div className="flex w-full items-center gap-4">
                            <div className="flex size-10 items-center justify-center rounded-full bg-white px-3">
                                <span className="!p-0 text-sm">
                                    {optionsType ? formatStructure(optionsType, "d") : "(d.)"}
                                </span>
                            </div>
                            {
                                <FormField
                                    control={control}
                                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${3}.name`}
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
                            }
                        </div>
                        <div className="flex size-10 items-center justify-center rounded-full bg-white px-4">
                            <FormField
                                control={control}
                                name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.singleChoiceOptions.${3}.isSelected`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={() => handleOptionChange(3)}
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
