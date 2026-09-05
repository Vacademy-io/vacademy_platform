import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GtmSettingsData {
    enabled: boolean;
    containerId: string;
}

const DEFAULT_GTM_SETTINGS: GtmSettingsData = {
    enabled: false,
    containerId: '',
};

const SETTING_KEY = 'GTM_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/;

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchGtmSettings = async (): Promise<GtmSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    return response.data?.data ?? DEFAULT_GTM_SETTINGS;
};

const saveGtmSettings = async (data: GtmSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'GTM Settings', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function GtmSettings() {
    const { t } = useTranslation('settingsGtm');
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<GtmSettingsData>(DEFAULT_GTM_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['gtm-settings'],
        queryFn: fetchGtmSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveGtmSettings,
        onSuccess: () => {
            toast.success(t('toasts.saveSuccess'));
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['gtm-settings'] });
        },
        onError: () => {
            toast.error(t('toasts.saveError'));
        },
    });

    const update = (patch: Partial<GtmSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const handleSave = () => {
        if (settings.enabled && !GTM_ID_PATTERN.test(settings.containerId)) {
            toast.error(t('errors.invalidContainerId'));
            return;
        }
        save(settings);
    };

    if (isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">{t('loading')}</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('card.title')}</CardTitle>
                    <CardDescription>
                        {t('card.description.part1')}
                        <code>enrollment_success</code>
                        {t('card.description.part2')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="gtm-enabled"
                            checked={settings.enabled}
                            onCheckedChange={(v) => update({ enabled: v })}
                        />
                        <Label htmlFor="gtm-enabled" className="cursor-pointer">
                            {settings.enabled ? t('toggle.enabled') : t('toggle.disabled')}
                        </Label>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="gtm-container-id">{t('containerId.label')}</Label>
                        <Input
                            id="gtm-container-id"
                            placeholder={t('containerId.placeholder')}
                            value={settings.containerId}
                            disabled={!settings.enabled}
                            onChange={(e) =>
                                update({ containerId: e.target.value.toUpperCase().trim() })
                            }
                            className="max-w-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('containerId.hint')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !hasChanges}
                >
                    {saving ? t('footer.saving') : t('footer.save')}
                </MyButton>
            </div>
        </div>
    );
}
