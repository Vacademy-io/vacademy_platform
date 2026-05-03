import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
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
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                                <Input placeholder="Jane Doe" autoComplete="name" {...field} />
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
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input
                                    type="email"
                                    placeholder="you@example.com"
                                    autoComplete="email"
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
                            <FormLabel>Phone number</FormLabel>
                            <FormControl>
                                <Input
                                    type="tel"
                                    placeholder="+91 98xxxxxxxx"
                                    autoComplete="tel"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full" disabled={requestOtp.isPending}>
                    {requestOtp.isPending ? 'Sending OTP…' : 'Continue'}
                </Button>
            </form>
        </Form>
    );
}
