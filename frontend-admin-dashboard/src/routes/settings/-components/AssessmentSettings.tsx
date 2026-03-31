import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import {
    AssessmentSettingsData,
    DEFAULT_ASSESSMENT_SETTINGS,
    DEFAULT_REPORT_BRANDING,
    ReportBrandingSettings,
} from '@/types/assessment-settings';
import { getAssessmentSettings, saveAssessmentSettings } from '@/services/assessment-settings';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import ReportBrandingSettingsSection from './ReportBrandingSettings';

const DEFAULT_HEADER_HTML = `<div style="text-align:center; font-size:16px; font-weight:bold;">{{assessment_name}}</div>
<div style="text-align:center; font-size:11px; color:#666;">Student Performance Analysis</div>`;

const DEFAULT_FOOTER_HTML = `<div style="text-align:center; font-size:10px; color:#999;">This report is auto-generated. For queries, contact your institute administrator.</div>`;

const AssessmentSettings = () => {
    const [settings, setSettings] = useState<AssessmentSettingsData>(DEFAULT_ASSESSMENT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const instituteDetails = useInstituteDetailsStore((s) => s.instituteDetails);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await getAssessmentSettings(true);
                // Pre-fill with institute defaults if branding hasn't been configured yet
                const branding = data.reportBranding;
                const isUnconfigured =
                    branding.primary_color === DEFAULT_REPORT_BRANDING.primary_color &&
                    !branding.watermark_text &&
                    !branding.header_html &&
                    !branding.footer_html &&
                    !branding.logo_file_id;

                if (isUnconfigured && instituteDetails) {
                    const prefilled: ReportBrandingSettings = {
                        ...branding,
                        primary_color:
                            (instituteDetails as any).institute_theme_code ||
                            localStorage.getItem('theme-code') ||
                            branding.primary_color,
                        logo_file_id:
                            (instituteDetails as any).institute_logo_file_id || null,
                        watermark_text:
                            (instituteDetails as any).institute_name || '',
                        header_html: DEFAULT_HEADER_HTML,
                        footer_html: DEFAULT_FOOTER_HTML,
                    };
                    setSettings({ ...data, reportBranding: prefilled });
                } else {
                    setSettings(data);
                }
            } catch {
                toast.error('Failed to load assessment settings');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [instituteDetails]);

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
                                Shows the &quot;Offline Entry&quot; button on the assessment
                                submissions page
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

            {/* Report Branding Section */}
            <div>
                <h3 className="mb-3 text-base font-semibold">Assessment Report Branding</h3>
                <p className="mb-4 text-sm text-gray-500">
                    Customize the look and feel of PDF reports generated for students. These
                    settings apply to all assessment reports across your institute.
                </p>
                <ReportBrandingSettingsSection
                    settings={settings.reportBranding}
                    onChange={(branding) => {
                        setSettings((prev) => ({ ...prev, reportBranding: branding }));
                        setHasChanges(true);
                    }}
                />
            </div>
        </div>
    );
};

export default AssessmentSettings;
