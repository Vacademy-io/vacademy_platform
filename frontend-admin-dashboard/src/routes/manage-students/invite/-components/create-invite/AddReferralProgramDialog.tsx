import {
    UnifiedReferralSettings,
    UnifiedReferralSettings as UnifiedReferralSettingsType,
} from '@/routes/settings/-components/Referral/UnifiedReferralSettings';
import { InviteLinkFormValues } from './GenerateInviteLinkSchema';
import { UseFormReturn } from 'react-hook-form';
import { addReferralOption, convertToApiFormat } from '@/services/referral';
import { useEffect, useState } from 'react';
import { updateReferralOption } from '@/services/referral';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { CheckCircle } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
interface AddReferralProgramDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

export function AddReferralProgramDialog({ form }: AddReferralProgramDialogProps) {
    const queryClient = useQueryClient();
    const [showUnifiedReferralSettings, setShowUnifiedReferralSettings] = useState(
        form.watch('showAddReferralDialog')
    );
    const [editingUnifiedReferralSettings, setEditingUnifiedReferralSettings] =
        useState<UnifiedReferralSettingsType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Error handling for component operations
    const handleError = (error: unknown, operation: string) => {
        console.error(`Error in ${operation}:`, error);
        setError(`Failed to ${operation}. Please try again.`);
        setTimeout(() => setError(null), 5000);
    };

    const handleSaveProgram = async (settings: UnifiedReferralSettingsType) => {
        try {
            const apiData = convertToApiFormat(settings);
            const referralPrograms = form.getValues('referralPrograms');
            if (editingUnifiedReferralSettings) {
                // Update existing program
                await updateReferralOption(editingUnifiedReferralSettings.id, settings);
                setSuccess('Referral program updated successfully!');
                const updatedPrograms = referralPrograms.map((program) =>
                    program.id === editingUnifiedReferralSettings.id
                        ? { ...apiData, id: program.id }
                        : program
                );
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                form.setValue('referralPrograms', updatedPrograms);
            } else {
                // Add new program
                await addReferralOption(settings);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                form.setValue('referralPrograms', [...referralPrograms, apiData]);
                setSuccess('Referral program created successfully!');
            }
            queryClient.invalidateQueries({ queryKey: ['GET_REFERRAL_PROGRAM_DETAILS'] });
            form.setValue('showAddReferralDialog', false);
            setEditingUnifiedReferralSettings(null);
            setShowUnifiedReferralSettings(false);
            setTimeout(() => setSuccess(null), 5000);
        } catch (error) {
            handleError(error, 'save referral program');
        }
    };

    useEffect(() => {
        setShowUnifiedReferralSettings(form.watch('showAddReferralDialog'));
    }, [form.watch('showAddReferralDialog')]);

    return (
        <>
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
            <UnifiedReferralSettings
                isOpen={showUnifiedReferralSettings}
                onClose={() => {
                    setShowUnifiedReferralSettings(false);
                    setEditingUnifiedReferralSettings(null);
                }}
                onSave={handleSaveProgram}
                editingSettings={editingUnifiedReferralSettings}
            />
        </>
    );
}
