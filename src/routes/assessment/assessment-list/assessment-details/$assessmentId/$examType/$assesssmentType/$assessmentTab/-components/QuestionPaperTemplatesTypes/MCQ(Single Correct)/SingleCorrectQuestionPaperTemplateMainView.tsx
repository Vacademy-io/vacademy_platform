import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Plus, Sliders, Trash, X } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import 'react-quill/dist/quill.snow.css';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PopoverClose } from '@radix-ui/react-popover';
import SelectField from '@/components/design-system/select-field';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { QUESTION_TYPES } from '@/constants/dummy-data';
import { SectionQuestionPaperFormProps } from '../../../-utils/assessment-question-paper';

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

export const SingleCorrectQuestionPaperTemplateMainView = ({
    form,
    currentQuestionIndex,
    className,
    selectedSectionIndex,
}: SectionQuestionPaperFormProps) => {
    const { control, getValues, setValue } = form;

    const basePath = `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}`;
    const options: ChoiceOption[] = getValues(`${basePath}.singleChoiceOptions` as any) || [];

    const handleOptionChange = (optionIndex: number) => {
        const isCurrentlySelected = getValues(
            `${basePath}.singleChoiceOptions.${optionIndex}.isSelected` as any
        );
        options.forEach((_, i) => {
            setValue(
                `${basePath}.singleChoiceOptions.${i}.isSelected` as any,
                i === optionIndex ? !isCurrentlySelected : false
            );
        });
    };

    const handleAddOption = () => {
        const current = getValues(`${basePath}.singleChoiceOptions` as any) || [];
        setValue(`${basePath}.singleChoiceOptions` as any, [
            ...current,
            { name: '', isSelected: false, image: { imageId: '', imageName: '', imageTitle: '', imageFile: '', isDeleted: false } },
        ], { shouldDirty: true });
    };

    const handleRemoveOption = (optionIndex: number) => {
        const current = getValues(`${basePath}.singleChoiceOptions` as any) || [];
        if (current.length <= 2) return;
        setValue(
            `${basePath}.singleChoiceOptions` as any,
            current.filter((_: any, i: number) => i !== optionIndex),
            { shouldDirty: true }
        );
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
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            {getValues(
                `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.parentRichTextContent`
            ) && (
                <div className="flex w-full flex-col !flex-nowrap items-start gap-1">
                    <span>Comprehension Text</span>
                    <FormField
                        control={control}
                        name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.parentRichTextContent`}
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
                <span>
                    Question&nbsp;
                    {currentQuestionIndex + 1}
                </span>
                <FormField
                    control={control}
                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.questionName`}
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
            </div>

            <div className="flex w-full grow flex-col gap-4">
                <span className="-mb-3">Answer:</span>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {options.map((opt, optionIndex) => {
                        const letter = String.fromCharCode(97 + optionIndex);
                        return (
                            <div
                                key={optionIndex}
                                className={`flex items-center justify-between gap-4 rounded-md bg-neutral-100 p-4 ${
                                    opt?.isSelected ? 'border border-primary-300 bg-primary-50' : ''
                                }`}
                            >
                                <div className="flex w-full items-center gap-4">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white px-3">
                                        <span className="!p-0 text-sm">({letter}.)</span>
                                    </div>
                                    <FormField
                                        control={control}
                                        name={`${basePath}.singleChoiceOptions.${optionIndex}.name` as any}
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
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white px-4">
                                    <FormField
                                        control={control}
                                        name={`${basePath}.singleChoiceOptions.${optionIndex}.isSelected` as any}
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
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={handleAddOption}>
                    <Plus size={16} className="mr-1" /> Add Option
                </Button>
            </div>
            <div className="mb-6 flex w-full flex-col !flex-nowrap items-start gap-1">
                <span>Explanation:</span>
                <FormField
                    control={control}
                    name={`sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.explanation`}
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
