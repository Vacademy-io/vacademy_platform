import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
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
    const { contact, setContact, setStep } = useVimotionOnboardingStore();

    const form = useForm<ContactValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: contact,
    });

    const requestOtp = useMutation({
        mutationFn: (phoneNumber: string) => requestSignupOtp({ phone_number: phoneNumber }),
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
                                    {...field}
                                />
                            </FormControl>
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
                                    {...field}
                                />
                            </FormControl>
                            <p className="text-xs text-neutral-500">
                                We&rsquo;ll send a 6-digit code to verify it&rsquo;s really you.
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
