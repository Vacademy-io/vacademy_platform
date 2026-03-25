import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FormProvider, useForm } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MyInput } from '@/components/design-system/input';
import { getInstituteId } from '@/constants/helper';
import { useMutation } from '@tanstack/react-query';
import { handleInviteTeachers } from '../-services/dashboard-services';
import { useState, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LazyBatchSubjectForm = lazy(() => import('./BatchAndSubjectSelection'));

export const inviteTeacherSchema = z.object({
    name: z.string().min(1, 'Full name is required'),
    email: z.string().min(1, 'Email is required').email('Invalid email format'),
    batch_subject_mappings: z
        .array(
            z.object({
                batchId: z.string(),
                subjectIds: z.array(z.string()),
            })
        )
        .optional(),
});
export type inviteUsersFormValues = z.infer<typeof inviteTeacherSchema>;

const AddTeachers = ({ packageSessionId }: { packageSessionId: string }) => {
    const [open, setOpen] = useState(false);
    const instituteId = getInstituteId();
    const form = useForm<inviteUsersFormValues>({
        resolver: zodResolver(inviteTeacherSchema),
        defaultValues: {
            name: '',
            email: '',
            batch_subject_mappings: [],
        },
        mode: 'onChange',
    });
    const { getValues } = form; // Added setValue and watch
    const isValid = !!getValues('name') && !!getValues('email');

    const handleInviteUsersMutation = useMutation({
        mutationFn: ({
            instituteId,
            data,
        }: {
            instituteId: string | undefined;
            data: z.infer<typeof inviteTeacherSchema>;
        }) => handleInviteTeachers(instituteId, data),
        onSuccess: () => {
            form.reset();
            setOpen(false);
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const checkIsTeacherValid = () => {
        const batch = form.watch('batch_subject_mappings');
        if (!batch || batch.length === 0) {
            return false;
        }
        return true;
    };

    function onSubmit(values: inviteUsersFormValues) {
        handleInviteUsersMutation.mutate({
            instituteId,
            data: values,
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
                <MyButton buttonType="primary" scale="large" layoutVariant="default">
                    Invite Users
                </MyButton>
            </DialogTrigger>
            <DialogContent className="flex max-h-[600px] w-[420px] flex-col overflow-y-scroll p-0">
                <h1 className="rounded-t-md bg-primary-50 p-4 font-semibold text-primary-500">
                    Invite User
                </h1>
                <FormProvider {...form}>
                    <form className="flex flex-col items-start justify-center gap-4 px-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field: { onChange, value, ...field } }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder="Full name (First and Last)"
                                            input={value}
                                            onChangeFunction={onChange}
                                            required={true}
                                            error={form.formState.errors.name?.message}
                                            size="large"
                                            label="Full Name"
                                            {...field}
                                            className="w-96"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field: { onChange, value, ...field } }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            inputType="email"
                                            inputPlaceholder="Enter Email"
                                            input={value}
                                            onChangeFunction={onChange}
                                            required={true}
                                            error={form.formState.errors.email?.message}
                                            size="large"
                                            label="Email"
                                            {...field}
                                            className="w-96"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        {/* Conditional fields for Teacher */}
                        <Suspense
                            fallback={
                                <div className="flex w-full justify-center py-4">
                                    <Loader2 className="size-6 animate-spin text-primary-500" />
                                </div>
                            }
                        >
                            <LazyBatchSubjectForm initialBatchId={packageSessionId} />
                        </Suspense>
                        <div className="flex w-96 items-center justify-center text-center">
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="primary"
                                layoutVariant="default"
                                className="mb-6"
                                disable={!isValid || !checkIsTeacherValid()}
                                onClick={form.handleSubmit(onSubmit)}
                            >
                                Invite User
                            </MyButton>
                        </div>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
};

export default AddTeachers;
