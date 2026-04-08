import { useState, useEffect } from 'react';
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
    return response.data?.data?.[SETTING_KEY]?.data ?? DEFAULT_GTM_SETTINGS;
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
            toast.success('GTM settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['gtm-settings'] });
        },
        onError: () => {
            toast.error('Failed to save GTM settings');
        },
    });

    const update = (patch: Partial<GtmSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const handleSave = () => {
        if (settings.enabled && !GTM_ID_PATTERN.test(settings.containerId)) {
            toast.error('Invalid GTM Container ID. Expected format: GTM-XXXXXXX');
            return;
        }
        save(settings);
    };

    if (isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading GTM settings…</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Google Tag Manager</CardTitle>
                    <CardDescription>
                        Inject your GTM container on learner enrollment pages. This enables
                        conversion tracking, remarketing pixels, and any tags you configure in
                        your GTM workspace. An <code>enrollment_success</code> event is pushed
                        to the dataLayer on successful registration.
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
                            {settings.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="gtm-container-id">Container ID</Label>
                        <Input
                            id="gtm-container-id"
                            placeholder="GTM-XXXXXXX"
                            value={settings.containerId}
                            disabled={!settings.enabled}
                            onChange={(e) =>
                                update({ containerId: e.target.value.toUpperCase().trim() })
                            }
                            className="max-w-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                            Find your Container ID in GTM → Admin → Container Settings.
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
                    {saving ? 'Saving…' : 'Save GTM Settings'}
                </MyButton>
            </div>
        </div>
    );
}
