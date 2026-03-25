import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { AssessmentSettingsData, DEFAULT_ASSESSMENT_SETTINGS } from '@/types/assessment-settings';
import { getAssessmentSettings, saveAssessmentSettings } from '@/services/assessment-settings';

const AssessmentSettings = () => {
    const [settings, setSettings] = useState<AssessmentSettingsData>(DEFAULT_ASSESSMENT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await getAssessmentSettings(true);
                setSettings(data);
            } catch {
                toast.error('Failed to load assessment settings');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleToggle = (key: keyof AssessmentSettingsData, field: string, value: boolean) => {
        setSettings((prev) => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveAssessmentSettings(settings);
            setHasChanges(false);
            toast.success('Assessment settings saved successfully');
        } catch {
            toast.error('Failed to save assessment settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-sm text-gray-500">Loading assessment settings...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Assessment Settings</h2>
                    <p className="text-sm text-gray-500">
                        Configure assessment features for your institute
                    </p>
                </div>
                <MyButton
                    type="button"
                    scale="small"
                    buttonType="primary"
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className="flex items-center gap-2 font-medium"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </MyButton>
            </div>

            {/* Offline Data Entry */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Offline Data Entry</CardTitle>
                    <CardDescription>
                        Allow data entry users to manually input student responses from
                        paper-based tests. This enables analytics for both online and offline
                        exams.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex flex-col gap-1">
                            <Label className="text-sm font-medium">
                                Enable Offline Entry
                            </Label>
                            <p className="text-xs text-gray-500">
                                Shows the "Offline Entry" button on the assessment submissions
                                page
                            </p>
                        </div>
                        <Switch
                            checked={settings.offlineEntry.enabled}
                            onCheckedChange={(checked) =>
                                handleToggle('offlineEntry', 'enabled', checked)
                            }
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AssessmentSettings;
