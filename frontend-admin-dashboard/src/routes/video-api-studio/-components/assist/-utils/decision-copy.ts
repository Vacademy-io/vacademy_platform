import type { GateType, DecisionAnswer, DecisionRequest } from '../../../-services/video-generation';

/**
 * Per-gate display copy for the assist conversation — parallels the pipeline's
 * `stage-vocab.ts`. Keeps titles/blurbs consistent across the chat header, the
 * decision cards, and the resolved-turn transcript.
 */
export interface GateMeta {
    title: string;
    blurb: string;
}

export const GATE_META: Record<GateType, GateMeta> = {
    creative_concept: {
        title: 'Creative direction',
        blurb: 'The thesis, tone, and visual metaphor for the whole video.',
    },
    shot_plan: {
        title: 'Shot plan',
        blurb: 'The list of shots — types, order, pacing, and what each beat covers.',
    },
    narration: {
        title: 'Narration script',
        blurb: 'The exact words spoken before audio is generated.',
    },
    visual_casting: {
        title: 'Visual',
        blurb: 'Which stock image or clip to use for this shot.',
    },
    shot_look: {
        title: 'Shot look',
        blurb: 'Which rendered look to use for this shot.',
    },
    voice: { title: 'Voice', blurb: 'The narration voice.' },
    music: { title: 'Background music', blurb: 'The background music track.' },
    avatar: { title: 'Host', blurb: 'The on-screen host / avatar.' },
};

export function gateTitle(gate: GateType): string {
    return GATE_META[gate]?.title ?? gate;
}

/** Short human summary of what the user answered, for the transcript. */
export function buildTurnSummary(decision: DecisionRequest, answer: DecisionAnswer): string {
    const label = gateTitle(decision.gate_type);
    switch (answer.kind) {
        case 'accept_recommended':
            return `Approved the ${label.toLowerCase()} as drafted`;
        case 'choose_option':
            return `Chose an option for ${label.toLowerCase()}`;
        case 'freeform':
            return `Asked: “${answer.text.slice(0, 80)}”`;
        case 'auto':
            return `Let AI decide the ${label.toLowerCase()}`;
        case 'auto_all':
            return `Let AI handle all remaining ${label.toLowerCase()} choices`;
        case 'edit':
            if (answer.gate_type === 'shot_plan') return `Edited the shot plan (${answer.shots.length} shots)`;
            if (answer.gate_type === 'narration') return 'Edited the narration script';
            return `Picked visuals for ${answer.selections.length} shot(s)`;
        default:
            return `Resolved ${label.toLowerCase()}`;
    }
}
