import { useState } from 'react';
import { ScriptReview } from '../../ScriptReview';
import type { DecisionAnswer, DecisionRequest } from '../../../-services/video-generation';

interface NarrationDecisionProps {
    decision: DecisionRequest;
    prompt: string;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}

/**
 * Narration gate — reuses the existing <ScriptReview> editor (the original
 * review-mode UI), relabelled for the assist conversation. "Approve & continue"
 * submits the edited script; "Let AI decide" defers to the AI's draft.
 */
export function NarrationDecision({ decision, prompt, isSubmitting, onSubmit }: NarrationDecisionProps) {
    const initial =
        decision.payload?.full_script ??
        (decision.payload?.shots ?? [])
            .map((s) => (s.narration_text ?? '').trim())
            .filter(Boolean)
            .join(' ');
    const [script, setScript] = useState(initial);

    return (
        <ScriptReview
            script={script}
            prompt={prompt}
            onScriptChange={setScript}
            onResume={() =>
                onSubmit({ kind: 'edit', gate_type: 'narration', modified_script: script })
            }
            onDiscard={() => onSubmit({ kind: 'auto' })}
            isResuming={isSubmitting}
            title="Review narration"
            subtitle="Edit the script, then continue — or let the AI keep its draft."
            ctaLabel="Approve & continue"
            discardLabel="Let AI decide"
        />
    );
}
