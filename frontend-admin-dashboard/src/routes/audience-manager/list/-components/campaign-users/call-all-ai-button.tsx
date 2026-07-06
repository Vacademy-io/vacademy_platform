import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Robot } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { useAiCallButtonEnabled } from '@/components/shared/leads';
import { startAiCallCampaign } from '@/components/shared/leads/services/start-ai-campaign';

interface CallAllWithAiButtonProps {
    /** Audience/campaign id — the lead list to call. */
    audienceId: string;
    instituteId?: string;
    /** Total leads currently in the list (drives the disabled state before the dry run). */
    totalElements: number;
}

/**
 * Toolbar action on a campaign's lead list: place an AI call to every eligible lead
 * in the list. Opens a confirm dialog that first does a server dry run (counts the
 * eligible leads without dialing), then, on confirm, fires the bulk campaign — the
 * backend paces the calls and each outcome/assignment lands via the webhook.
 * Hidden unless AI calling's lead-list surface is enabled (same gate as the per-row
 * robot button), so it never shows for institutes not using AI calling.
 */
export function CallAllWithAiButton({
    audienceId,
    instituteId,
    totalElements,
}: CallAllWithAiButtonProps) {
    const enabled = useAiCallButtonEnabled();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);

    // Dry run: count eligible leads for the confirm copy, WITHOUT placing any calls.
    const preview = useQuery({
        queryKey: ['ai-campaign-preview', audienceId, instituteId],
        queryFn: () => startAiCallCampaign({ audienceId, instituteId: instituteId!, dryRun: true }),
        enabled: open && !!instituteId,
        staleTime: 0,
        gcTime: 0,
        retry: false,
    });

    const start = useMutation({
        mutationFn: () =>
            startAiCallCampaign({ audienceId, instituteId: instituteId!, dryRun: false }),
        onSuccess: (res) => {
            toast.success(res.message || `Queued ${res.eligible} AI call(s)`);
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ['campaignUsers', audienceId] });
        },
        onError: (err) => toast.error(errMsg(err)),
    });

    if (!enabled) return null;

    const eligible = preview.data?.eligible ?? 0;
    const totalInList = preview.data?.total ?? totalElements;
    const previewError = preview.isError ? errMsg(preview.error) : null;

    const footer = (
        <div className="flex w-full items-center justify-end gap-2">
            <MyButton buttonType="secondary" scale="small" onClick={() => setOpen(false)}>
                Cancel
            </MyButton>
            <MyButton
                buttonType="primary"
                scale="small"
                disable={preview.isLoading || !!previewError || eligible === 0 || start.isPending}
                onClick={() => start.mutate()}
            >
                {start.isPending
                    ? 'Starting…'
                    : eligible > 0
                      ? `Call ${eligible} lead${eligible === 1 ? '' : 's'}`
                      : 'Call leads'}
            </MyButton>
        </div>
    );

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="h-10"
                disabled={!totalElements || !instituteId}
                onClick={() => setOpen(true)}
            >
                <Robot className="mr-1.5 size-4" />
                Call all with AI
            </Button>

            <MyDialog
                heading="Call all leads with AI"
                open={open}
                onOpenChange={setOpen}
                dialogWidth="w-full max-w-md"
                footer={footer}
            >
                <div className="space-y-3 text-body">
                    {preview.isLoading && (
                        <p className="text-neutral-500">Checking how many leads can be called…</p>
                    )}
                    {previewError && <p className="text-danger-600">{previewError}</p>}
                    {!preview.isLoading && !previewError && (
                        <>
                            <p>
                                <span className="font-semibold">{eligible}</span> of {totalInList} lead
                                {totalInList === 1 ? '' : 's'} in this list can be called (they have a
                                saved contact number).
                            </p>
                            <p className="text-caption text-neutral-500">
                                The AI agent calls each one, paced in the background, and consumes
                                calling credits. Each lead&apos;s outcome and counsellor assignment
                                happen automatically after the call. This can&apos;t be undone once
                                started.
                            </p>
                            {eligible === 0 && (
                                <p className="text-warning-600">
                                    No leads in this list have a contact number to call.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </MyDialog>
        </>
    );
}

function errMsg(err: unknown): string {
    if (err && typeof err === 'object') {
        const e = err as {
            response?: { data?: { ex?: string; message?: string } };
            message?: string;
        };
        if (typeof e.response?.data?.ex === 'string') return e.response.data.ex;
        if (typeof e.response?.data?.message === 'string') return e.response.data.message;
        if (typeof e.message === 'string') return e.message;
    }
    return 'Could not start the AI call campaign';
}
