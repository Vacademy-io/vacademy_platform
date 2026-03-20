import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { handleConfigureCertificateSettings } from '../../-services/setting-services';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

const CertificatesSettings = () => {
    const { instituteDetails } = useInstituteDetailsStore();
    const settings = JSON.parse(instituteDetails?.setting || '{}');
    const certificateSetting = settings?.setting?.CERTIFICATE_SETTING;
    const isDefaultCertificateSettingOn =
        certificateSetting?.data?.data?.[0]?.isDefaultCertificateSettingOn || false;
    const placeHoldersMapping = certificateSetting?.data?.data?.[0]?.placeHoldersMapping || {};

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isCertificateEnabled, setIsCertificateEnabled] = useState(isDefaultCertificateSettingOn);

    const handleSaveSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            await handleConfigureCertificateSettings(
                isCertificateEnabled,
                !!certificateSetting,
                placeHoldersMapping
            );
            setSuccess('Certificate settings saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (error) {
            console.error('Error saving certificate settings:', error);
            setError('Failed to save certificate settings. Please try again.');
            setTimeout(() => setError(null), 5000);
        } finally {
            setLoading(false);
        }
    };

    const handleSwitchToggle = (checked: boolean) => {
        setIsCertificateEnabled(checked);
    };

    return (
        <div className="space-y-6">
            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Success Alert */}
            {success && (
                <Alert variant="default" className="border-green-200 bg-green-50 text-green-800">
                    <CheckCircle className="size-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="flex items-center gap-2 text-lg font-bold">
                        <FileText className="size-6" />
                        Certificate Settings
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Configure certificate generation, templates, and settings for your institute
                    </p>
                </div>
                <Button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="flex items-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <CheckCircle className="size-4" />
                    )}
                    Save Changes
                </Button>
            </div>

            {/* Main Content */}
            <div className="rounded-lg border bg-card p-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold">Certificate Configuration</h3>
                            <p className="text-sm text-muted-foreground">
                                Manage certificate templates, design, and generation settings
                            </p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="certificate-enabled"
                                checked={isCertificateEnabled}
                                onCheckedChange={handleSwitchToggle}
                            />
                        </div>
                    </div>

                    {/* Certificate Settings Overview */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-lg border p-4">
                            <h4 className="font-medium">Templates</h4>
                            <p className="text-sm text-muted-foreground">
                                Manage certificate design templates
                            </p>
                        </div>
                        <div className="rounded-lg border p-4">
                            <h4 className="font-medium">Generation Rules</h4>
                            <p className="text-sm text-muted-foreground">
                                Configure automatic certificate generation
                            </p>
                        </div>
                        <div className="rounded-lg border p-4">
                            <h4 className="font-medium">Validation</h4>
                            <p className="text-sm text-muted-foreground">
                                Set up certificate verification
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CertificatesSettings;
