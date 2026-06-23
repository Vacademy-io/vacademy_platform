import { useQuery } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { fetchTelephonyConfig, fetchTelephonyProviders } from '../-services/telephony-admin';
import { TelephonyConfigCard } from './telephony-config-card';
import { TelephonyCounsellorMapCard } from './telephony-counsellor-map-card';
import { TelephonyNumbersCard } from './telephony-numbers-card';
import { InboundSetupGuideCard } from './inbound-setup-guide-card';
import { TelephonyCreditsCard } from './telephony-credits-card';

/**
 * Provider-aware Calling settings stack. The provider Config card is ALWAYS
 * shown (it's where you pick + configure the provider). Every other card is
 * gated by the ACTIVE provider's capability flags so each vendor only sees what
 * applies to it, instead of a one-size-fits-all stack:
 *
 *   • Exotel — `BALANCE` → wallet, `SYNC_INBOUND_APPLET` → inbound-flow guide,
 *     `NUMBER_POOL` → the ExoPhone number fleet.
 *   • Airtel — no pool (`OUTBOUND_CALL` && !`NUMBER_POOL`) → the per-counsellor
 *     extension map.
 *
 * The capabilities come from `GET /telephony/providers`; the active provider
 * from the institute's config. Both queries share the cache with the individual
 * cards, so there are no extra fetches. Until they load (or before a provider is
 * configured) only the Config card shows — the right cards appear on resolve.
 */
export function TelephonyProviderCards() {
    const instituteId = getCurrentInstituteId() ?? '';

    const configQuery = useQuery({
        queryKey: ['telephony-config', instituteId],
        queryFn: () => fetchTelephonyConfig(instituteId),
        enabled: !!instituteId,
    });
    const providersQuery = useQuery({
        queryKey: ['telephony-providers'],
        queryFn: fetchTelephonyProviders,
    });

    const providerType = configQuery.data?.providerType ?? '';
    const capabilities =
        providersQuery.data?.find((p) => p.providerType === providerType)?.capabilities ?? [];
    const has = (capability: string) => capabilities.includes(capability);

    const showWallet = has('BALANCE');
    const showInboundApplet = has('SYNC_INBOUND_APPLET');
    const showNumberPool = has('NUMBER_POOL');
    // No-pool outbound providers (Airtel) dial from a per-counsellor extension.
    const showCounsellorMap = has('OUTBOUND_CALL') && !has('NUMBER_POOL');

    return (
        <>
            {showWallet && <TelephonyCreditsCard />}
            <TelephonyConfigCard />
            {showCounsellorMap && <TelephonyCounsellorMapCard />}
            {showInboundApplet && <InboundSetupGuideCard />}
            {showNumberPool && <TelephonyNumbersCard />}
        </>
    );
}
