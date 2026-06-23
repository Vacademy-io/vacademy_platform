import { useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { TelephonyConfigCard } from './telephony-config-card';
import { TelephonyCounsellorMapCard } from './telephony-counsellor-map-card';
import { TelephonyNumbersCard } from './telephony-numbers-card';

/**
 * Single-page admin surface for telephony — provider creds at the top, number
 * fleet underneath. The two pieces are intentionally independent so an admin
 * can update credentials without scrolling past a long number list, and vice
 * versa.
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
            <TelephonyConfigCard />
            <TelephonyCounsellorMapCard />
            <TelephonyNumbersCard />
        </div>
    );
}
