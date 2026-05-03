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
import { otpSchema, type OtpValues } from '../schema';
import { requestSignupOtp, verifySignupOtp } from '../../api/signup';

export function OtpStep() {
    const { contact, setSignupToken, setStep } = useVimotionOnboardingStore();

    const form = useForm<OtpValues>({
        resolver: zodResolver(otpSchema),
        defaultValues: { otp: '' },
    });

    const verify = useMutation({
        mutationFn: (otp: string) =>
            verifySignupOtp({
                full_name: contact.fullName,
                email: contact.email,
                phone_number: contact.phoneNumber,
                otp,
            }),
        onSuccess: (data) => {
            setSignupToken(data.signup_token, data.expires_at);
            setStep('account-type');
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Invalid or expired OTP';
            toast.error(msg);
        },
    });

    const resend = useMutation({
        mutationFn: () => requestSignupOtp({ phone_number: contact.phoneNumber }),
        onSuccess: () => toast.success('New OTP sent'),
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to resend OTP';
            toast.error(msg);
        },
    });

    const onSubmit = (values: OtpValues) => verify.mutate(values.otp);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <p className="text-sm text-muted-foreground">
                    We sent a 6-digit code on WhatsApp to{' '}
                    <span className="font-medium">{contact.phoneNumber}</span>
                </p>

                <FormField
                    control={form.control}
                    name="otp"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Verification code</FormLabel>
                            <FormControl>
                                <Input
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="123456"
                                    autoComplete="one-time-code"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex flex-col gap-2">
                    <Button type="submit" className="w-full" disabled={verify.isPending}>
                        {verify.isPending ? 'Verifying…' : 'Verify & continue'}
                    </Button>
                    <div className="flex items-center justify-between text-sm">
                        <button
                            type="button"
                            className="text-muted-foreground hover:underline"
                            onClick={() => setStep('contact')}
                        >
                            Edit number
                        </button>
                        <button
                            type="button"
                            className="text-primary-500 hover:underline disabled:opacity-50"
                            disabled={resend.isPending}
                            onClick={() => resend.mutate()}
                        >
                            {resend.isPending ? 'Resending…' : 'Resend OTP'}
                        </button>
                    </div>
                </div>
            </form>
        </Form>
    );
}
