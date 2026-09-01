import { useQuery } from '@tanstack/react-query';
import { fetchAudienceFormSettings } from '@/services/audience-post-submit-settings';
import { AUDIENCE_FORM_SETTINGS_QUERY_KEY } from '@/routes/settings/-components/AudienceFormSettings';

/**
 * Whether campaign share surfaces may offer a short URL.
 *
 * Reads the institute's `AUDIENCE_FORM_SETTING` through the SAME react-query key
 * the settings page uses, so all three share surfaces (card link row, kebab menu,
 * share dialog) resolve from one cached request no matter how many campaign cards
 * are on screen — and flipping the switch in Settings is reflected here without a
 * reload, because saving there invalidates this key.
 *
 * **Defaults to ON, including while the request is in flight.** The switch ships
 * enabled, so `undefined !== false` is the correct optimistic answer: an institute
 * that never touched the setting sees the short-link controls immediately rather
 * than watching them pop in a beat late. Only an explicit `false` hides them.
 */
export function useAudienceShortLinksEnabled(): boolean {
    const { data } = useQuery({
        queryKey: AUDIENCE_FORM_SETTINGS_QUERY_KEY,
        queryFn: fetchAudienceFormSettings,
        staleTime: 5 * 60 * 1000,
    });
    return data?.shortLinksEnabled !== false;
}
