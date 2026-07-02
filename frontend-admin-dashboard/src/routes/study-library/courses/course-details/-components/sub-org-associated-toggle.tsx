import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Buildings, Info } from '@phosphor-icons/react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface SubOrgAssociatedToggleProps {
    /** The selected package session (batch) id this toggle applies to. */
    packageSessionId: string;
    /** Current is_org_associated value from the batch data. */
    initialValue: boolean;
    /** Disable editing (e.g. non-admin / published course). */
    disabled?: boolean;
}

/**
 * Course Details setting: when enabled, enrolling a learner into this batch
 * provisions a sub-org for them. Backed by package_session.is_org_associated
 * (PUT /admin-core-service/batch/v1/sub-org-associated).
 */
export function SubOrgAssociatedToggle({
    packageSessionId,
    initialValue,
    disabled = false,
}: SubOrgAssociatedToggleProps) {
    const queryClient = useQueryClient();
    const [enabled, setEnabled] = useState<boolean>(initialValue);

    // Keep local state in sync when the selected batch changes.
    useEffect(() => {
        setEnabled(initialValue);
    }, [initialValue, packageSessionId]);

    const mutation = useMutation({
        mutationFn: async (next: boolean) => {
            await authenticatedAxiosInstance.put(
                `${BASE_URL}/admin-core-service/batch/v1/sub-org-associated`,
                [packageSessionId],
                { params: { isOrgAssociated: next } }
            );
            return next;
        },
        onSuccess: (next) => {
            setEnabled(next);
            queryClient.invalidateQueries({ queryKey: ['COURSE_BATCHES'] });
            toast.success(
                next ? 'Sub-org association enabled' : 'Sub-org association disabled'
            );
        },
        onError: () => {
            toast.error('Failed to update sub-org association');
        },
    });

    return (
        <div className="rounded-md border bg-white p-3 shadow-sm lg:p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Buildings className="size-4 shrink-0 text-neutral-500" />
                    <span className="text-sm font-medium text-neutral-800">
                        Sub-org associated
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" aria-label="What is this?">
                                    <Info className="size-4 text-neutral-400" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64">
                                When enabled, enrolling a learner into this batch creates a
                                sub-organization for them.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Switch
                    checked={enabled}
                    disabled={disabled || mutation.isPending}
                    onCheckedChange={(next) => mutation.mutate(next)}
                />
            </div>
        </div>
    );
}
