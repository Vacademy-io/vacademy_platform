import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVimotionOnboardingStore } from '../store';
import { ACCOUNT_TYPE_OPTIONS } from '../../constants';
import type { VimotionAccountType } from '../../api/types';
import { vimotionSignup } from '../../api/signup';
import { setAuthorizationCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useNavigate } from '@tanstack/react-router';

export function AccountTypeStep() {
    const navigate = useNavigate();
    const { contact, signupToken, accountType, setAccountType, setStep, reset } =
        useVimotionOnboardingStore();
    const [selected, setSelected] = useState<VimotionAccountType | null>(accountType);

    const signup = useMutation({
        mutationFn: () =>
            vimotionSignup({
                signup_token: signupToken!,
                full_name: contact.fullName,
                email: contact.email,
                phone_number: contact.phoneNumber,
                account_type: 'individual',
            }),
        onSuccess: (data) => {
            setAuthorizationCookie(TokenKey.accessToken, data.accessToken);
            setAuthorizationCookie(TokenKey.refreshToken, data.refreshToken);
            toast.success('Welcome to Vimotion!');
            reset();
            navigate({ to: '/vim/dashboard' });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to create account';
            toast.error(msg);
        },
    });

    const onContinue = () => {
        if (!selected) return;
        setAccountType(selected);
        if (selected === 'individual') {
            // Individuals skip the studio details step — sign up immediately.
            signup.mutate();
        } else {
            setStep('studio-details');
        }
    };

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground">How are you using Vimotion?</p>

            <div className="grid gap-3">
                {ACCOUNT_TYPE_OPTIONS.map((option) => {
                    const isSelected = selected === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelected(option.value)}
                            className={cn(
                                'flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors',
                                isSelected
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-border hover:border-primary-300'
                            )}
                            aria-pressed={isSelected}
                        >
                            <span className="font-medium">{option.title}</span>
                            <span className="text-sm text-muted-foreground">
                                {option.description}
                            </span>
                        </button>
                    );
                })}
            </div>

            <Button
                type="button"
                className="w-full"
                disabled={!selected || signup.isPending}
                onClick={onContinue}
            >
                {signup.isPending ? 'Creating account…' : 'Continue'}
            </Button>
        </div>
    );
}
