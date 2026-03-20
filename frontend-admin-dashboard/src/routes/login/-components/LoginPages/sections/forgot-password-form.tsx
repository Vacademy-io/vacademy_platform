'use client';

import { useEffect, useState } from 'react';
import { FormContainer } from '@/routes/login/-components/LoginPages/layout/form-container';
import { Heading } from '@/routes/login/-components/LoginPages/ui/heading';
import { MyInput } from '@/components/design-system/input';
import { Link } from '@tanstack/react-router';
import { forgotPasswordSchema } from '@/schemas/login/login';
import { z } from 'zod';
import { forgotPassword } from '@/hooks/login/send-link-button';
import { useMutation } from '@tanstack/react-query';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { EnvelopeSimple, WhatsappLogo } from '@phosphor-icons/react';
import { goToMailSupport, goToWhatsappSupport } from '@/lib/utils';

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPassword() {
    const [cooldown, setCooldown] = useState(0);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: '' },
        mode: 'onTouched',
    });

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [cooldown]);

    const forgotPasswordMutation = useMutation({
        mutationFn: async (email: string) => {
            return await forgotPassword(email);
        },
        onSuccess: (response) => {
            if (response.status === 'success') {
                setCooldown(60);
                setShowSuccessModal(true);
                form.reset();
            } else {
                toast.error("We couldn't find an account with that email address.", {
                    description: response.message,
                    className: 'error-toast',
                    duration: 4000,
                });
            }
        },
        onError: (error: unknown) => {
            const errorMessage =
                error instanceof Error ? error.message : 'Unable to process your request';
            toast.error('Something went wrong', {
                description: errorMessage,
                className: 'error-toast',
                duration: 3000,
            });
        },
    });

    const onSubmit = (values: FormValues) => {
        forgotPasswordMutation.mutate(values.email);
    };

    const isSending = forgotPasswordMutation.isPending;
    const cooldownActive = cooldown > 0;

    return (
        <div>
            <FormContainer>
                <div className="flex w-full flex-col items-center justify-center gap-20">
                    <Heading
                        heading="Forgot Password"
                        subHeading="Enter your email, and we'll send your password to your inbox"
                    />
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
                            <div className="flex w-full flex-col items-center justify-center gap-8">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field: { onChange, value, ...field } }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MyInput
                                                    inputType="email"
                                                    inputPlaceholder="you@email.com"
                                                    input={value}
                                                    onChangeFunction={onChange}
                                                    error={form.formState.errors.email?.message}
                                                    required={true}
                                                    size="large"
                                                    label="Email"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <div className="flex flex-col items-center gap-4">
                                    {isSending || cooldownActive ? (
                                        <MyButton
                                            type="button"
                                            scale="large"
                                            buttonType="primary"
                                            layoutVariant="default"
                                            className="pointer-events-none opacity-50"
                                        >
                                            {isSending ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                    Sending...
                                                </div>
                                            ) : (
                                                `Resend in ${cooldown}s`
                                            )}
                                        </MyButton>
                                    ) : (
                                        <MyButton
                                            type="submit"
                                            scale="large"
                                            buttonType="primary"
                                            layoutVariant="default"
                                        >
                                            Send Reset Link
                                        </MyButton>
                                    )}

                                    <div className="flex gap-1 text-body font-regular">
                                        <div className="text-neutral-500">
                                            Remember your password?
                                        </div>
                                        <Link
                                            to="/login"
                                            className="cursor-pointer text-primary-500"
                                        >
                                            Back to Login
                                        </Link>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t border-black" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-background px-2 text-muted-foreground">
                                                Or connect with us
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <MyButton
                                            buttonType="secondary"
                                            type="button"
                                            className="w-full"
                                            onClick={goToWhatsappSupport}
                                        >
                                            <WhatsappLogo className="size-6" />
                                            WhatsApp
                                        </MyButton>
                                        <MyButton
                                            buttonType="secondary"
                                            type="button"
                                            className="w-full"
                                            onClick={goToMailSupport}
                                        >
                                            <EnvelopeSimple className="size-6" />
                                            Email
                                        </MyButton>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>
            </FormContainer>

            {/* ✅ Modal shown on success */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
                    <div className="relative w-[90%] max-w-md rounded-xl bg-white p-6 text-center shadow-lg">
                        {/* ❌ Close button */}
                        <button
                            className="absolute right-4 top-4 text-neutral-500 hover:text-neutral-700"
                            onClick={() => setShowSuccessModal(false)}
                            aria-label="Close"
                        >
                            ×
                        </button>

                        <h2 className="mb-2 text-xl font-semibold text-neutral-800">
                            Check Your Email
                        </h2>
                        <p className="mb-6 text-neutral-600">
                            Your username and password have been sent to your email address.
                        </p>

                        {/* ✅ Replace "Got it" with "Back to Login" */}
                        <Link to="/login">
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="default"
                                className="mx-auto"
                            >
                                Back to Login
                            </MyButton>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
