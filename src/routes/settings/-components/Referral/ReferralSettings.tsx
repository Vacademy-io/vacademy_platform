import { useState, useEffect } from 'react';
import { ReferralManager } from './ReferralManager';
import {
    UnifiedReferralSettings,
    UnifiedReferralSettings as UnifiedReferralSettingsType,
} from './UnifiedReferralSettings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import {
    addReferralOption,
    getReferralOptions,
    deleteReferralOption,
    updateReferralOption,
    convertFromApiFormat,
} from '@/services/referral';

const ReferralSettings = () => {
    const [showUnifiedReferralSettings, setShowUnifiedReferralSettings] = useState(false);
    const [editingUnifiedReferralSettings, setEditingUnifiedReferralSettings] =
        useState<UnifiedReferralSettingsType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [referralPrograms, setReferralPrograms] = useState<UnifiedReferralSettingsType[]>([]);
    const [loading, setLoading] = useState(true);

    // Load referral programs on component mount
    useEffect(() => {
        loadReferralPrograms();
    }, []);

    const loadReferralPrograms = async () => {
        try {
            setLoading(true);
            const apiResponse = await getReferralOptions();
            const programs = apiResponse.map(convertFromApiFormat);
            setReferralPrograms(programs);
        } catch (error) {
            handleError(error, 'load referral programs');
        } finally {
            setLoading(false);
        }
    };

    // Error handling for component operations
    const handleError = (error: unknown, operation: string) => {
        console.error(`Error in ${operation}:`, error);
        setError(`Failed to ${operation}. Please try again.`);
        setTimeout(() => setError(null), 5000);
    };

    const handleCreateProgram = () => {
        setEditingUnifiedReferralSettings(null);
        setShowUnifiedReferralSettings(true);
    };

    const handleEditProgram = (program: UnifiedReferralSettingsType) => {
        setEditingUnifiedReferralSettings(program);
        setShowUnifiedReferralSettings(true);
    };

    const handleSaveProgram = async (settings: UnifiedReferralSettingsType) => {
        try {
            if (editingUnifiedReferralSettings) {
                // Update existing program
                await updateReferralOption(editingUnifiedReferralSettings.id, settings);
                setSuccess('Referral program updated successfully!');
            } else {
                // Add new program
                await addReferralOption(settings);
                setSuccess('Referral program created successfully!');
            }
            // Reload programs to get updated data
            await loadReferralPrograms();
            setEditingUnifiedReferralSettings(null);
            setShowUnifiedReferralSettings(false);
            setTimeout(() => setSuccess(null), 5000);
        } catch (error) {
            handleError(error, 'save referral program');
        }
    };

    const handleDeleteProgram = async (programId: string) => {
        try {
            await deleteReferralOption(programId);
            // Reload programs to get updated data
            await loadReferralPrograms();
        } catch (error) {
            handleError(error, 'delete referral program');
        }
    };

    const handleDuplicateProgram = async (program: UnifiedReferralSettingsType) => {
        try {
            const duplicatedProgram: UnifiedReferralSettingsType = {
                ...program,
                id: Date.now().toString(),
                label: `${program.label} (Copy)`,
                isDefault: false,
            };
            await addReferralOption(duplicatedProgram);
            // Reload programs to get updated data
            await loadReferralPrograms();
        } catch (error) {
            handleError(error, 'duplicate referral program');
        }
    };

    return (
        <div>
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

            {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="size-10 animate-spin text-primary-500" />

                    <p className="text-gray-600">Loading referral programs...</p>
                </div>
            ) : (
                <ReferralManager
                    programs={referralPrograms}
                    onCreateProgram={handleCreateProgram}
                    onEditProgram={handleEditProgram}
                    onDeleteProgram={handleDeleteProgram}
                    onDuplicateProgram={handleDuplicateProgram}
                />
            )}

            <UnifiedReferralSettings
                isOpen={showUnifiedReferralSettings}
                onClose={() => {
                    setShowUnifiedReferralSettings(false);
                    setEditingUnifiedReferralSettings(null);
                }}
                onSave={handleSaveProgram}
                editingSettings={editingUnifiedReferralSettings}
            />
        </div>
    );
};

export default ReferralSettings;
