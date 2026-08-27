/**
 * PackageSessionRenewalSettings — opt-in toggle for the daily package-session
 * renewal/expiry scheduler.
 *
 * Stored in institute settings under PAYMENT_SETTING.data
 * (packageSessionRenewalSchedulerEnabled). The backend job
 * (PackageSessionScheduler.processPackageSessionRenewals, daily 04:00) only
 * processes institutes where this flag is true — absent/false means the
 * institute's user plans are never touched by the scan.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { ArrowsClockwise } from '@phosphor-icons/react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useTranslation } from 'react-i18next';

const SETTING_KEY = 'PAYMENT_SETTING';
const RENEWAL_FLAG = 'packageSessionRenewalSchedulerEnabled';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

type PaymentSettingData = Record<string, unknown>;

const fetchPaymentSetting = async (): Promise<PaymentSettingData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    // GET returns the SettingDto ({key, name, data}); its content sits one
    // level down at response.data.data (same as OnboardingSettings.tsx).
    return (response.data?.data as PaymentSettingData) ?? {};
};

// Saves the WHOLE data object (current state with the toggled flag patched in)
// so any other PAYMENT_SETTING fields added later are preserved on save.
const savePaymentSetting = async (data: PaymentSettingData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Payment Setting', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

export default function PackageSessionRenewalSettings() {
    const { t } = useTranslation('settingsPackageSessionRenewal');
    const queryClient = useQueryClient();
    const [settingData, setSettingData] = useState<PaymentSettingData>({});
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['payment-setting'],
        queryFn: fetchPaymentSetting,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettingData(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: savePaymentSetting,
        onSuccess: () => {
            toast.success(t('toasts.saveSuccess'));
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['payment-setting'] });
        },
        onError: () => {
            toast.error(t('toasts.saveError'));
        },
    });

    const enabled = settingData[RENEWAL_FLAG] === true;

    const handleToggle = (value: boolean) => {
        setSettingData((prev) => ({ ...prev, [RENEWAL_FLAG]: value }));
        setHasChanges(true);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <ArrowsClockwise className="size-5" />
                    {t('title')}
                </CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-body text-neutral-500">{t('loading')}</div>
                ) : (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="package-session-renewal-enabled"
                                checked={enabled}
                                onCheckedChange={handleToggle}
                            />
                            <Label
                                htmlFor="package-session-renewal-enabled"
                                className="cursor-pointer"
                            >
                                {enabled ? t('toggle.enabled') : t('toggle.disabled')}
                            </Label>
                        </div>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={() => save(settingData)}
                            disable={saving || !hasChanges}
                        >
                            {saving ? t('button.saving') : t('button.save')}
                        </MyButton>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
