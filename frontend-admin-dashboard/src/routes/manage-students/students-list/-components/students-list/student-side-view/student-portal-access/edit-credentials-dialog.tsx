import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Warning, EnvelopeSimple, WhatsappLogo } from '@phosphor-icons/react';

import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyDialog } from '@/components/design-system/dialog';
import { AutofillDecoy } from '@/components/design-system/autofill-decoy';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import {
    updateStudentCredentials,
    sendLearnerCredentials,
    type CredentialChannel,
} from '@/services/student-list-section/updateStudentCredentials';
import { getInstituteId } from '@/constants/helper';

const credentialsSchema = z
    .object({
        username: z
            .string()
            .trim()
            .min(3, 'Username must be at least 3 characters')
            // Usernames are typed into a login box; whitespace is invisible there
            // and produces a "wrong credentials" the learner cannot diagnose.
            .regex(/^\S+$/, 'Username cannot contain spaces'),
        password: z
            .string()
            .trim()
            // Optional: blank means "keep the current password". Only enforce a
            // length once the admin has actually typed something.
            .refine((value) => value.length === 0 || value.length >= 6, {
                message: 'Password must be at least 6 characters',
            }),
    })
    .refine((values) => values.username.length > 0 || values.password.length > 0, {
        message: 'Nothing to update',
        path: ['username'],
    });

type CredentialsFormValues = z.infer<typeof credentialsSchema>;

interface EditCredentialsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    currentUsername: string;
    /** Lets the parent show the new username immediately, without a list refetch. */
    onUpdated?: (username: string) => void;
}

export const EditCredentialsDialog = ({
    open,
    onOpenChange,
    userId,
    currentUsername,
    onUpdated,
}: EditCredentialsDialogProps) => {
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);
    const [sendingChannel, setSendingChannel] = useState<CredentialChannel | null>(null);

    const form = useForm<CredentialsFormValues>({
        resolver: zodResolver(credentialsSchema),
        defaultValues: { username: currentUsername, password: '' },
    });

    // The side view keeps this dialog mounted while the admin clicks between
    // learners, so re-seed the fields whenever it reopens on a different one.
    useEffect(() => {
        if (open) {
            form.reset({ username: currentUsername, password: '' });
        }
    }, [open, currentUsername, form]);

    // Any pending edit means the stored credentials differ from what is on
    // screen, and the send reads the STORED ones.
    const watchedUsername = form.watch('username');
    const watchedPassword = form.watch('password');
    const isFormDirty =
        watchedUsername.trim() !== currentUsername || watchedPassword.trim().length > 0;

    const handleSend = async (channel: CredentialChannel) => {
        const instituteId = getInstituteId();
        if (!instituteId) {
            toast.error('Institute not found');
            return;
        }
        setSendingChannel(channel);
        try {
            const result = await sendLearnerCredentials({
                instituteId,
                userId,
                channels: [channel],
            });
            // The backend reports per channel, because "no template bound" and
            // "learner has no phone number" both look like success otherwise.
            if (result.sent_channels?.length) {
                toast.success(result.message);
            } else {
                toast.warning(result.message);
            }
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { message?: string } } };
            toast.error(
                axiosError.response?.data?.message || `Failed to send credentials on ${channel}.`
            );
        } finally {
            setSendingChannel(null);
        }
    };

    const onSubmit = async (values: CredentialsFormValues) => {
        const nextUsername = values.username.trim();
        const nextPassword = values.password.trim();
        const usernameChanged = nextUsername !== currentUsername;

        if (!usernameChanged && !nextPassword) {
            toast.info('No changes to save');
            return;
        }

        setIsSaving(true);
        try {
            await updateStudentCredentials({
                userId,
                username: usernameChanged ? nextUsername : undefined,
                password: nextPassword || undefined,
            });

            queryClient.invalidateQueries({ queryKey: ['GET_USER_CREDENTIALS', userId] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            if (usernameChanged) onUpdated?.(nextUsername);

            toast.success('Credentials updated. The learner must sign in again.');
            onOpenChange(false);
        } catch (error: unknown) {
            // auth_service returns 510 (VacademyException's default) for a taken
            // username, with the reason in `message`.
            const axiosError = error as {
                response?: { status?: number; data?: { message?: string } };
            };
            const message = axiosError.response?.data?.message;
            if (axiosError.response?.status === 510 && message) {
                form.setError('username', { message });
            } else {
                toast.error(message || 'Failed to update credentials. Please try again.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <MyDialog
            heading="Edit Credentials"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-md"
        >
            <Form {...form}>
                {/* No padding here: MyDialog already wraps children in p-6, and
                    adding our own stacked a second inset on every side. */}
                <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Sets the LEARNER's credentials — never fill the admin's own. */}
                    <AutofillDecoy />
                    <div className="flex items-center gap-2 rounded-md bg-warning-50 px-3 py-2">
                        <Warning className="size-4 shrink-0 text-warning-600" />
                        <p className="text-caption text-neutral-600">
                            Saving signs the learner out of any active session.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            label="Username"
                                            required
                                            inputType="text"
                                            inputPlaceholder="Enter username"
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                            onBlur={field.onBlur}
                                            disabled={isSaving}
                                            // sm:w-full overrides the size variant's
                                            // sm:w-60, which otherwise leaves the input
                                            // narrower than its relative wrapper — putting
                                            // the password eye button outside the field.
                                            className="w-full sm:w-full"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            label="New Password"
                                            inputType="password"
                                            inputPlaceholder="Leave blank to keep current password"
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                            onBlur={field.onBlur}
                                            disabled={isSaving}
                                            // sm:w-full overrides the size variant's
                                            // sm:w-60, which otherwise leaves the input
                                            // narrower than its relative wrapper — putting
                                            // the password eye button outside the field.
                                            className="w-full sm:w-full"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Share section. Sends whatever is CURRENTLY stored — admin_core
                        reads the password back from auth_service — so it is blocked
                        while the form is dirty, otherwise an admin who edited but did
                        not save would mail the learner the old credentials.
                        No helper text here: when no template is bound, the response
                        toast already names the channel and where to fix it. */}
                    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-caption font-medium text-neutral-700">
                                Send credentials
                            </p>
                            {isFormDirty && (
                                <span className="text-caption text-neutral-400">
                                    Save changes first
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                disable={isSaving || isFormDirty || sendingChannel !== null}
                                onClick={() => handleSend('EMAIL')}
                                className="flex-1"
                            >
                                <EnvelopeSimple className="mr-1.5 size-4" />
                                {sendingChannel === 'EMAIL' ? 'Sending...' : 'Email'}
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                disable={isSaving || isFormDirty || sendingChannel !== null}
                                onClick={() => handleSend('WHATSAPP')}
                                className="flex-1"
                            >
                                <WhatsappLogo className="mr-1.5 size-4" />
                                {sendingChannel === 'WHATSAPP' ? 'Sending...' : 'WhatsApp'}
                            </MyButton>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            disable={isSaving}
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            type="submit"
                            buttonType="primary"
                            scale="medium"
                            disable={isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </MyButton>
                    </div>
                </form>
            </Form>
        </MyDialog>
    );
};
