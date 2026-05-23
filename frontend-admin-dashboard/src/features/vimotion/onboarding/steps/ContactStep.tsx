import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useVimotionOnboardingStore } from '../store';
import { contactSchema, type ContactValues } from '../schema';
import { requestSignupOtp } from '../../api/signup';

export function ContactStep() {
    const { contact, inviteCode, setContact, setStep } = useVimotionOnboardingStore();
    const [showPassword, setShowPassword] = useState(false);
    const isLocked = inviteCode?.kind === 'locked';

    const form = useForm<ContactValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: contact,
    });

    // Locked codes pre-bind email/phone — keep the form in sync if the store
    // value changes after this step mounts (e.g. ?code=… deep link).
    useEffect(() => {
        if (isLocked) {
            if (contact.email) form.setValue('email', contact.email);
            if (contact.phoneNumber) form.setValue('phoneNumber', contact.phoneNumber);
        }
    }, [isLocked, contact.email, contact.phoneNumber, form]);

    const requestOtp = useMutation({
        mutationFn: (phoneNumber: string) =>
            requestSignupOtp({ phone_number: phoneNumber, invite_code: inviteCode?.code }),
        onSuccess: () => {
            toast.success('OTP sent on WhatsApp');
            setStep('otp');
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to send OTP';
            toast.error(msg);
        },
    });

    const onSubmit = (values: ContactValues) => {
        setContact(values);
        requestOtp.mutate(values.phoneNumber);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-neutral-700">
                                Full name
                            </FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Jane Doe"
                                    autoComplete="name"
                                    className="h-11"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-neutral-700">
                                Work email
                            </FormLabel>
                            <FormControl>
                                <Input
                                    type="email"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    className="h-11"
                                    disabled={isLocked}
                                    {...field}
                                />
                            </FormControl>
                            {isLocked && (
                                <p className="text-xs text-neutral-500">
                                    Your invite is tied to this email.
                                </p>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-neutral-700">
                                WhatsApp number
                            </FormLabel>
                            <FormControl>
                                <Input
                                    type="tel"
                                    placeholder="+91 98xxxxxxxx"
                                    autoComplete="tel"
                                    className="h-11"
                                    disabled={isLocked}
                                    {...field}
                                />
                            </FormControl>
                            <p className="text-xs text-neutral-500">
                                {isLocked
                                    ? 'Your invite is tied to this number.'
                                    : 'We’ll send a 6-digit code to verify it’s really you.'}
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-neutral-700">
                                Password
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        placeholder="At least 8 characters"
                                        className="h-11 pr-10"
                                        {...field}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 hover:text-neutral-600"
                                        aria-label={
                                            showPassword ? 'Hide password' : 'Show password'
                                        }
                                    >
                                        {showPassword ? (
                                            <EyeOff className="size-4" />
                                        ) : (
                                            <Eye className="size-4" />
                                        )}
                                    </button>
                                </div>
                            </FormControl>
                            <p className="text-xs text-neutral-500">
                                You&rsquo;ll use this with your email to sign in to Vimotion later.
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button
                    type="submit"
                    disabled={requestOtp.isPending}
                    className="h-11 w-full gap-2 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                >
                    {requestOtp.isPending ? 'Sending OTP…' : 'Continue'}
                    {!requestOtp.isPending && <ArrowRight className="size-4" />}
                </Button>
            </form>
        </Form>
    );
}
