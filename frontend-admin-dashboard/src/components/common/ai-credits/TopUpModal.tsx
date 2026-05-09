import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkle, CheckCircle, Warning } from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    useCreditPacksQuery,
    usePurchaseCreditPackMutation,
    useOrderStatusQuery,
    useInvalidateCreditQueriesOnPaid,
    loadRazorpayScript,
    openRazorpayCheckout,
    type CreditPack,
} from '@/services/ai-credits/credit-pack-services';

interface TopUpModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type Phase = 'pick' | 'launching' | 'awaiting' | 'success' | 'error';

/**
 * Modal: pick a pack -> create Razorpay order -> open Razorpay Checkout ->
 * poll our /orders/{id}/status until PAID. Webhook is the source of truth;
 * this UI just reflects what the webhook has fulfilled.
 */
export function TopUpModal({ open, onOpenChange }: TopUpModalProps) {
    const instituteId = getCurrentInstituteId();
    const packsQuery = useCreditPacksQuery(instituteId, open);
    const purchaseMutation = usePurchaseCreditPackMutation();
    const invalidateCredits = useInvalidateCreditQueriesOnPaid();

    const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
    const [phase, setPhase] = useState<Phase>('pick');
    const [pollingFor, setPollingFor] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Poll status every 2s while awaiting webhook fulfillment.
    const statusQuery = useOrderStatusQuery(
        pollingFor,
        phase === 'awaiting' ? 2000 : false,
        phase === 'awaiting',
    );

    // Reset state on close so re-open starts fresh.
    useEffect(() => {
        if (!open) {
            setSelectedPackId(null);
            setPhase('pick');
            setPollingFor(null);
            setErrorMessage(null);
        }
    }, [open]);

    // Auto-pick the badged pack on first load (Most Popular).
    useEffect(() => {
        if (open && packsQuery.data && !selectedPackId) {
            const popular =
                packsQuery.data.find((p) => p.badge === 'Most Popular') ??
                packsQuery.data[0];
            if (popular) setSelectedPackId(popular.pack_id);
        }
    }, [open, packsQuery.data, selectedPackId]);

    // React to status polling: PAID -> celebrate; FAILED -> show error.
    useEffect(() => {
        if (phase !== 'awaiting' || !statusQuery.data) return;
        if (statusQuery.data.payment_status === 'PAID') {
            setPhase('success');
            invalidateCredits();
            toast.success('Credits added to your balance', {
                description: statusQuery.data.credits_granted
                    ? `+${statusQuery.data.credits_granted} credits`
                    : undefined,
            });
        } else if (statusQuery.data.payment_status === 'FAILED') {
            setPhase('error');
            setErrorMessage('Payment was not completed. No credits were charged.');
        }
    }, [phase, statusQuery.data, invalidateCredits]);

    // Stop polling after 60s — webhook may run later under load.
    useEffect(() => {
        if (phase !== 'awaiting' || !pollingFor) return;
        const timer = setTimeout(() => {
            if (phase === 'awaiting') {
                toast.message('Payment is processing', {
                    description: 'Credits will appear in your balance shortly.',
                });
                onOpenChange(false);
            }
        }, 60_000);
        return () => clearTimeout(timer);
    }, [phase, pollingFor, onOpenChange]);

    const selectedPack = useMemo(
        () => packsQuery.data?.find((p) => p.pack_id === selectedPackId) ?? null,
        [packsQuery.data, selectedPackId],
    );

    const handleBuy = async () => {
        if (!instituteId || !selectedPack) return;
        setPhase('launching');
        setErrorMessage(null);

        try {
            await loadRazorpayScript();
            const order = await purchaseMutation.mutateAsync({
                instituteId,
                packId: selectedPack.pack_id,
            });

            // Open Razorpay Checkout. The handler fires on FE-success — but we
            // do NOT trust it for fulfillment; we poll our backend instead.
            openRazorpayCheckout({
                key: order.razorpay_key_id,
                order_id: order.razorpay_order_id,
                amount: order.amount_minor,
                currency: order.currency,
                name: 'Vacademy AI Credits',
                description: `${order.pack_code} pack`,
                theme: { color: '#7c3aed' },
                handler: () => {
                    // Razorpay confirmed payment client-side. Switch to polling
                    // so we wait for the webhook to actually grant credits.
                    setPhase('awaiting');
                    setPollingFor(order.platform_payment_id);
                },
                modal: {
                    ondismiss: () => {
                        // User closed Razorpay without paying. Keep the modal
                        // open at pick phase so they can try again.
                        if (phase === 'launching') setPhase('pick');
                    },
                },
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to start payment';
            setPhase('error');
            setErrorMessage(message);
            toast.error('Could not start payment', { description: message });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkle className="size-5 text-purple-600" weight="fill" />
                        Top up AI credits
                    </DialogTitle>
                    <DialogDescription>
                        Pick a pack — credits land in your balance the moment payment
                        clears. GST is added at checkout for Indian institutes.
                    </DialogDescription>
                </DialogHeader>

                {/* Pack picker */}
                {phase === 'pick' && (
                    <div className="space-y-3">
                        {packsQuery.isLoading && (
                            <div className="grid grid-cols-2 gap-3">
                                {[0, 1, 2, 3].map((i) => (
                                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                                ))}
                            </div>
                        )}

                        {packsQuery.isError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                Could not load packs. Please try again later.
                            </div>
                        )}

                        {packsQuery.data && packsQuery.data.length === 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                                No credit packs are available for your region yet. Contact
                                support.
                            </div>
                        )}

                        {packsQuery.data && packsQuery.data.length > 0 && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {packsQuery.data.map((pack) => (
                                    <PackCard
                                        key={pack.pack_id}
                                        pack={pack}
                                        selected={pack.pack_id === selectedPackId}
                                        onSelect={() => setSelectedPackId(pack.pack_id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Launching — disabled state while we create the order */}
                {phase === 'launching' && (
                    <div className="flex flex-col items-center gap-3 py-10">
                        <Loader2 className="size-8 animate-spin text-purple-600" />
                        <p className="text-sm text-neutral-600">Opening Razorpay…</p>
                    </div>
                )}

                {/* Awaiting webhook — Razorpay said yes, we wait for backend confirm */}
                {phase === 'awaiting' && (
                    <div className="flex flex-col items-center gap-3 py-10">
                        <Loader2 className="size-8 animate-spin text-purple-600" />
                        <p className="text-sm font-medium text-neutral-800">
                            Confirming your payment…
                        </p>
                        <p className="text-xs text-neutral-500">
                            This usually takes a few seconds.
                        </p>
                    </div>
                )}

                {/* Success */}
                {phase === 'success' && (
                    <div className="flex flex-col items-center gap-3 py-10">
                        <CheckCircle className="size-12 text-emerald-500" weight="fill" />
                        <p className="text-base font-semibold text-neutral-900">
                            Payment received — credits added.
                        </p>
                        {statusQuery.data?.credits_granted != null && (
                            <p className="text-sm text-neutral-600">
                                +{statusQuery.data.credits_granted} credits
                            </p>
                        )}
                    </div>
                )}

                {/* Error */}
                {phase === 'error' && (
                    <div className="flex flex-col items-center gap-3 py-10">
                        <Warning className="size-12 text-amber-500" weight="fill" />
                        <p className="text-base font-semibold text-neutral-900">
                            Couldn&rsquo;t process payment
                        </p>
                        {errorMessage && (
                            <p className="max-w-sm text-center text-sm text-neutral-600">
                                {errorMessage}
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {phase === 'pick' && (
                        <>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleBuy}
                                disabled={!selectedPack || purchaseMutation.isPending}
                                className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
                            >
                                {purchaseMutation.isPending && (
                                    <Loader2 className="size-4 animate-spin" />
                                )}
                                {selectedPack
                                    ? `Pay ${selectedPack.display_price_major}`
                                    : 'Pick a pack'}
                            </button>
                        </>
                    )}
                    {(phase === 'success' || phase === 'error') && (
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                        >
                            Done
                        </button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface PackCardProps {
    pack: CreditPack;
    selected: boolean;
    onSelect: () => void;
}

function PackCard({ pack, selected, onSelect }: PackCardProps) {
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
                'group relative rounded-xl border p-4 text-left transition-all',
                selected
                    ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50',
            )}
        >
            {pack.badge && (
                <span className="absolute -top-2 right-3 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                    {pack.badge}
                </span>
            )}
            <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-neutral-900">{pack.name}</span>
                <span className="text-lg font-bold text-neutral-900">
                    {pack.display_price_major}
                </span>
            </div>
            <div className="mt-1 text-xs text-neutral-600">
                {pack.credits.toLocaleString()} credits
            </div>
            <div className="mt-2 border-t border-dashed border-neutral-200 pt-2 text-[11px] text-neutral-500">
                <div className="flex justify-between">
                    <span>Base</span>
                    <span>{pack.display_base_major}</span>
                </div>
                {!pack.is_export && pack.tax_amount_minor > 0 && (
                    <div className="flex justify-between">
                        <span>GST ({(pack.tax_rate_bps / 100).toFixed(0)}%)</span>
                        <span>{pack.display_tax_major}</span>
                    </div>
                )}
                {pack.is_export && (
                    <div className="text-neutral-400">No GST (export)</div>
                )}
            </div>
        </button>
    );
}
