import { useState } from 'react';
import { CourseSettingsForm } from './CourseSettingsForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, Settings } from 'lucide-react';
import { saveCourseSettings } from '@/services/course-settings';
import { CourseSettingsData } from '@/types/course-settings';
import { useCourseSettings } from '@/hooks/useCourseSettings';

const CourseSettings = () => {
    const { settings, loading, error: contextError, refreshSettings } = useCourseSettings();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Error handling for component operations
    const handleError = (error: unknown, operation: string) => {
        console.error(`Error in ${operation}:`, error);
        setError(`Failed to ${operation}. Please try again.`);
        setTimeout(() => setError(null), 5000);
    };

    const handleSaveSettings = async (updatedSettings: CourseSettingsData) => {
        try {
            setSaving(true);
            setError(null);
            await saveCourseSettings(updatedSettings);
            // Refresh the context to update all components using course settings
            await refreshSettings();
            setSuccess('Course settings saved successfully!');
            setTimeout(() => setSuccess(null), 5000);
        } catch (error) {
            handleError(error, 'save course settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Error Alert */}
            {(error || contextError) && (
                <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{error || contextError}</AlertDescription>
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
                        <Settings className="size-6" />
                        Course Settings
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Configure how courses are created and managed in your institute
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="size-10 animate-spin text-primary-500" />
                    <p className="mt-4 text-gray-600">Loading course settings...</p>
                </div>
            ) : settings ? (
                <CourseSettingsForm
                    settings={settings}
                    onSave={handleSaveSettings}
                    isSaving={saving}
                />
            ) : (
                <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>
                        Failed to load course settings. Please refresh the page to try again.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

export default CourseSettings;
