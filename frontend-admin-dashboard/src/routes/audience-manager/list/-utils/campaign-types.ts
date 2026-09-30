import type { TFunction } from 'i18next';

export interface CampaignTypeOption {
    value: string;
    label: string;
}

// NOTE: `value` is the stable, internal campaign-type key that gets sent to
// the backend / stored in form state — it must never change with locale.
// Only `label` (the displayed text) is translated. Expects a `t` bound to the
// `audienceManagerCampaignTypeDropdown` namespace.
export const buildDefaultCampaignTypeOptions = (t: TFunction): CampaignTypeOption[] => [
    { value: 'Website', label: t('optionWebsite') },
    { value: 'Google Ads', label: t('optionGoogleAds') },
    { value: 'Facebook', label: t('optionFacebook') },
    { value: 'Instagram', label: t('optionInstagram') },
    { value: 'Social Media', label: t('optionSocialMedia') },
];

/**
 * Filter options for the audience-list "campaign type" dropdown: the defaults
 * first, then every other type already saved on a campaign (custom types,
 * system ones like SELF_SIGNUP). Stored values are upper-cased by the form
 * schema, so dedupe case-insensitively and keep the translated default label.
 */
export const buildCampaignTypeFilterOptions = (
    defaults: CampaignTypeOption[],
    savedTypes: (string | undefined | null)[]
): CampaignTypeOption[] => {
    const seen = new Set(defaults.map((o) => o.value.toUpperCase()));
    const extra: CampaignTypeOption[] = [];
    for (const raw of savedTypes) {
        const value = raw?.trim();
        if (!value || seen.has(value.toUpperCase())) continue;
        seen.add(value.toUpperCase());
        extra.push({ value, label: value });
    }
    extra.sort((a, b) => a.label.localeCompare(b.label));
    return [...defaults, ...extra];
};
