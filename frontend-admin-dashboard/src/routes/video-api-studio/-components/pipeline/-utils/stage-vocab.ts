/**
 * Movie-production terminology + sub-stage → node mapping. Single source of
 * truth so node copy stays consistent and BE sub_stage strings translate
 * deterministically into derived `PipelineState`.
 *
 * Backend sub_stage strings (sourced from automation_pipeline.py +
 * music_generator.py — see docs/ai_content/AI_VIDEO_GENERATION.md). The FE
 * never invents these; it just maps them onto the production vocabulary.
 */

export type PipelineNodeId =
    | 'pitch'
    | 'research'
    | 'beats'
    | 'screenplay'
    | 'narration'
    | 'storyboard'
    | 'filming'
    | 'talent'
    | 'score'
    | 'finalCut';

/**
 * Movie-language label for each node. Used in node header copy + the
 * right-panel stages list. Keep concise.
 */
export const NODE_LABELS: Record<PipelineNodeId, string> = {
    pitch: 'Pitch',
    research: 'Research',
    beats: 'Beats',
    screenplay: 'Screenplay',
    narration: 'Narration',
    storyboard: 'Storyboard',
    filming: 'Filming',
    talent: 'Talent',
    score: 'Score',
    finalCut: 'Final Cut',
};

/**
 * Live sub-status copy when a node is actively in production. Picked by
 * matching the BE sub_stage string OR the broad pipeline stage when no
 * sub_stage is present yet.
 */
export const ACTIVE_SUB_STATUS: Record<PipelineNodeId, string> = {
    pitch: 'Brief in hand',
    research: 'Investigating sources…',
    beats: 'Outlining story beats…',
    screenplay: 'Writer at work…',
    narration: 'Recording the voiceover…',
    storyboard: 'Director planning shots…',
    filming: 'On set, rolling cameras…',
    talent: 'Recording lead performance…',
    score: 'Composing the score…',
    finalCut: 'Assembling the cut…',
};

/**
 * BE sub_stage → node ownership. A sub_stage moves the matching node to
 * `in_production` (if it was scheduled) or keeps it active. The `*_done`
 * sub_stages are handled separately as "wrapped" signals.
 *
 * Source: automation_pipeline.py + music_generator.py (see plan doc for line
 * refs).
 */
export const SUB_STAGE_BY_NODE: Record<string, PipelineNodeId> = {
    beats_planning: 'beats',
    beats_done: 'beats',
    script_writing: 'screenplay',
    script_done: 'screenplay',
    tts_generating: 'narration',
    tts_done: 'narration',
    director_planning: 'storyboard',
    director_done: 'storyboard',
    html_generating: 'filming',
    html_done: 'filming',
    avatar_batch_start: 'talent',
    avatar_image_audio_ready: 'talent',
    avatar_render_done: 'talent',
    avatar_failed: 'talent',
    avatar_batch_done: 'talent',
    background_music_start: 'score',
    background_music_segment: 'score',
    background_music_concat: 'score',
    background_music_done: 'score',
};

/** True when the sub_stage represents that node's wrapped/finished signal. */
export function isWrappingSubStage(subStage: string | null | undefined): boolean {
    if (!subStage) return false;
    return subStage.endsWith('_done') || subStage === 'avatar_batch_done';
}

/**
 * Stage ordering used by the linear-node state derivation: a node is
 * `wrapped` when the pipeline has advanced past its stage, `in_production`
 * when the stage matches, and `scheduled` otherwise.
 */
export const STAGE_ORDER = ['PENDING', 'SCRIPT', 'TTS', 'WORDS', 'HTML', 'DONE'] as const;
export type PipelineStage = (typeof STAGE_ORDER)[number];

/**
 * Which broad stage owns a given linear node. Storyboard and Filming both
 * live inside the HTML stage but are split apart by sub_stage signals.
 *
 * `beats` lives inside the SCRIPT stage (BeatPlanner runs before _draft_script
 * inside the script-writing block). It rides the same stage marker as
 * screenplay but uses `beats_planning` / `beats_done` sub-stages to flip
 * earlier than screenplay's `script_writing`.
 */
export const NODE_STAGE: Record<
    Exclude<PipelineNodeId, 'research' | 'talent' | 'score' | 'finalCut'>,
    PipelineStage
> = {
    pitch: 'PENDING',
    beats: 'SCRIPT',
    screenplay: 'SCRIPT',
    narration: 'TTS', // WORDS is folded into Narration
    storyboard: 'HTML',
    filming: 'HTML',
};
