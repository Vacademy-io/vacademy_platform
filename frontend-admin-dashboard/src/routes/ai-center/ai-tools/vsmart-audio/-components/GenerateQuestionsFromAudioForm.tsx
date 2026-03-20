import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { languageSupport } from '@/constants/dummy-data';
import { AudioAIQuestionFormSchema } from '@/routes/ai-center/-utils/audio-questions-schema';
import { useState } from 'react';
import { FormProvider, UseFormReturn } from 'react-hook-form';
import { ModelSelector } from '../../-components/ModelSelector';

const GenerateQuestionsFromAudioForm = ({
    form,
    audioId,
    handleCallApi,
    status,
}: {
    form: UseFormReturn<AudioAIQuestionFormSchema>;
    audioId: string;
    handleCallApi: (
        audioId: string,
        numQuestions: string,
        prompt: string,
        difficulty: string,
        language: string,
        preferredModel?: string
    ) => void;
    status: string;
}) => {
    const [open, setOpen] = useState(audioId ? true : false);

    const onSubmit = (values: AudioAIQuestionFormSchema) => {
        handleCallApi(
            audioId,
            values.numQuestions,
            values.prompt,
            values.difficulty,
            values.language,
            values.preferredModel
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="flex w-[500px] flex-col p-0">
                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                    Generate Question From Audio File
                </h1>
                <FormProvider {...form}>
                    <form className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="flex flex-col gap-2">
                                            <FormLabel>
                                                Topics <span className="text-red-500">*</span>
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
                            name="numQuestions"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            input={field.value?.toString() || ''}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            label="Number of Questions"
                                            required={true}
                                            inputType="number"
                                            inputPlaceholder="For example, 10"
                                            className="w-full"
                                            min={0}
                                            onKeyDown={(e) => {
                                                if (['e', 'E', '-', '+'].includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onWheel={(e) => e.currentTarget.blur()}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="difficulty"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl className="w-full">
                                        <MyInput
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            inputType="text"
                                            inputPlaceholder="for example easy, medium and hard"
                                            className="w-full"
                                            required={true}
                                            label="Enter difficulty level"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <SelectField
                            label="Question Language"
                            labelStyle="font-semibold"
                            name="language"
                            options={languageSupport.map((option, index) => ({
                                value: option,
                                label: option,
                                _id: index,
                            }))}
                            control={form.control}
                            required
                            className="w-full font-thin"
                        />

                        {/* AI Model Selection */}
                        <FormField
                            control={form.control}
                            name="preferredModel"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <ModelSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            showAdvanced={true}
                                            className="w-full"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div>
                            {status === 'pending' ? (
                                <MyButton
                                    buttonType="primary"
                                    layoutVariant="default"
                                    scale="large"
                                    className=""
                                    type="button"
                                >
                                    <DashboardLoader />
                                </MyButton>
                            ) : (
                                <MyButton
                                    buttonType="primary"
                                    layoutVariant="default"
                                    scale="large"
                                    className=""
                                    type="button"
                                    onClick={form.handleSubmit(onSubmit)}
                                >
                                    Submit
                                </MyButton>
                            )}
                        </div>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
};

export default GenerateQuestionsFromAudioForm;
