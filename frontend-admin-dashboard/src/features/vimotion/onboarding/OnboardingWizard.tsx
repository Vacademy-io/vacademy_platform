import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVimotionOnboardingStore } from './store';
import type { OnboardingStep } from './store';
import { InviteCodeStep } from './steps/InviteCodeStep';
import { ContactStep } from './steps/ContactStep';
import { OtpStep } from './steps/OtpStep';
import { AccountTypeStep } from './steps/AccountTypeStep';
import { StudioDetailsStep } from './steps/StudioDetailsStep';
import { Stepper } from './Stepper';
import { BrandPanel } from './BrandPanel';
import { VimotionLogoMark } from '../brand/VimotionLogoMark';
import { useVimotionDocumentChrome } from '../brand/useVimotionDocumentChrome';
import { useVimotionNativeShell } from '../native/useVimotionNativeShell';
import { getVimotionConfig } from '../api/signup';

const STEP_META: Record<OnboardingStep, { title: string; description: string }> = {
    'invite-code': {
        title: 'Enter your invite code',
        description: 'Vimotion is invite-only during launch.',
    },
    contact: {
        title: 'Create your Vimotion account',
        description: 'Start producing AI-powered videos in minutes.',
    },
    otp: {
        title: 'Verify your number',
        description: 'We need to confirm your phone before continuing.',
    },
    'account-type': {
        title: 'Tell us about you',
        description: 'Pick the option that fits best — you can change it later.',
    },
    'studio-details': {
        title: 'Set up your studio',
        description: 'A bit of brand info — you can refine all of this later.',
    },
};

export function OnboardingWizard() {
    useVimotionDocumentChrome();
    useVimotionNativeShell();
    const { step, signupToken, inviteCode, setStep } = useVimotionOnboardingStore();

    const { data: config } = useQuery({
        queryKey: ['vimotion', 'config'],
        queryFn: getVimotionConfig,
        staleTime: 5 * 60 * 1000,
    });

    const inviteOnly = config?.invite_only ?? false;

    const stepOrder = useMemo<OnboardingStep[]>(
        () =>
            inviteOnly
                ? ['invite-code', 'contact', 'otp', 'account-type', 'studio-details']
                : ['contact', 'otp', 'account-type', 'studio-details'],
        [inviteOnly]
    );

    // When invite-only is on and the user lands without a validated code, send
    // them to step 0. When invite-only is off, treat the wizard as 4-step like
    // before — if a stale `step === 'invite-code'` is in the store from a
    // previous session, bump to 'contact'.
    useEffect(() => {
        if (inviteOnly && !inviteCode && step !== 'invite-code') {
            setStep('invite-code');
            return;
        }
        if (!inviteOnly && step === 'invite-code') {
            setStep('contact');
        }
    }, [inviteOnly, inviteCode, step, setStep]);

    // Guard: a fresh refresh on a later step without a token sends the user
    // back to step 1, otherwise the BE would reject signup.
    useEffect(() => {
        if ((step === 'account-type' || step === 'studio-details') && !signupToken) {
            setStep(inviteOnly && !inviteCode ? 'invite-code' : 'contact');
        }
    }, [step, signupToken, setStep, inviteOnly, inviteCode]);

    const stepIndex = Math.max(0, stepOrder.indexOf(step));
    const meta = STEP_META[step];

    return (
        <div className="pt-safe pb-safe grid min-h-screen w-screen grid-cols-1 bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <BrandPanel />

            <div className="flex min-h-screen flex-col">
                {/* Mobile-only top bar with the wordmark */}
                <div className="flex items-center gap-2 px-6 pt-6 lg:hidden">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                        <VimotionLogoMark size={18} className="text-neutral-900" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-neutral-900">
                        Vimotion
                    </span>
                </div>

                <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-10 sm:py-12">
                    <div className="w-full max-w-md space-y-8">
                        <div className="space-y-3">
                            <Stepper total={stepOrder.length} current={stepIndex} />
                            <div className="space-y-1">
                                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                                    {meta.title}
                                </h1>
                                <p className="text-sm text-neutral-500">{meta.description}</p>
                            </div>
                        </div>

                        <div>
                            {step === 'invite-code' && <InviteCodeStep />}
                            {step === 'contact' && <ContactStep />}
                            {step === 'otp' && <OtpStep />}
                            {step === 'account-type' && <AccountTypeStep />}
                            {step === 'studio-details' && <StudioDetailsStep />}
                        </div>
                    </div>
                </div>

                <p className="px-6 pb-6 text-center text-xs text-neutral-400 sm:px-10">
                    By continuing, you agree to Vimotion&rsquo;s Terms and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
