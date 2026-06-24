import { useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { TelephonyProviderCards } from './telephony-provider-cards';

/**
 * Single-page admin surface for telephony. The cards shown adapt to the active
 * provider's capabilities (Exotel: wallet + inbound guide + number fleet;
 * Airtel: per-counsellor extension map) — see TelephonyProviderCards.
 */
export function TelephonySettingsPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Calling</h1>);
    }, [setNavHeading]);

    return (
        <div className="flex w-full flex-col gap-5">
            <div>
                <h1 className="text-2xl font-semibold text-neutral-900">Calling</h1>
                <p className="text-sm text-neutral-500">
                    Connect your telephony provider, manage caller-ID numbers, and pick how
                    leads are routed across them.
                </p>
            </div>
            <TelephonyProviderCards />
        </div>
    );
}
