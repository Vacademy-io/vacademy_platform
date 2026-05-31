import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OutputShowcase } from '../auth/OutputShowcase';
import { VimotionLogoMark } from '../brand/VimotionLogoMark';
import { useVimotionDocumentChrome } from '../brand/useVimotionDocumentChrome';
import { useVimotionNativeShell } from '../native/useVimotionNativeShell';
import { getWaitlistStatus, type WaitlistStatusResponse } from '../api/waitlist';
import { WaitlistForm } from './WaitlistForm';
import { WaitlistSuccess } from './WaitlistSuccess';

const STORAGE_KEY = 'vimotion_waitlist_email';

function readReferralCodeFromUrl(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref')?.trim();
    return ref || undefined;
}

function readStoredEmail(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

export function WaitlistPage() {
    useVimotionDocumentChrome();
    useVimotionNativeShell();

    const [referralCode] = useState<string | undefined>(() => readReferralCodeFromUrl());
    const [storedEmail, setStoredEmail] = useState<string | null>(() => readStoredEmail());
    const [freshStatus, setFreshStatus] = useState<WaitlistStatusResponse | null>(null);

    // If the user refreshes and we have a stored email, rehydrate position
    // from the BE so the success view reflects current referral activity.
    const rehydrate = useQuery({
        queryKey: ['vimotion', 'waitlist', 'rehydrate', storedEmail],
        queryFn: () => getWaitlistStatus(storedEmail as string),
        enabled: !!storedEmail && !freshStatus,
        retry: false,
    });

    // If the stored email doesn't resolve on the BE (e.g. data was wiped),
    // clear localStorage so the user lands back on the form.
    useEffect(() => {
        if (storedEmail && rehydrate.isError) {
            try {
                window.localStorage.removeItem(STORAGE_KEY);
            } catch {
                // localStorage may be unavailable (private mode); ignoring is fine —
                // the user will just keep seeing the form, which is the correct
                // fallback.
            }
            setStoredEmail(null);
        }
    }, [storedEmail, rehydrate.isError]);

    const handleJoined = (response: WaitlistStatusResponse) => {
        try {
            window.localStorage.setItem(STORAGE_KEY, response.email);
        } catch {
            // See note above on private mode; the in-memory state covers this
            // session.
        }
        setStoredEmail(response.email);
        setFreshStatus(response);
    };

    const handleForget = () => {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // See note above on private mode.
        }
        setStoredEmail(null);
        setFreshStatus(null);
    };

    const successInitial = freshStatus ?? rehydrate.data ?? null;
    const showSuccess = !!storedEmail && !!successInitial;

    return (
        <div className="pt-safe pb-safe grid min-h-screen w-screen grid-cols-1 bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <OutputShowcase
                tagline="AI video, on brand, in minutes — join the launch waitlist."
                className="order-last lg:order-first"
            />

            <div className="flex min-h-screen flex-col">
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
                        <div className="space-y-2">
                            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                                {showSuccess ? 'You’re on the list.' : 'Get early access to Vimotion'}
                            </h1>
                            <p className="text-sm text-neutral-500">
                                {showSuccess
                                    ? 'We’ll send your invite as soon as a slot opens up.'
                                    : 'Vimotion is invite-only during launch. Drop your details and we’ll get in touch.'}
                            </p>
                        </div>

                        {showSuccess ? (
                            <WaitlistSuccess
                                initial={successInitial}
                                onForget={handleForget}
                            />
                        ) : (
                            <WaitlistForm
                                onJoined={handleJoined}
                                referralCodeFromUrl={referralCode}
                            />
                        )}
                    </div>
                </div>

                <p className="px-6 pb-6 text-center text-xs text-neutral-400 sm:px-10">
                    By joining, you agree to Vimotion&rsquo;s Terms and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
