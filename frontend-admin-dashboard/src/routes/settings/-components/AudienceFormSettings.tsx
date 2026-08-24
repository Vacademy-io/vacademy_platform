/**
 * Settings → Lead Settings → Forms.
 *
 * Institute-wide DEFAULT post-submit configuration for audience-list forms.
 * Saved under the `AUDIENCE_FORM_SETTING` institute setting and prefilled into
 * every NEW campaign created in Audience Manager, so a thank-you screen /
 * redirect is configured once for the whole institute instead of per list.
 *
 * Editing here never rewrites campaigns that are already saved — each campaign
 * keeps its own copy in `audience.setting_json` from the moment it is created.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PostSubmitConfigurationEditor from '@/components/audience/PostSubmitConfigurationEditor';
import {
    AudiencePostSubmitConfiguration,
    DEFAULT_POST_SUBMIT_CONFIGURATION,
    fetchAudienceFormSettings,
    saveAudienceFormSettings,
    validatePostSubmitConfiguration,
} from '@/services/audience-post-submit-settings';

export const AUDIENCE_FORM_SETTINGS_QUERY_KEY = ['audience-form-settings'];

export default function AudienceFormSettings() {
    const queryClient = useQueryClient();
    const [config, setConfig] = useState<AudiencePostSubmitConfiguration>(
        DEFAULT_POST_SUBMIT_CONFIGURATION
    );
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: AUDIENCE_FORM_SETTINGS_QUERY_KEY,
        queryFn: fetchAudienceFormSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setConfig(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveAudienceFormSettings,
        onSuccess: () => {
            toast.success('Form settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: AUDIENCE_FORM_SETTINGS_QUERY_KEY });
        },
        onError: () => {
            toast.error('Failed to save form settings');
        },
    });

    const handleSave = () => {
        const error = validatePostSubmitConfiguration(config);
        if (error) {
            toast.error(error);
            return;
        }
        save(config);
    };

    const handleResetToDefaults = () => {
        setConfig(DEFAULT_POST_SUBMIT_CONFIGURATION);
        setHasChanges(true);
    };

    if (isLoading) {
        return <div className="text-body text-neutral-500">Loading form settings…</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Audience Form Defaults</CardTitle>
                    <CardDescription>
                        The thank-you screen every new audience list starts with. Each campaign can
                        override it while being created or edited — changes here only affect
                        campaigns created from now on.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PostSubmitConfigurationEditor
                        value={config}
                        withCard={false}
                        onChange={(next) => {
                            setConfig(next);
                            setHasChanges(true);
                        }}
                    />
                </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3">
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="medium"
                    onClick={handleResetToDefaults}
                    disabled={saving}
                >
                    Restore Defaults
                </MyButton>
                <MyButton
                    type="button"
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </MyButton>
            </div>
        </div>
    );
}
