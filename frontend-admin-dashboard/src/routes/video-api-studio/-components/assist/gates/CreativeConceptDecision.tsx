import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Sparkle, Lightbulb } from '@phosphor-icons/react';
import type { DecisionAnswer, DecisionRequest } from '../../../-services/video-generation';

interface CreativeConceptDecisionProps {
    decision: DecisionRequest;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}

// Order + labels for the concept fields the planner emits.
const FIELDS: Array<{ key: string; label: string; hint: string }> = [
    { key: 'controlling_idea', label: 'Controlling idea', hint: 'the one argument the video makes' },
    { key: 'tonal_register', label: 'Tone', hint: 'e.g. confident, playful, documentary' },
    { key: 'emotional_arc', label: 'Emotional arc', hint: 'from → to' },
    { key: 'visual_metaphor', label: 'Visual metaphor', hint: 'the animatable idea' },
    { key: 'signature_device', label: 'Signature device', hint: 'a recurring visual gesture' },
];

/**
 * Creative-direction gate. Shows the AI's creative DNA for the video; the user
 * can approve, edit, or steer. NOTE: the shot structure + narration are already
 * authored against this concept, so edits mainly steer the VISUAL direction
 * (metaphor / signature device) that the per-shot HTML stage still reads.
 */
export function CreativeConceptDecision({ decision, isSubmitting, onSubmit }: CreativeConceptDecisionProps) {
    const initial = useMemo<Record<string, string>>(() => {
        const c = (decision.payload?.concept as Record<string, unknown>) ?? {};
        const out: Record<string, string> = {};
        for (const f of FIELDS) out[f.key] = c[f.key] != null ? String(c[f.key]) : '';
        return out;
    }, [decision.payload]);

    const [vals, setVals] = useState<Record<string, string>>(initial);
    const [dirty, setDirty] = useState(false);

    const set = (k: string, v: string) => {
        setVals((prev) => ({ ...prev, [k]: v }));
        setDirty(true);
    };

    const approve = () => {
        if (!dirty) {
            onSubmit({ kind: 'accept_recommended' });
            return;
        }
        onSubmit({ kind: 'edit', gate_type: 'creative_concept', concept: vals });
    };

    return (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-foreground">
                <span className="flex size-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                    <Lightbulb className="size-4 text-violet-600" />
                </span>
                Creative direction
            </div>

            <div className="space-y-3 p-4">
                {FIELDS.map((f) => (
                    <label key={f.key} className="block">
                        <span className="mb-1 block text-xs font-medium text-muted-foreground">
                            {f.label} <span className="font-normal opacity-60">· {f.hint}</span>
                        </span>
                        <Input
                            value={vals[f.key] ?? ''}
                            disabled={isSubmitting}
                            onChange={(e) => set(f.key, e.target.value)}
                            className="h-8 text-sm"
                            placeholder={f.hint}
                        />
                    </label>
                ))}
            </div>

            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => onSubmit({ kind: 'auto' })}
                    className="gap-1.5 text-muted-foreground"
                >
                    <Sparkle className="size-3.5" />
                    Let AI decide
                </Button>
                <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={approve}
                    className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                >
                    <Check className="size-4" />
                    {dirty ? 'Save & continue' : 'Approve direction'}
                </Button>
            </div>
        </div>
    );
}
