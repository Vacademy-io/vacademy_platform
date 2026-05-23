import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useVimotionOnboardingStore } from '../store';
import { otpSchema, type OtpValues } from '../schema';
import { requestSignupOtp, verifySignupOtp } from '../../api/signup';

export function OtpStep() {
    const { contact, inviteCode, setSignupToken, setStep } = useVimotionOnboardingStore();

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
                invite_code: inviteCode?.code,
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
        mutationFn: () =>
            requestSignupOtp({
                phone_number: contact.phoneNumber,
                invite_code: inviteCode?.code,
            }),
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
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    Code sent on WhatsApp to{' '}
                    <span className="font-medium text-neutral-900">{contact.phoneNumber}</span>
                </div>

                <FormField
                    control={form.control}
                    name="otp"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="6-digit code"
                                    autoComplete="one-time-code"
                                    className="h-12 text-center text-lg tracking-[0.5em]"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button
                    type="submit"
                    disabled={verify.isPending}
                    className="h-11 w-full bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                >
                    {verify.isPending ? 'Verifying…' : 'Verify & continue'}
                </Button>

                <div className="flex items-center justify-between text-sm">
                    <button
                        type="button"
                        className="text-neutral-500 hover:text-neutral-700"
                        onClick={() => setStep('contact')}
                    >
                        ← Edit number
                    </button>
                    <button
                        type="button"
                        className="font-medium text-neutral-900 hover:text-neutral-700 disabled:opacity-50"
                        disabled={resend.isPending}
                        onClick={() => resend.mutate()}
                    >
                        {resend.isPending ? 'Resending…' : 'Resend OTP'}
                    </button>
                </div>
            </form>
        </Form>
    );
}
