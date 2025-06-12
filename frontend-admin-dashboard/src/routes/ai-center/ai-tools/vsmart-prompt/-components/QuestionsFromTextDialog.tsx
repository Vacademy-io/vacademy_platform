import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useRef } from 'react';
import { FormProvider, UseFormReturn } from 'react-hook-form';
import { QuestionsFromTextData } from './GenerateQuestionsFromText';
import SelectField from '@/components/design-system/select-field';
import { languageSupport } from '@/constants/dummy-data';

export const QuestionsFromTextDialog = ({
    open,
    onOpenChange,
    onSubmitSuccess,
    submitButton,
    submitForm,
    trigger,
    form,
    taskId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmitSuccess: (data: QuestionsFromTextData, taskId: string) => void;
    submitButton: JSX.Element;
    handleDisableSubmitBtn: (value: boolean) => void;
    submitForm: (submitFn: () => void) => void;
    trigger?: JSX.Element;
    form: UseFormReturn<{
        taskName: string;
        text: string;
        num: number;
        class_level: string;
        topics: string;
        question_type: string;
        question_language: string;
    }>;
    taskId: string;
}) => {
    const formRef = useRef<HTMLFormElement>(null);

    const requestSubmitFn = () => {
        if (formRef.current) {
            formRef.current.requestSubmit();
        }
    };

    useEffect(() => {
        if (submitForm) {
            submitForm(requestSubmitFn);
        }
    }, [submitForm]);

    return (
        <MyDialog
            heading="Generate Questions From Topics"
            open={open}
            onOpenChange={onOpenChange}
            footer={submitButton}
            trigger={trigger || undefined}
            dialogWidth="min-w-[500px]"
        >
            <FormProvider {...form}>
                <form
                    onSubmit={form.handleSubmit((data) => onSubmitSuccess(data, taskId))}
                    className="flex flex-col gap-4"
                    ref={formRef}
                >
                    <FormField
                        control={form.control}
                        name="taskName"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        input={field.value?.toString() || ''}
                                        onChangeFunction={(e) => field.onChange(e.target.value)}
                                        label="Task Name"
                                        required={true}
                                        inputType="text"
                                        inputPlaceholder="Enter your task name"
                                        className="w-full"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="topics"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        input={field.value?.toString() || ''}
                                        onChangeFunction={(e) => field.onChange(e.target.value)}
                                        label="Topics"
                                        required={true}
                                        inputType="text"
                                        inputPlaceholder="Enter the topic you want to generate the question for"
                                        className="w-full"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="text"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <div className="flex flex-col gap-2">
                                        <FormLabel>
                                            Details of topics{' '}
                                            <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <Textarea
                                            placeholder="For example, Generate a set of questions covering the key principles of photosynthesis, including the process, factors affecting it, and its importance in the ecosystem. Focus on conceptual understanding and application"
                                            className="h-[100px] w-full"
                                            value={field.value}
                                            onChange={(e) => field.onChange(e.target.value)}
                                        />
                                    </div>
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="num"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        min={0}
                                        input={field.value?.toString() || ''}
                                        onChangeFunction={(e) => {
                                            // Convert to number for validation, floor it
                                            const numValue = Math.floor(Number(e.target.value));
                                            // Only update if it's a valid number
                                            if (!isNaN(numValue)) {
                                                field.onChange(numValue); // Store as number in form
                                            }
                                        }}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        label="Number of Questions"
                                        required={true}
                                        inputType="number"
                                        inputPlaceholder="For example, 10"
                                        className="w-full"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="class_level"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        input={field.value?.toString() || ''}
                                        onChangeFunction={(e) => field.onChange(e.target.value)}
                                        label="Level"
                                        required={true}
                                        inputType="text"
                                        inputPlaceholder="For example, 8th standard"
                                        className="w-full"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="question_type"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        input={field.value?.toString() || ''}
                                        onChangeFunction={(e) => field.onChange(e.target.value)}
                                        label="Question Type"
                                        required={true}
                                        inputType="text"
                                        inputPlaceholder="Eg. Numerical, MCQS, True/False etc"
                                        className="w-full"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <SelectField
                        label="Question Language"
                        labelStyle="font-semibold"
                        name="question_language"
                        options={languageSupport.map((option, index) => ({
                            value: option,
                            label: option,
                            _id: index,
                        }))}
                        control={form.control}
                        required
                        className="w-56 font-thin"
                    />
                </form>
            </FormProvider>
        </MyDialog>
    );
};
