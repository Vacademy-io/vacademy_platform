import { useEffect } from 'react';
import { useVimotionOnboardingStore } from './store';
import { ContactStep } from './steps/ContactStep';
import { OtpStep } from './steps/OtpStep';
import { AccountTypeStep } from './steps/AccountTypeStep';
import { StudioDetailsStep } from './steps/StudioDetailsStep';

const STEP_TITLES: Record<ReturnType<typeof useVimotionOnboardingStore.getState>['step'], string> =
    {
        contact: 'Create your Vimotion account',
        otp: 'Verify your number',
        'account-type': 'Tell us who you are',
        'studio-details': 'Set up your studio',
    };

const STEP_ORDER = ['contact', 'otp', 'account-type', 'studio-details'] as const;

export function OnboardingWizard() {
    const { step, signupToken, setStep } = useVimotionOnboardingStore();

    // Guard: a fresh refresh on a later step without a token sends the user
    // back to step 1, otherwise the BE would reject signup.
    useEffect(() => {
        if ((step === 'account-type' || step === 'studio-details') && !signupToken) {
            setStep('contact');
        }
    }, [step, signupToken, setStep]);

    const stepIndex = STEP_ORDER.indexOf(step);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
            <div className="w-full max-w-md space-y-6">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Step {stepIndex + 1} of {STEP_ORDER.length}
                    </p>
                    <h1 className="text-2xl font-semibold">{STEP_TITLES[step]}</h1>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    {step === 'contact' && <ContactStep />}
                    {step === 'otp' && <OtpStep />}
                    {step === 'account-type' && <AccountTypeStep />}
                    {step === 'studio-details' && <StudioDetailsStep />}
                </div>
            </div>
        </div>
    );
}
