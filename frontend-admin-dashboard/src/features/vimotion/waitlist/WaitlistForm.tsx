import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight } from '@phosphor-icons/react';
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
import { joinWaitlist, type WaitlistStatusResponse } from '../api/waitlist';
import { LiveCounter } from './LiveCounter';

const waitlistFormSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name is required'),
    email: z.string().trim().email('Enter a valid email'),
    phoneNumber: z
        .string()
        .trim()
        .min(10, 'Enter a valid phone number')
        .regex(/^\+?[0-9\s-]+$/, 'Only digits, spaces, +, - allowed'),
});

type WaitlistFormValues = z.infer<typeof waitlistFormSchema>;

interface WaitlistFormProps {
    onJoined: (response: WaitlistStatusResponse) => void;
    referralCodeFromUrl?: string;
}

export function WaitlistForm({ onJoined, referralCodeFromUrl }: WaitlistFormProps) {
    const form = useForm<WaitlistFormValues>({
        resolver: zodResolver(waitlistFormSchema),
        defaultValues: { fullName: '', email: '', phoneNumber: '' },
    });

    const join = useMutation({
        mutationFn: (values: WaitlistFormValues) =>
            joinWaitlist({
                full_name: values.fullName,
                email: values.email,
                phone_number: values.phoneNumber,
                referral_code: referralCodeFromUrl,
                source: 'web',
            }),
        onSuccess: (data) => onJoined(data),
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Could not join the waitlist';
            toast.error(msg);
        },
    });

    useEffect(() => {
        // No-op: form starts blank. The ref param is forwarded to the BE in
        // the mutation payload so a referral attribution survives a refresh
        // of the form page.
    }, [referralCodeFromUrl]);

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit((v) => join.mutate(v))}
                className="space-y-5"
            >
                <div className="flex justify-start">
                    <LiveCounter />
                </div>

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
                                We&rsquo;ll reach out here when your invite is ready.
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {referralCodeFromUrl && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Joining via a referral —{' '}
                        <span className="font-mono font-semibold">{referralCodeFromUrl}</span>{' '}
                        will get bumped up when you join.
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={join.isPending}
                    className="h-11 w-full gap-2 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                >
                    {join.isPending ? 'Joining…' : 'Join the waitlist'}
                    {!join.isPending && <ArrowRight className="size-4" />}
                </Button>

                <p className="text-center text-sm text-neutral-500">
                    Already have an invite code?{' '}
                    <a
                        href="/vim/onboarding"
                        className="font-medium text-neutral-900 hover:text-neutral-700"
                    >
                        Redeem it
                    </a>
                </p>
            </form>
        </Form>
    );
}
