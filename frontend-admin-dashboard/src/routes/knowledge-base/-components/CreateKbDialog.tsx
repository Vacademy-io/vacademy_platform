import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { LANGUAGE_OPTIONS, PURPOSE_OPTIONS } from '../-constants';
import { useCreateKnowledgeBase } from '../-hooks';
import type { KbPurpose } from '../-types';

const schema = z.object({
    name: z.string().trim().min(1, 'Give this knowledge base a name').max(200),
    purpose: z.enum(['teaching', 'question_bank', 'general']),
    language_hint: z.string().min(1),
    description: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateKbDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (kbId: string) => void;
}

export const CreateKbDialog = ({ open, onOpenChange, onCreated }: CreateKbDialogProps) => {
    const create = useCreateKnowledgeBase();
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', purpose: 'teaching', language_hint: 'en', description: '' },
    });

    const purpose = form.watch('purpose');
    const activePurpose = PURPOSE_OPTIONS.find((p) => p.value === purpose);

    const close = (next: boolean) => {
        if (!next) form.reset();
        onOpenChange(next);
    };

    const onSubmit = async (values: FormValues) => {
        try {
            const kb = await create.mutateAsync({
                name: values.name.trim(),
                description: values.description?.trim() || undefined,
                purpose: values.purpose as KbPurpose,
                language_hint: values.language_hint,
            });
            toast.success(`"${kb.name}" created. Add your first document to get started.`);
            form.reset();
            onOpenChange(false);
            onCreated(kb.id);
        } catch (error) {
            const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
                ?.detail;
            toast.error(
                typeof detail === 'string' ? detail : 'Could not create the knowledge base'
            );
        }
    };

    return (
        <MyDialog
            heading="New knowledge base"
            open={open}
            onOpenChange={close}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex w-full justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => close(false)}
                        disable={create.isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={form.handleSubmit(onSubmit)}
                        disable={create.isPending}
                    >
                        {create.isPending ? 'Creating…' : 'Create'}
                    </MyButton>
                </div>
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 p-6">
                    <p className="text-body text-neutral-500">
                        A knowledge base is a collection of your own material — books, notes, past
                        papers — that the AI reads from. Group it the way you already think about
                        it, usually one per class and subject.
                    </p>

                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <FormItem className="w-full">
                                <FormControl>
                                    <MyInput
                                        label="Name"
                                        required
                                        inputType="text"
                                        input={field.value}
                                        onChangeFunction={field.onChange}
                                        error={fieldState.error?.message}
                                        inputPlaceholder="e.g. Class 9 Science"
                                        className="w-full"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex flex-col gap-2">
                        <SelectField
                            label="What is this for?"
                            name="purpose"
                            control={form.control}
                            labelStyle="w-full"
                            className="w-full"
                            options={PURPOSE_OPTIONS.map((opt, index) => ({
                                value: opt.value,
                                label: opt.label,
                                _id: index,
                            }))}
                        />
                        {activePurpose && (
                            <p className="text-caption text-neutral-500">{activePurpose.hint}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <SelectField
                            label="Main language of the material"
                            name="language_hint"
                            control={form.control}
                            labelStyle="w-full"
                            className="w-full"
                            options={LANGUAGE_OPTIONS.map((opt, index) => ({
                                value: opt.value,
                                label: opt.label,
                                _id: index,
                            }))}
                        />
                        <p className="text-caption text-neutral-500">
                            Only a hint for reading the documents. You can still ask questions and
                            generate content in any language.
                        </p>
                    </div>

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field, fieldState }) => (
                            <FormItem className="w-full">
                                <FormControl>
                                    <MyInput
                                        label="Description"
                                        inputType="text"
                                        input={field.value ?? ''}
                                        onChangeFunction={field.onChange}
                                        error={fieldState.error?.message}
                                        inputPlaceholder="Optional — what's inside and who it's for"
                                        className="w-full"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </MyDialog>
    );
};
