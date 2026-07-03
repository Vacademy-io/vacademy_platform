import type {
    GateType,
    DecisionAnswer,
    DecisionRequest,
    AssistTurn,
    VideoStatusResponse,
} from '../../../-services/video-generation';

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
    contact_sheet: {
        title: 'Contact sheet',
        blurb: 'Every shot as a real frame — approve or send shots back with notes.',
    },
    asset_request: {
        title: 'Make it real',
        blurb: 'The AI asked for real assets — your screenshots, photos, and numbers.',
    },
    voice: { title: 'Voice', blurb: 'The narration voice.' },
    music: { title: 'Background music', blurb: 'The background music track.' },
    avatar: { title: 'Host', blurb: 'The on-screen host / avatar.' },
};

export function gateTitle(gate: GateType): string {
    return GATE_META[gate]?.title ?? gate;
}

/** Canonical agent question per gate — used when reconstructing past turns. */
const GATE_PROMPT: Record<GateType, string> = {
    creative_concept: "Here's the creative direction — approve or refine it.",
    shot_plan: "Here's the shot plan — approve it, edit any shot, or let me decide.",
    narration: "Here's the narration script — edit it, approve it, or let me decide.",
    visual_casting: 'Which visual should we use for this shot?',
    shot_look: 'Which look should we use for this shot?',
    contact_sheet: 'All shots are built — approve the contact sheet or send shots back.',
    asset_request: 'I could make a few shots more real with things only you have.',
    voice: 'Which voice should we use?',
    music: 'Which background music fits?',
    avatar: 'Which host should present?',
};

/** Summary of a recorded answer (from the backend ledger), for the transcript. */
function summarizeLedger(gate: GateType, mode: string, answer: Record<string, unknown> | undefined): string {
    const label = gateTitle(gate).toLowerCase();
    switch (mode) {
        case 'auto':
            return `Let AI decide the ${label}`;
        case 'auto_all':
            return `Let AI handle all remaining ${label} choices`;
        case 'select':
            return `Approved the ${label}`;
        case 'freeform':
            return `Asked: “${String((answer as { text?: string })?.text ?? '').slice(0, 80)}”`;
        case 'edit':
            if (gate === 'shot_plan') return 'Edited the shot plan';
            if (gate === 'narration') return 'Edited the narration script';
            if (gate === 'contact_sheet') {
                const n = ((answer as { regens?: unknown[] })?.regens ?? []).length;
                return `Sent ${n} shot(s) back with notes`;
            }
            if (gate === 'asset_request') {
                const rs = (answer as { responses?: Array<{ skipped?: boolean }> })?.responses ?? [];
                const n = rs.filter((r) => !r?.skipped).length;
                return n > 0 ? `Provided ${n} real asset(s)` : 'Skipped — AI creates everything';
            }
            return 'Picked the visuals';
        default:
            return `Resolved the ${label}`;
    }
}

/**
 * Rebuild the conversation transcript from the backend's answered-decisions
 * ledger. Used when a finished video loads fresh (Recent / deep-link / reload)
 * and the in-memory transcript is gone.
 */
export function reconstructAssistTranscript(
    status: VideoStatusResponse | null | undefined
): AssistTurn[] {
    const assist = (status?.metadata as { assist?: { answered_decisions?: unknown[] } } | null)
        ?.assist;
    const answered = (assist?.answered_decisions ?? []) as Array<{
        decision_id?: string;
        _key?: string;
        gate_type?: GateType;
        mode?: string;
        answer?: Record<string, unknown>;
        answered_at?: string;
    }>;
    return answered
        .filter((r) => r && r.gate_type)
        .map((r) => ({
            decision_id: r.decision_id ?? `${r.gate_type}:${r._key ?? ''}`,
            gate_type: r.gate_type as GateType,
            prompt: GATE_PROMPT[r.gate_type as GateType] ?? gateTitle(r.gate_type as GateType),
            answer_summary: summarizeLedger(r.gate_type as GateType, r.mode ?? 'select', r.answer),
            answered_at: r.answered_at ? Date.parse(r.answered_at) || 0 : 0,
        }));
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
            if (answer.gate_type === 'creative_concept') return 'Edited the creative direction';
            if (answer.gate_type === 'contact_sheet')
                return `Sent ${answer.regens.length} shot(s) back with notes`;
            if (answer.gate_type === 'asset_request') {
                const n = answer.responses.filter((r) => !r.skipped).length;
                return n > 0 ? `Provided ${n} real asset(s)` : 'Skipped the asset requests';
            }
            return `Picked visuals for ${answer.selections.length} shot(s)`;
        default:
            return `Resolved ${label.toLowerCase()}`;
    }
}
