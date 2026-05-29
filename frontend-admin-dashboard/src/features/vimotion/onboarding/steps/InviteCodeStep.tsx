import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
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
import { useVimotionOnboardingStore } from '../store';
import { inviteCodeSchema, type InviteCodeValues } from '../schema';
import { validateInviteCode } from '../../api/signup';

export function InviteCodeStep() {
    const { inviteCode, setInviteCode, setContact, setStep } = useVimotionOnboardingStore();

    const form = useForm<InviteCodeValues>({
        resolver: zodResolver(inviteCodeSchema),
        defaultValues: { inviteCode: inviteCode?.code ?? '' },
    });

    const validate = useMutation({
        mutationFn: (code: string) => validateInviteCode({ code }),
        onSuccess: (data, code) => {
            setInviteCode({
                code,
                kind: data.kind,
                prefillEmail: data.prefill_email,
                prefillPhone: data.prefill_phone,
            });
            // Locked codes preselect the email/phone so ContactStep can show
            // them disabled — name and password remain editable.
            if (data.kind === 'locked') {
                setContact({
                    email: data.prefill_email ?? '',
                    phoneNumber: data.prefill_phone ?? '',
                });
            }
            setStep('contact');
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Invalid invite code';
            toast.error(msg);
        },
    });

    // ?code=… deep link from emailed invite. Auto-validates once.
    const didAutoValidate = useRef(false);
    useEffect(() => {
        if (didAutoValidate.current) return;
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code')?.trim();
        if (code) {
            didAutoValidate.current = true;
            form.setValue('inviteCode', code);
            validate.mutate(code);
        }
    }, [form, validate]);

    const onSubmit = (values: InviteCodeValues) => validate.mutate(values.inviteCode.trim());

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                    control={form.control}
                    name="inviteCode"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium text-neutral-700">
                                Invite code
                            </FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="VIM-XXXXXX"
                                    autoComplete="off"
                                    autoFocus
                                    spellCheck={false}
                                    className="h-11 font-mono uppercase tracking-wider"
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                />
                            </FormControl>
                            <p className="text-xs text-neutral-500">
                                Vimotion is invite-only during launch. Paste the code from your
                                email or Discord drop.
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button
                    type="submit"
                    disabled={validate.isPending}
                    className="h-11 w-full gap-2 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                >
                    {validate.isPending ? 'Checking…' : 'Continue'}
                    {!validate.isPending && <ArrowRight className="size-4" />}
                </Button>

                <p className="text-center text-sm text-neutral-500">
                    Don&rsquo;t have a code?{' '}
                    <a
                        href="/vim/waitlist"
                        className="font-medium text-neutral-900 hover:text-neutral-700"
                    >
                        Join the waitlist
                    </a>
                </p>
            </form>
        </Form>
    );
}
