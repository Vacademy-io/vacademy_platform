import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Sparkle } from '@phosphor-icons/react';
import { getWaitlistStatus, type WaitlistStatusResponse } from '../api/waitlist';
import { ShareBlock } from './ShareBlock';
import { LiveCounter } from './LiveCounter';

interface WaitlistSuccessProps {
    initial: WaitlistStatusResponse;
    bumpPerReferral?: number;
    onForget: () => void;
}

const REFERRAL_BUMP_DEFAULT = 5;

export function WaitlistSuccess({
    initial,
    bumpPerReferral = REFERRAL_BUMP_DEFAULT,
    onForget,
}: WaitlistSuccessProps) {
    // Poll status — referrer's count goes up when their referees join, so
    // the displayed position should "skip the line" in near real time.
    const { data } = useQuery({
        queryKey: ['vimotion', 'waitlist', 'status', initial.email],
        queryFn: () => getWaitlistStatus(initial.email),
        refetchInterval: 30_000,
        initialData: initial,
    });

    const status = data ?? initial;
    const skipped = status.referral_count * bumpPerReferral;

    return (
        <div className="space-y-6">
            <div className="flex justify-start">
                <LiveCounter seed={status.total_count} />
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle className="size-5" weight="fill" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-neutral-500">You&rsquo;re in</p>
                        <p className="text-4xl font-semibold tracking-tight text-neutral-900">
                            #{status.effective_position.toLocaleString()}
                        </p>
                        <p className="text-sm text-neutral-500">
                            {status.referral_count > 0 ? (
                                <>
                                    You&rsquo;ve skipped{' '}
                                    <span className="font-semibold text-neutral-900">
                                        {skipped}
                                    </span>{' '}
                                    {skipped === 1 ? 'spot' : 'spots'} via{' '}
                                    <span className="font-semibold text-neutral-900">
                                        {status.referral_count}
                                    </span>{' '}
                                    {status.referral_count === 1 ? 'referral' : 'referrals'}.
                                </>
                            ) : (
                                <>Your baseline is #{status.position.toLocaleString()}.</>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkle className="size-4 text-neutral-700" weight="fill" />
                    <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
                        Skip the line — refer friends
                    </h2>
                </div>
                <p className="text-sm text-neutral-500">
                    Each friend who joins via your link moves you up{' '}
                    <span className="font-semibold text-neutral-900">{bumpPerReferral} spots</span>
                    .
                </p>
                <ShareBlock referralCode={status.referral_code} />
            </div>

            <p className="text-center text-xs text-neutral-400">
                Wrong email?{' '}
                <button
                    type="button"
                    onClick={onForget}
                    className="underline hover:text-neutral-600"
                >
                    Sign someone else up
                </button>
            </p>
        </div>
    );
}
