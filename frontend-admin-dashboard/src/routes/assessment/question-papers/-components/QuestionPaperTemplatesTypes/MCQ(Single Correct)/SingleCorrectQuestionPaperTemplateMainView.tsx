import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Plus, Sliders, Trash, X } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import 'react-quill/dist/quill.snow.css';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PopoverClose } from '@radix-ui/react-popover';
import SelectField from '@/components/design-system/select-field';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { QuestionPaperTemplateFormProps } from '../../../-utils/question-paper-template-form';
import { formatStructure } from '../../../-utils/helper';
import { QUESTION_TYPES } from '@/constants/dummy-data';
import { Badge } from '@/components/ui/badge';

export const SingleCorrectQuestionPaperTemplateMainView = ({
    form,
    currentQuestionIndex,
    className,
    showQuestionNumber = true,
    examType,
}: QuestionPaperTemplateFormProps) => {
    console.log('🎯 SingleCorrectQuestionPaperTemplateMainView rendered', {
        examType,
        currentQuestionIndex,
        isSurvey: examType === 'SURVEY'
    });
    const { control, getValues, setValue } = form;
    const answersType = getValues('answersType') || 'Answer:';
    const explanationsType = getValues('explanationsType') || 'Explanation:';
    const optionsType = getValues('optionsType') || '';
    const questionsType = getValues('questionsType') || '';
    const allQuestions = getValues('questions') || [];

    const options: any[] = getValues(`questions.${currentQuestionIndex}.singleChoiceOptions`) || [];
    const tags = getValues(`questions.${currentQuestionIndex}.tags`) || [];
    const level = getValues(`questions.${currentQuestionIndex}.level`) || '';

    const handleOptionChange = (optionIndex: number) => {
        if (examType === 'SURVEY') return;

        const isCurrentlySelected = getValues(
            `questions.${currentQuestionIndex}.singleChoiceOptions.${optionIndex}.isSelected`
        );

        options.forEach((_, i) => {
            setValue(
                `questions.${currentQuestionIndex}.singleChoiceOptions.${i}.isSelected`,
                i === optionIndex ? !isCurrentlySelected : false,
                { shouldDirty: true, shouldValidate: true }
            );
        });
        form.trigger(`questions.${currentQuestionIndex}.singleChoiceOptions`);
    };

    const handleAddOption = () => {
        const current = getValues(`questions.${currentQuestionIndex}.singleChoiceOptions`) || [];
        setValue(`questions.${currentQuestionIndex}.singleChoiceOptions`, [
            ...current,
            { id: '', name: '', isSelected: false },
        ], { shouldDirty: true });
    };

    const handleRemoveOption = (optionIndex: number) => {
        const current = getValues(`questions.${currentQuestionIndex}.singleChoiceOptions`) || [];
        if (current.length <= 2) return;
        setValue(
            `questions.${currentQuestionIndex}.singleChoiceOptions`,
            current.filter((_: any, i: number) => i !== optionIndex),
            { shouldDirty: true, shouldValidate: true }
        );
    };

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
                                    <RichTextEditor
                                        value={field.value}
                                        onBlur={field.onBlur}
                                        onChange={field.onChange}
                                        minHeight={100}
                                        placeholder="Comprehension text"
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
                        Question
                        {showQuestionNumber && (
                            <>
                                &nbsp;
                                {questionsType
                                    ? formatStructure(questionsType, currentQuestionIndex + 1)
                                    : currentQuestionIndex + 1}
                            </>
                        )}
                    </span>
                    <Badge variant="outline">{level}</Badge>
                </div>
                <FormField
                    control={control}
                    name={`questions.${currentQuestionIndex}.questionName`}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <RichTextEditor
                                    value={field.value}
                                    onBlur={field.onBlur}
                                    onChange={field.onChange}
                                    minHeight={100}
                                    placeholder="Write the question"
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {options.map((opt: any, optionIndex: number) => {
                        const letter = String.fromCharCode(97 + optionIndex);
                        return (
                            <div
                                key={optionIndex}
                                className={`flex items-center justify-between gap-4 rounded-md bg-neutral-100 p-4 ${
                                    opt?.isSelected && examType !== 'SURVEY' ? 'border border-primary-300 bg-primary-50' : ''
                                }`}
                            >
                                <div className="flex w-full items-center gap-4">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white px-3">
                                        <span className="!p-0 text-sm">
                                            {optionsType ? formatStructure(optionsType, letter) : `(${letter}.)`}
                                        </span>
                                    </div>
                                    <FormField
                                        control={control}
                                        name={`questions.${currentQuestionIndex}.singleChoiceOptions.${optionIndex}.name`}
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormControl>
                                                    <RichTextEditor
                                                        value={field.value}
                                                        onBlur={field.onBlur}
                                                        onChange={field.onChange}
                                                        minHeight={60}
                                                        placeholder={`Option ${letter.toUpperCase()}`}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                {examType !== 'SURVEY' && (
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white px-4">
                                        <FormField
                                            control={control}
                                            name={`questions.${currentQuestionIndex}.singleChoiceOptions.${optionIndex}.isSelected`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={() => handleOptionChange(optionIndex)}
                                                            className={`mt-1 size-5 rounded-xl border-2 shadow-none ${
                                                                field.value
                                                                    ? 'border-none bg-green-500 text-white'
                                                                    : ''
                                                            }`}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                                {options.length > 2 && (
                                    <button
                                        type="button"
                                        className="shrink-0 text-gray-400 hover:text-red-500"
                                        onClick={() => handleRemoveOption(optionIndex)}
                                        title="Remove option"
                                    >
                                        <Trash size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={handleAddOption}
                >
                    <Plus size={16} className="mr-1" />
                    Add Option
                </Button>
            </div>
            <div className="mb-6 flex w-full flex-col !flex-nowrap items-start gap-1">
                <span>{explanationsType}</span>
                <FormField
                    control={control}
                    name={`questions.${currentQuestionIndex}.explanation`}
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <RichTextEditor
                                    value={field.value}
                                    onBlur={field.onBlur}
                                    onChange={field.onChange}
                                    minHeight={80}
                                    placeholder="Explanation"
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
