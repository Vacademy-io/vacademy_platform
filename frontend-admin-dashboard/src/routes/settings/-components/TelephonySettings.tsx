import { useTranslation } from 'react-i18next';
import { TelephonyProviderCards } from '@/routes/settings/telephony/-components/telephony-provider-cards';

/**
 * Settings → Calling tab. Thin shell around the provider-aware card stack that
 * lives under routes/settings/telephony/-components — same components, just
 * rendered inside the unified Settings page tab framework instead of as a
 * standalone route. Which cards show depends on the active provider's
 * capabilities (see TelephonyProviderCards).
 */
export default function TelephonySettings() {
    const { t } = useTranslation('settingsTelephony');
    return (
        <div className="flex w-full flex-col gap-5 p-4">
            <div>
                <h1 className="text-xl font-semibold text-neutral-900">{t('title')}</h1>
                <p className="text-sm text-neutral-500">{t('description')}</p>
            </div>
            <TelephonyProviderCards />
        </div>
    );
}
