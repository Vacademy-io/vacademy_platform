import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Broom } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { dismissAllSystemAlerts } from '@/services/notifications/system-alerts';

interface ClearAllAlertsButtonProps {
    userId: string;
    /** Hide the button entirely when there are no alerts to clear. */
    hasAlerts?: boolean;
    disabled?: boolean;
    scale?: 'small' | 'medium';
    className?: string;
    /** Called after a successful clear (e.g. to close the parent dialog). */
    onCleared?: () => void;
}

/**
 * "Clear all" action for a user's system alerts. Confirms, then dismisses every
 * alert (via a DISMISSED interaction per message) and refreshes the alert
 * queries so all surfaces update. Reused across the navbar bell + dialogs.
 */
export function ClearAllAlertsButton({
    userId,
    hasAlerts = true,
    disabled = false,
    scale = 'small',
    className,
    onCleared,
}: ClearAllAlertsButtonProps) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    if (!hasAlerts) return null;

    const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
        // Keep the dialog open while the async work runs.
        event.preventDefault();
        if (!userId) {
            toast.error('Could not identify the current user.');
            return;
        }
        setIsClearing(true);
        try {
            const count = await dismissAllSystemAlerts(userId);
            await queryClient.invalidateQueries({ queryKey: ['SYSTEM_ALERTS'] });
            await queryClient.invalidateQueries({ queryKey: ['SYSTEM_ALERTS_INFINITE'] });
            toast.success(count > 0 ? 'All system alerts cleared' : 'No alerts to clear');
            setOpen(false);
            onCleared?.();
        } catch {
            toast.error('Failed to clear system alerts. Please try again.');
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(next) => !isClearing && setOpen(next)}>
            <AlertDialogTrigger asChild>
                <MyButton
                    type="button"
                    buttonType="text"
                    scale={scale}
                    disable={disabled}
                    className={cn('!text-danger-600 hover:!text-danger-500', className)}
                >
                    <Broom className="mr-1 size-4" />
                    Clear all
                </MyButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Clear all system alerts?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This dismisses every system alert for your account. This action cannot be
                        undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isClearing}
                        className="bg-danger-600 hover:bg-danger-500 focus:ring-danger-600"
                    >
                        {isClearing ? 'Clearing…' : 'Clear all'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
