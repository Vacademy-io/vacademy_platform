import { useState } from 'react';
import { Robot } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { AiCallChooserFields } from './ai-call-chooser';

export interface AiCallDialogTarget {
    responseId: string;
    userId?: string;
    leadName?: string;
}

interface AiCallDialogProps {
    /** The lead to call; null = dialog closed. */
    target: AiCallDialogTarget | null;
    onClose: () => void;
    /** Fires with the chosen agent/number ('' = institute default / auto). */
    onConfirm: (target: AiCallDialogTarget, agentId: string, numberId: string) => void;
    isPending?: boolean;
}

/**
 * Confirm step for a per-row AI call: pick WHICH agent speaks (and the caller-ID
 * number when there's a choice) before dialing, instead of silently using the
 * institute default. Blank picks preserve the default behaviour.
 */
export function AiCallDialog({ target, onClose, onConfirm, isPending }: AiCallDialogProps) {
    const [agentId, setAgentId] = useState('');
    const [numberId, setNumberId] = useState('');

    const footer = (
        <div className="flex w-full items-center justify-end gap-2">
            <MyButton buttonType="secondary" scale="small" onClick={onClose}>
                Cancel
            </MyButton>
            <MyButton
                buttonType="primary"
                scale="small"
                disable={!!isPending}
                onClick={() => target && onConfirm(target, agentId, numberId)}
            >
                {isPending ? 'Calling…' : 'Start AI call'}
            </MyButton>
        </div>
    );

    return (
        <MyDialog
            heading={`AI call${target?.leadName ? ` — ${target.leadName}` : ''}`}
            open={!!target}
            onOpenChange={(open) => !open && onClose()}
            dialogWidth="w-full max-w-md"
            footer={footer}
        >
            <div className="space-y-3 text-body">
                <p className="flex items-center gap-1.5 text-neutral-600">
                    <Robot className="size-4 shrink-0 text-primary-500" />
                    The agent calls this lead now; the outcome and counsellor assignment
                    land automatically after the call.
                </p>
                <AiCallChooserFields
                    userId={target?.userId}
                    agentId={agentId}
                    onAgentChange={setAgentId}
                    numberId={numberId}
                    onNumberChange={setNumberId}
                />
            </div>
        </MyDialog>
    );
}
