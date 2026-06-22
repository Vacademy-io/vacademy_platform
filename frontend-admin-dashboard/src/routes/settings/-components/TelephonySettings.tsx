import { TelephonyConfigCard } from '@/routes/settings/telephony/-components/telephony-config-card';
import { TelephonyCounsellorMapCard } from '@/routes/settings/telephony/-components/telephony-counsellor-map-card';
import { TelephonyNumbersCard } from '@/routes/settings/telephony/-components/telephony-numbers-card';
import { InboundSetupGuideCard } from '@/routes/settings/telephony/-components/inbound-setup-guide-card';
import { TelephonyCreditsCard } from '@/routes/settings/telephony/-components/telephony-credits-card';

/**
 * Settings → Calling tab. Thin shell around the cards that already live
 * under routes/settings/telephony/-components — same components, just rendered
 * inside the unified Settings page tab framework instead of as a standalone
 * route.
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
            <TelephonyCreditsCard />
            <TelephonyConfigCard />
            <TelephonyCounsellorMapCard />
            <InboundSetupGuideCard />
            <TelephonyNumbersCard />
        </div>
    );
}
