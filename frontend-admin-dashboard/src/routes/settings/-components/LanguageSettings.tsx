/**
 * LanguageSettings — Settings > Language Settings card. Configures the
 * institute's LANGUAGE_SETTING (snake_case backend contract, wholly owned by
 * this card — no sibling keys to preserve):
 *
 *   1. default_locale         → language users see before picking their own
 *   2. enabled_locales        → languages offered in the switcher
 *   3. content_source_locale  → language course content is authored in
 *   4. timezone               → institute IANA timezone
 *
 * Persisted via the generic institute-setting endpoints
 * (POST .../institute/setting/v1/save-setting?settingKey=LANGUAGE_SETTING,
 * GET .../institute/setting/v1/get?settingKey=LANGUAGE_SETTING) mirroring the
 * LeadReportSettings save path. On save the local cache
 * (localStorage 'languageSetting') is refreshed so the navbar switcher and
 * pickers react without a reload.
 *
 * First i18n-native settings card — every string renders through t()
 * (settings.language.* keys in src/locales/<locale>/common.json).
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Translate } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MultiSelect, type OptionType } from '@/components/design-system/multi-select';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    DEFAULT_LOCALE,
    LOCALE_LABELS,
    SUPPORTED_LOCALES,
    isSupportedLocale,
    normalizeLocale,
    type SupportedLocale,
} from '@/i18n/locales';
import { setLanguageSettingCache, type LanguageSetting } from '@/services/language-settings';
import { REPORT_TIMEZONES } from './LeadReportSettings';

const SETTING_KEY = 'LANGUAGE_SETTING';
// Mirrors LeadReportSettings.tsx — the generic institute-settings save endpoint.
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

export const LANGUAGE_SETTING_QUERY_KEY = ['language-setting'];

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const LOCALE_OPTIONS: OptionType[] = SUPPORTED_LOCALES.map((code) => ({
    value: code,
    label: LOCALE_LABELS[code],
}));

/**
 * Reads the saved LANGUAGE_SETTING data object. The GET returns the SettingDto
 * itself ({key, name, data}) so the content is at response.data.data (same
 * shape precedent as hooks/use-lead-report-settings.ts). Most institutes don't
 * have the key yet → null (card falls back to defaults).
 */
async function fetchLanguageSetting(): Promise<LanguageSetting | null> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return null;
    try {
        const response = await authenticatedAxiosInstance.get(GET_INSITITUTE_SETTINGS, {
            params: { instituteId, settingKey: SETTING_KEY },
        });
        const data = response.data?.data;
        return data && typeof data === 'object' && !Array.isArray(data)
            ? (data as LanguageSetting)
            : null;
    } catch {
        // Setting absent (or endpoint errored) — treat as not configured.
        return null;
    }
}

async function saveLanguageSetting(next: LanguageSetting): Promise<void> {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Language Settings', setting_data: next },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
}

export default function LanguageSettings() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: saved, isLoading } = useQuery({
        queryKey: LANGUAGE_SETTING_QUERY_KEY,
        queryFn: fetchLanguageSetting,
        staleTime: 5 * 60 * 1000,
    });

    const [defaultLocale, setDefaultLocale] = useState<SupportedLocale>(DEFAULT_LOCALE);
    const [enabledLocales, setEnabledLocales] = useState<string[]>([DEFAULT_LOCALE]);
    const [contentSourceLocale, setContentSourceLocale] =
        useState<SupportedLocale>(DEFAULT_LOCALE);
    const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (saved) {
            setDefaultLocale(normalizeLocale(saved.default_locale));
            setEnabledLocales(
                (saved.enabled_locales ?? []).filter(isSupportedLocale).length > 0
                    ? (saved.enabled_locales ?? []).filter(isSupportedLocale)
                    : [DEFAULT_LOCALE]
            );
            setContentSourceLocale(normalizeLocale(saved.content_source_locale));
            setTimezone(saved.timezone || DEFAULT_TIMEZONE);
            setHasChanges(false);
        }
    }, [saved]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveLanguageSetting,
        onSuccess: (_data, payload) => {
            // Refresh the local cache so the navbar switcher and language
            // pickers pick the change up without a reload.
            setLanguageSettingCache(payload);
            toast.success(t('settings.language.saved'));
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: LANGUAGE_SETTING_QUERY_KEY });
        },
        onError: () => {
            toast.error(t('settings.language.saveFailed'));
        },
    });

    const handleSave = () => {
        if (enabledLocales.length === 0) {
            toast.error(t('settings.language.enabledRequired'));
            return;
        }
        // The default language is always offered — fold it in, then store in
        // canonical SUPPORTED_LOCALES order.
        const enabledSet = new Set<string>([...enabledLocales, defaultLocale]);
        const enabled = SUPPORTED_LOCALES.filter((locale) => enabledSet.has(locale));
        save({
            default_locale: defaultLocale,
            enabled_locales: enabled,
            content_source_locale: contentSourceLocale,
            timezone,
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Translate size={18} className="text-neutral-500" />
                    {t('settings.language.title')}
                </CardTitle>
                <CardDescription>{t('settings.language.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">
                        {t('settings.language.loading')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {/* Default language */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="default-language">
                                {t('settings.language.defaultLabel')}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                {t('settings.language.defaultHelp')}
                            </p>
                            <Select
                                value={defaultLocale}
                                onValueChange={(v) => {
                                    setDefaultLocale(normalizeLocale(v));
                                    setHasChanges(true);
                                }}
                            >
                                <SelectTrigger id="default-language" className="w-full max-w-sm">
                                    <SelectValue
                                        placeholder={t('settings.language.selectPlaceholder')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {LOCALE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <span lang={option.value}>{option.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Enabled languages */}
                        <div className="flex flex-col gap-1.5">
                            <Label>{t('settings.language.enabledLabel')}</Label>
                            <p className="text-xs text-muted-foreground">
                                {t('settings.language.enabledHelp')}
                            </p>
                            <MultiSelect
                                options={LOCALE_OPTIONS}
                                selected={enabledLocales}
                                onChange={(v) => {
                                    setEnabledLocales(v);
                                    setHasChanges(true);
                                }}
                                placeholder={t('settings.language.enabledPlaceholder')}
                                className="max-w-sm"
                            />
                        </div>

                        {/* Content source language */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="content-source-language">
                                {t('settings.language.contentSourceLabel')}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                {t('settings.language.contentSourceHelp')}
                            </p>
                            <Select
                                value={contentSourceLocale}
                                onValueChange={(v) => {
                                    setContentSourceLocale(normalizeLocale(v));
                                    setHasChanges(true);
                                }}
                            >
                                <SelectTrigger
                                    id="content-source-language"
                                    className="w-full max-w-sm"
                                >
                                    <SelectValue
                                        placeholder={t('settings.language.selectPlaceholder')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {LOCALE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <span lang={option.value}>{option.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Institute timezone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="institute-timezone">
                                {t('settings.language.timezoneLabel')}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                {t('settings.language.timezoneHelp')}
                            </p>
                            <Select
                                value={timezone}
                                onValueChange={(v) => {
                                    setTimezone(v);
                                    setHasChanges(true);
                                }}
                            >
                                <SelectTrigger id="institute-timezone" className="w-full max-w-sm">
                                    <SelectValue
                                        placeholder={t('settings.language.timezonePlaceholder')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {REPORT_TIMEZONES.map((tz) => (
                                        <SelectItem key={tz} value={tz}>
                                            {tz}
                                        </SelectItem>
                                    ))}
                                    {/* Keep a previously saved non-curated zone selectable. */}
                                    {!(REPORT_TIMEZONES as readonly string[]).includes(
                                        timezone
                                    ) && <SelectItem value={timezone}>{timezone}</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-end">
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onClick={handleSave}
                                disable={saving || !hasChanges}
                            >
                                {saving
                                    ? t('settings.language.saving')
                                    : t('settings.language.save')}
                            </MyButton>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
