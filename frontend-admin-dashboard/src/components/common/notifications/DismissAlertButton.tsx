import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { X, CircleNotch } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { dismissSystemAlert } from '@/services/notifications/system-alerts';

interface DismissAlertButtonProps {
    userId: string;
    messageId: string;
    className?: string;
    /** Called after a successful dismiss (e.g. optimistic parent cleanup). */
    onDismissed?: () => void;
}

/**
 * Per-alert "dismiss" (X) button. Records a DISMISSED interaction for a single
 * system alert (permanently hides it) and refreshes the alert queries so every
 * surface drops the card. Reused on the navbar bell + dialogs.
 */
export function DismissAlertButton({
    userId,
    messageId,
    className,
    onDismissed,
}: DismissAlertButtonProps) {
    const queryClient = useQueryClient();
    const [isDismissing, setIsDismissing] = useState(false);

    const handleDismiss = async (event: React.MouseEvent<HTMLButtonElement>) => {
        // Don't let the click bubble to the card / close the dropdown.
        event.preventDefault();
        event.stopPropagation();
        if (!userId || !messageId || isDismissing) return;
        setIsDismissing(true);
        try {
            await dismissSystemAlert(messageId, userId);
            await queryClient.invalidateQueries({ queryKey: ['SYSTEM_ALERTS'] });
            await queryClient.invalidateQueries({ queryKey: ['SYSTEM_ALERTS_INFINITE'] });
            onDismissed?.();
            // No need to reset state — the refetch drops this card from the list.
        } catch {
            toast.error('Failed to dismiss alert. Please try again.');
            setIsDismissing(false);
        }
    };

    return (
        <button
            type="button"
            aria-label="Dismiss alert"
            title="Dismiss"
            onClick={handleDismiss}
            disabled={isDismissing}
            className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50',
                className
            )}
        >
            {isDismissing ? (
                <CircleNotch className="size-3.5 animate-spin" />
            ) : (
                <X className="size-3.5" />
            )}
        </button>
    );
}
