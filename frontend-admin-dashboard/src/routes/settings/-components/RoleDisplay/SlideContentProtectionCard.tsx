import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';

// Institute-wide (single boolean) setting, saved via the generic setting endpoints.
const SETTING_KEY = 'SLIDE_CONTENT_PROTECTION_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

const fetchEnabled = async (): Promise<boolean> => {
    const instituteId = getInstituteId();
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: SETTING_KEY },
        });
        return !!response.data?.data?.enabled;
    } catch {
        return false;
    }
};

const saveEnabled = async (enabled: boolean): Promise<void> => {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Slide Content Protection', setting_data: { enabled } },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

/**
 * Per-institute toggle: when on, the learner app blocks right-click and the
 * common DevTools / view-source shortcuts on slides. Best-effort deterrent only.
 */
export default function SlideContentProtectionCard() {
    const queryClient = useQueryClient();
    const [enabled, setEnabled] = useState(false);
    const [dirty, setDirty] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['slide-content-protection'],
        queryFn: fetchEnabled,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data !== undefined) {
            setEnabled(!!data);
            setDirty(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: () => saveEnabled(enabled),
        onSuccess: () => {
            toast.success('Slide content protection saved');
            setDirty(false);
            queryClient.invalidateQueries({ queryKey: ['slide-content-protection'] });
        },
        onError: () => {
            toast.error('Failed to save slide content protection');
        },
    });

    if (isLoading) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Slide Content Protection</CardTitle>
                <CardDescription>
                    Disable right-click and the common developer / view-source shortcuts (F12,
                    Ctrl/Cmd+Shift+I/J/C, Ctrl+U) on slides in the learner app. This is a
                    best-effort deterrent — it does not fully prevent inspection (developer tools
                    can still be opened from the browser menu). Append{' '}
                    <code className="rounded bg-neutral-100 px-1 text-xs">?access=dev</code> to the
                    URL to bypass it while testing.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <Label
                        htmlFor="slide-content-protection"
                        className="cursor-pointer text-sm font-medium text-neutral-800"
                    >
                        Disable right-click &amp; inspect shortcuts on slides
                    </Label>
                    <Switch
                        id="slide-content-protection"
                        checked={enabled}
                        onCheckedChange={(v) => {
                            setEnabled(v);
                            setDirty(true);
                        }}
                    />
                </div>
                <div className="flex justify-end border-t pt-4">
                    <MyButton
                        buttonType="primary"
                        onClick={() => save()}
                        disable={saving || !dirty}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </MyButton>
                </div>
            </CardContent>
        </Card>
    );
}
