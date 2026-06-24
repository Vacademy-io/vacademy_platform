import { TelephonyProviderCards } from '@/routes/settings/telephony/-components/telephony-provider-cards';

/**
 * Settings → Calling tab. Thin shell around the provider-aware card stack that
 * lives under routes/settings/telephony/-components — same components, just
 * rendered inside the unified Settings page tab framework instead of as a
 * standalone route. Which cards show depends on the active provider's
 * capabilities (see TelephonyProviderCards).
 */
export default function TelephonySettings() {
    return (
        <div className="flex w-full flex-col gap-5 p-4">
            <div>
                <h1 className="text-xl font-semibold text-neutral-900">Calling</h1>
                <p className="text-sm text-neutral-500">
                    Connect your telephony provider, manage caller-ID numbers, and pick
                    how leads are routed across them.
                </p>
            </div>
            <TelephonyProviderCards />
        </div>
    );
}
