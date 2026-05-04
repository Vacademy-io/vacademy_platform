import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, Check, Building2, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVimotionOnboardingStore } from '../store';
import type { VimotionAccountType } from '../../api/types';
import { vimotionSignup } from '../../api/signup';
import { setAuthorizationCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

const OPTIONS: {
    value: VimotionAccountType;
    title: string;
    description: string;
    Icon: typeof User;
}[] = [
    {
        value: 'individual',
        title: 'Individual creator',
        description: 'I make AI content on my own.',
        Icon: User,
    },
    {
        value: 'studio',
        title: 'Studio',
        description: 'A team producing AI content together.',
        Icon: Building2,
    },
    {
        value: 'agency',
        title: 'Agency',
        description: 'We create AI content for multiple clients.',
        Icon: Users,
    },
];

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
            signup.mutate();
        } else {
            setStep('studio-details');
        }
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-3">
                {OPTIONS.map(({ value, title, description, Icon }) => {
                    const isSelected = selected === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setSelected(value)}
                            aria-pressed={isSelected}
                            className={cn(
                                'group flex items-start gap-4 rounded-xl border bg-white p-4 text-left transition-all',
                                isSelected
                                    ? 'border-neutral-900 shadow-[0_0_0_3px_rgba(0,0,0,0.04)]'
                                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                            )}
                        >
                            <div
                                className={cn(
                                    'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                                    isSelected
                                        ? 'bg-neutral-900 text-white'
                                        : 'bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200'
                                )}
                            >
                                <Icon className="size-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-neutral-900">{title}</p>
                                <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
                            </div>
                            {isSelected && (
                                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
                                    <Check className="size-3" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <Button
                type="button"
                disabled={!selected || signup.isPending}
                onClick={onContinue}
                className="h-11 w-full gap-2 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
            >
                {signup.isPending ? 'Creating account…' : 'Continue'}
                {!signup.isPending && <ArrowRight className="size-4" />}
            </Button>
        </div>
    );
}
