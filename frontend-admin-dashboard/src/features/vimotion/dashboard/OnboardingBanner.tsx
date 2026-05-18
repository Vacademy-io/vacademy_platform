import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getInstituteId } from '@/constants/helper';
import { getDefaultBrandKit } from '../api/brandKits';
import { BrandKitDrawer } from './BrandKitDrawer';

const SKIPPED_KEY_PREFIX = 'vimotion_onboarding_skipped_';

function isSkipped(instituteId: string): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`${SKIPPED_KEY_PREFIX}${instituteId}`) === 'true';
}

function markSkipped(instituteId: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${SKIPPED_KEY_PREFIX}${instituteId}`, 'true');
}

export function OnboardingBanner() {
    const instituteId = getInstituteId() ?? '';
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [dismissed, setDismissed] = useState(() => isSkipped(instituteId));

    const defaultKitQuery = useQuery({
        queryKey: ['vimotion-default-brand-kit', instituteId],
        queryFn: () => getDefaultBrandKit(instituteId),
        enabled: !!instituteId && !dismissed,
        staleTime: 0,
    });

    // Hide once a default kit exists or the user dismisses.
    if (!instituteId) return null;
    if (dismissed) return null;
    if (defaultKitQuery.isLoading) return null;
    if (defaultKitQuery.data) return null;

    const skip = () => {
        markSkipped(instituteId);
        setDismissed(true);
    };

    return (
        <>
            <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary-50/80 blur-2xl" />
                <button
                    type="button"
                    onClick={skip}
                    aria-label="Dismiss"
                    className="absolute right-4 top-4 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                >
                    <X className="size-4" />
                </button>

                <div className="relative flex items-start gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                        <Sparkles className="size-5 text-primary-500" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-base font-semibold text-neutral-900">
                            Welcome to Vimotion
                        </h2>
                        <p className="mt-1 text-sm text-neutral-600">
                            Set up your default brand kit so every video stays on-brand from the
                            start. Takes about a minute — you can refine it any time.
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                            <Button
                                type="button"
                                onClick={() => setDrawerOpen(true)}
                                className="gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
                            >
                                Set up brand kit
                                <ArrowRight className="size-4" />
                            </Button>
                            <button
                                type="button"
                                onClick={skip}
                                className="text-sm text-neutral-500 hover:text-neutral-700"
                            >
                                Skip for now
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <BrandKitDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                instituteId={instituteId}
                kit={null}
            />
        </>
    );
}
