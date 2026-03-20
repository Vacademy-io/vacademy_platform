import { useState, useEffect } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { MyRadioButton } from '@/components/design-system/radio';
import { deleteLiveSession } from '../schedule/-services/utils';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface DeleteSessionDialogProps {
    open: boolean;
    onOpenChange: (val: boolean) => void;
    sessionId: string;
    scheduleId?: string;
    isRecurring?: boolean;
    onSuccess?: () => void;
}

export default function DeleteSessionDialog({
    open,
    onOpenChange,
    sessionId,
    scheduleId,
    isRecurring = false,
    onSuccess,
}: DeleteSessionDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedOption, setSelectedOption] = useState<'session' | 'schedule'>('schedule');
    const queryClient = useQueryClient();

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedOption('schedule');
            setIsDeleting(false);
        }
    }, [open]);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            let ids: string[];

            if (selectedOption === 'session') {
                // Delete the entire session (all schedules)
                ids = [sessionId];
            } else {
                // Delete only this specific schedule
                ids = [scheduleId || sessionId];
            }

            await deleteLiveSession(ids, selectedOption);

            // Invalidate relevant queries
            await queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
            await queryClient.invalidateQueries({ queryKey: ['upcomingSessions'] });
            await queryClient.invalidateQueries({ queryKey: ['pastSessions'] });
            await queryClient.invalidateQueries({ queryKey: ['draftSessions'] });
            await queryClient.invalidateQueries({ queryKey: ['sessionSearch'] });

            toast.success(
                selectedOption === 'session'
                    ? 'Session deleted successfully'
                    : 'Schedule deleted successfully'
            );

            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCancel = () => {
        if (!isDeleting) {
            onOpenChange(false);
        }
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading="Delete Session"
            className="w-fit max-w-md"
        >
            <div className="flex flex-col gap-4 p-4">
                {isRecurring ? (
                    <>
                        <div className="text-lg">
                            This is a recurring session. What would you like to delete?
                        </div>
                        <MyRadioButton
                            name="delete-option"
                            value={selectedOption}
                            onChange={(val) => setSelectedOption(val as 'session' | 'schedule')}
                            options={[
                                { label: 'Delete only this schedule', value: 'schedule' },
                                {
                                    label: 'Delete entire session (all schedules)',
                                    value: 'session',
                                },
                            ]}
                            className="flex flex-col gap-3"
                            disabled={isDeleting}
                        />
                        <div className="flex justify-end gap-4 border-t pt-4">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                onClick={handleCancel}
                                disabled={isDeleting}
                            >
                                Cancel
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="primary"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </MyButton>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-lg">Are you sure you want to delete this session?</div>
                        <div className="flex flex-row items-center justify-between gap-4">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                onClick={handleCancel}
                                disabled={isDeleting}
                            >
                                Cancel
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="primary"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </MyButton>
                        </div>
                    </>
                )}
            </div>
        </MyDialog>
    );
}
