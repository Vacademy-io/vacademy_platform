/**
 * Derive a single normalized PipelineState from either the live SSE-driven
 * `currentGeneration` shape OR the polled `/status` + `/urls` shape. The
 * downstream components (PipelineFlow, PipelinePanel) consume this without
 * caring which source it came from — so the same UI works during live
 * generation and after completion.
 */

import type {
    ContentType,
    GenerateVideoRequest,
    TokenUsage,
    VideoOrientation,
    VideoStage,
    VideoStatusMetadata,
    VideoStatusResponse,
    VideoStatusUserSelections,
} from '../../../-services/video-generation';
import {
    NODE_STAGE,
    STAGE_ORDER,
    SUB_STAGE_BY_NODE,
    type PipelineNodeId,
    type PipelineStage,
} from './stage-vocab';

// ── Slot shapes ──────────────────────────────────────────────────────────

export type NodeState = 'scheduled' | 'in_production' | 'wrapped' | 'reshoot' | 'cut';

export type NodeSlot<A> =
    | { state: 'scheduled' }
    | { state: 'in_production'; subStatus?: string; partialData?: Partial<A> }
    | { state: 'wrapped'; data: A }
    | { state: 'reshoot' | 'cut'; error: string };

export interface PitchArtifact {
    prompt: string;
    referenceCount: number;
}
/** Screenshot / scraped image captured by `scrape_url`. */
export interface ResearchScreenshot {
    url: string;
    name?: string;
}

/** Web-search source — host + url synthesized into the script context. */
export interface ResearchSource {
    url: string;
    host?: string;
    title?: string;
    thumbUrl?: string;
}

export interface ResearchArtifact {
    /** True when the router enabled `scrape_url`. */
    scrapedAny: boolean;
    /** True when the router enabled `web_search`. */
    searchedAny: boolean;
    /** URLs the scraper attempted to capture. */
    urlsAttempted?: string[];
    /** Captured screenshots / inline images surfaced to the user. */
    screenshots?: ResearchScreenshot[];
    /** First ~4kb of scraped page text (fed into the screenplay prompt). */
    scrapedExcerpt?: string;
    /** Web-search natural-language answer (capped at ~2kb on the BE). */
    searchAnswer?: string;
    /** Cited sources from `web_search` — host+url tuples. */
    sources?: ResearchSource[];
    /** User's search query, derived by the intent router. */
    searchQuery?: string;
}
export interface ScreenplayArtifact {
    scriptUrl?: string;
}
/**
 * BeatPlanner output — populated when the v2 pipeline runs the explicit
 * beat-planning stage before Script Generator. Each beat carries a duration
 * estimate (in seconds) and an intent role so the Director can plan shots
 * from the beat outline rather than from word timings alone.
 */
export interface BeatsArtifact {
    /** Number of beats the planner emitted. */
    count: number;
    /** Optional preview list; capped to 12 (the planner's max_beats). */
    beats?: Array<{
        label?: string;
        intentRole?: string;
        visualTypeHint?: string;
        durationEstimateS?: number;
        intendedNarration?: string;
    }>;
    /** WPM used for duration estimates (currently 150 wpm; calibrated per voice). */
    wpm?: number;
}
export interface NarrationArtifact {
    audioUrl?: string;
    wordsUrl?: string;
    wordCount?: number;
}
export interface StoryboardArtifact {
    scenes: Array<{
        index: number;
        shotType: string;
        startTime: number;
        endTime: number;
        durationS: number;
        narrationExcerpt?: string;
    }>;
}
export interface FilmingArtifact {
    shotsCompleted: number;
    shotsTotal: number;
}

/**
 * One scene node — derived from `shotPlan[i]` (live) or `gp.shot_plan[i]`
 * (polled). Thumbnails (`imageUrl` / `videoUrl`) are populated lazily by
 * parsing the final timeline.json once it's fetched; until then the scene
 * still renders with its narration excerpt + state ring.
 */
export interface SceneSlot {
    state: NodeState;
    index: number;
    shotType: string;
    narrationExcerpt?: string;
    durationS: number;
    startTime: number;
    endTime: number;
    imageUrl?: string;
    videoUrl?: string;
    error?: string;
}
/**
 * One avatar take rendered for a host shot. Sourced from
 * `extra_metadata.host.outputs.shot_artifacts[]` post-completion. Live runs
 * don't expose per-shot URLs through SSE — only counters — so the array is
 * empty until status fetch.
 */
export interface TalentTake {
    shotIndex: number;
    hostImageUrl?: string;
    avatarVideoUrl?: string;
    durationS?: number;
    status?: string;
    error?: string;
}

export interface TalentArtifact {
    completed: number;
    total: number;
    takes?: TalentTake[];
}

export interface ScoreArtifact {
    /** Final merged-track S3 URL, present once the run wraps. */
    audioUrl?: string;
    /** Display label from `meta.audio_tracks[]` (e.g. "Background Music"). */
    label?: string;
    segmentsTotal?: number;
    segmentsCompleted?: number;
}
export interface FinalCutArtifact {
    timelineUrl: string;
    audioUrl?: string;
    wordsUrl?: string;
    contentType: ContentType;
    orientation: VideoOrientation;
}

export interface PipelineState {
    /**
     * `awaiting_review` covers review-mode runs that have wrapped at SCRIPT
     * but haven't been kicked through to TTS yet — the user must accept /
     * edit the script before the pipeline resumes. Today consumers don't
     * fully differentiate it from `in_production`; consumer migration in
     * the next phase will add review-specific UI affordances.
     */
    status: 'in_production' | 'wrapped' | 'halted' | 'awaiting_review';
    videoId: string;
    prompt: string;
    contentType: ContentType;
    orientation: VideoOrientation;
    pitch: NodeSlot<PitchArtifact>;
    research?: NodeSlot<ResearchArtifact>;
    /**
     * BeatPlanner stage — present only when the run fires `beats_planning` /
     * `beats_done` sub-stage events (the v2 pipeline path, enabled when the
     * tier has `beat_planner_enabled` set). When absent the diagram skips
     * the Beats node entirely.
     */
    beats?: NodeSlot<BeatsArtifact>;
    screenplay: NodeSlot<ScreenplayArtifact>;
    narration: NodeSlot<NarrationArtifact>;
    storyboard: NodeSlot<StoryboardArtifact>;
    /**
     * Per-scene slots — populated when the Director's shot plan is known.
     * When empty (free / standard tier without a director), the diagram
     * falls back to the single `filming` counter node instead.
     */
    scenes: SceneSlot[];
    /**
     * Aggregate counter — kept as fallback for runs without a shot plan,
     * and used by the right-panel "Filming X/N" stages-list row regardless
     * of whether scene nodes are rendered.
     */
    filming: NodeSlot<FilmingArtifact>;
    talent?: NodeSlot<TalentArtifact>;
    score?: NodeSlot<ScoreArtifact>;
    finalCut: NodeSlot<FinalCutArtifact>;
    stats: {
        elapsedMs?: number;
        cumulativeTokens?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
            estimated_cost_usd?: number | null;
        };
        tokenUsage?: TokenUsage | null;
    };
    /** S3 URLs flattened for the right-panel artifact links card */
    artifactUrls: {
        script?: string;
        audio?: string;
        words?: string;
        timeline?: string;
        videoMp4?: string;
    };
}

// ── Live source: CurrentGeneration (SSE-driven, consoleState='generating') ──

/** The shape consumed from `console/index.lazy.tsx` `CurrentGeneration`. */
export interface LiveCurrentGeneration {
    videoId: string;
    prompt: string;
    contentType: ContentType;
    orientation?: VideoOrientation;
    stage: VideoStage;
    percentage: number;
    message: string;
    htmlUrl?: string;
    audioUrl?: string;
    wordsUrl?: string;
    scriptUrl?: string;
    /** Final rendered MP4 URL — set when /urls/{video_id} returned video_url
     *  (i.e. a previous render already completed). Lets the pipeline panel
     *  show the "Download MP4" CTA on refresh without polling render status. */
    videoMp4Url?: string;
    options: Omit<GenerateVideoRequest, 'prompt'>;
    tokenUsage?: TokenUsage | null;
    shotsCompleted?: number;
    shotsTotal?: number;
    cumulativeTokens?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        estimated_cost_usd?: number | null;
    };
    recentErrors?: Array<{
        shot_index: number;
        shot_type?: string;
        error: string;
        retrying: boolean;
    }>;
    shotPlan?: Array<{
        shot_index: number;
        shot_type: string;
        start_time: number;
        end_time: number;
        duration_s: number;
        narration_excerpt?: string;
    }>;
    /** Avatar-host counters captured from SSE — see CurrentGeneration in the console. */
    hostShotCount?: number;
    hostShotCompleted?: number;
    hostBatchDone?: boolean;
    hostSubStage?: string;
    /** Background-music counters captured from SSE. */
    musicSegmentsTotal?: number;
    musicSegmentsCompleted?: number;
    musicDone?: boolean;
    musicUrl?: string;
    musicSubStage?: string;
    /** Filled when the run starts (set by parent — we don't read Date.now()
     *  inside derivation to keep it pure). */
    startedAtMs?: number;
}

/**
 * Match the freshest sub_stage hint out of `currentGeneration.message`. The
 * BE doesn't expose sub_stage as a top-level field on the live SSE event —
 * it shows up in the human-readable message, e.g. "🎙️ avatar_batch_start"
 * after our 🎙️ prefix. We keep the lookup loose: substring match in the
 * message.
 */
function detectActiveSubStage(message: string | undefined): string | null {
    if (!message) return null;
    const m = message.toLowerCase();
    for (const sub of Object.keys(SUB_STAGE_BY_NODE)) {
        if (m.includes(sub)) return sub;
    }
    return null;
}

function isPipelineHaltedFromErrors(errors?: LiveCurrentGeneration['recentErrors']): boolean {
    if (!errors) return false;
    // Any non-retrying error => halt
    return errors.some((e) => !e.retrying);
}

/** Linear-node state derivation. */
function stateForLinearNode(
    pipelineStage: PipelineStage,
    activeSubStage: string | null,
    hasArtifact: boolean,
    nodeId: PipelineNodeId,
    nodeStage: PipelineStage
): NodeState {
    if (hasArtifact) return 'wrapped';
    if (activeSubStage && SUB_STAGE_BY_NODE[activeSubStage] === nodeId) return 'in_production';
    if (STAGE_ORDER.indexOf(pipelineStage) > STAGE_ORDER.indexOf(nodeStage)) return 'wrapped';
    if (pipelineStage === nodeStage) return 'in_production';
    return 'scheduled';
}

/**
 * Match http(s)://… URLs in a free-form prompt. Loose by design — the BE's
 * intent router uses a similar regex (`web_content_capture_service.extract_urls`)
 * to decide whether to enable `scrape_url`.
 */
const URL_REGEX = /https?:\/\/[^\s)<>"']+/gi;

function promptContainsUrl(prompt: string | undefined): boolean {
    if (!prompt) return false;
    URL_REGEX.lastIndex = 0;
    return URL_REGEX.test(prompt);
}

/**
 * Live-only Research slot. We don't have SSE coverage of the intent router,
 * so we infer presence from the prompt OR from explicit routing overrides.
 * Once the script is done, Research is "wrapped" by definition (it always
 * runs before SCRIPT). PipelineFlow then enriches with sources / excerpts
 * from `metadata.intent_outcomes` for already-finished videos.
 */
function derivedResearchLive(args: {
    prompt: string;
    routingOverrides?: { tools?: { scrape_url?: boolean; web_search?: boolean } };
    scriptDone: boolean;
    runWrapped: boolean;
    halted: boolean;
    pipelineStage: PipelineStage;
}): NodeSlot<ResearchArtifact> | undefined {
    const hasUrl = promptContainsUrl(args.prompt);
    const overrides = args.routingOverrides?.tools;
    const explicitScrape = overrides?.scrape_url === true;
    const explicitSearch = overrides?.web_search === true;
    const explicitSkip = overrides?.scrape_url === false && overrides?.web_search === false;

    // Hide entirely when nothing about the prompt or overrides suggests
    // research will run — keeps the diagram compact for plain prompts.
    if (explicitSkip) return undefined;
    if (!hasUrl && !explicitScrape && !explicitSearch) return undefined;

    if (args.runWrapped || args.scriptDone) {
        // Wrapped without payload — enrichedState fills sources/screenshots
        // when status metadata loads.
        return {
            state: 'wrapped',
            data: {
                scrapedAny: hasUrl || explicitScrape,
                searchedAny: explicitSearch,
                urlsAttempted: hasUrl ? extractPromptUrls(args.prompt) : undefined,
            },
        };
    }
    if (args.halted) {
        return { state: 'cut', error: 'Research cut from production' };
    }
    // Pre-script — research either is or about to be running.
    if (
        args.pipelineStage === 'PENDING' ||
        STAGE_ORDER.indexOf(args.pipelineStage) <= STAGE_ORDER.indexOf('SCRIPT')
    ) {
        return { state: 'in_production' };
    }
    return { state: 'scheduled' };
}

function extractPromptUrls(prompt: string): string[] {
    URL_REGEX.lastIndex = 0;
    return prompt.match(URL_REGEX) ?? [];
}

/**
 * Live-only Beats slot. Visible only when the BE actually fired BeatPlanner
 * sub-stage events — we infer that from `activeSubStage` matching
 * `beats_planning` / `beats_done` OR (heuristic) when the pipeline has
 * advanced past PENDING AND we know the run uses v2 from its tier config.
 *
 * Phase A: pure detection from sub_stage. History replay (status path) will
 * mirror this once the BE surfaces a beats_v2.json URL in `s3_urls` — until
 * then completed runs won't show the Beats node even if BeatPlanner ran.
 */
function derivedBeatsLive(args: {
    activeSubStage: string | null;
    scriptDone: boolean;
    runWrapped: boolean;
    halted: boolean;
    /** Hint: if the script step appears in_production OR the run is mid-SCRIPT
     *  and we've ALREADY seen a beats_* event during this session. */
    sawBeatsEver: boolean;
}): NodeSlot<BeatsArtifact> | undefined {
    const beatsActive = args.activeSubStage === 'beats_planning';
    if (!beatsActive && !args.sawBeatsEver) return undefined;

    if (args.runWrapped || args.scriptDone) {
        return { state: 'wrapped', data: { count: 0 } };
    }
    if (args.halted) {
        return { state: 'cut', error: 'Beat planning cut from production' };
    }
    if (beatsActive) {
        return { state: 'in_production' };
    }
    return { state: 'scheduled' };
}

// ── Phase 3 helpers: Talent / Score slot derivation ──────────────────────

/**
 * Talent slot from live counters. Returns `undefined` when the user didn't
 * request a host AND we haven't seen any avatar_* sub_stage — i.e. there's
 * nothing to show, so the node is hidden entirely.
 */
function derivedTalent(args: {
    requested: boolean;
    sawStage: boolean;
    runWrapped: boolean;
    halted: boolean;
    hostShotCount?: number;
    hostShotCompleted?: number;
    hostBatchDone?: boolean;
    hostSubStage?: string;
}): NodeSlot<TalentArtifact> | undefined {
    const { requested, sawStage, runWrapped, halted } = args;
    if (!requested && !sawStage) return undefined;

    const total = args.hostShotCount ?? 0;
    const done = args.hostShotCompleted ?? 0;
    const wrapped = args.hostBatchDone || (runWrapped && requested);

    if (wrapped) {
        return { state: 'wrapped', data: { completed: total || done, total: total || done } };
    }
    if (halted) {
        return { state: 'cut', error: 'Talent cut from production' };
    }
    if (sawStage) {
        return {
            state: 'in_production',
            subStatus: args.hostSubStage,
            partialData: { completed: done, total },
        };
    }
    // Requested but no events yet — show as scheduled.
    return { state: 'scheduled' };
}

function derivedScore(args: {
    sawStage: boolean;
    runWrapped: boolean;
    halted: boolean;
    musicSegmentsTotal?: number;
    musicSegmentsCompleted?: number;
    musicDone?: boolean;
    musicUrl?: string;
    musicSubStage?: string;
}): NodeSlot<ScoreArtifact> | undefined {
    const { sawStage, runWrapped, halted } = args;
    if (!sawStage && !args.musicUrl) return undefined;

    if (args.musicDone || (runWrapped && (args.musicUrl || sawStage))) {
        return {
            state: 'wrapped',
            data: {
                audioUrl: args.musicUrl,
                segmentsTotal: args.musicSegmentsTotal,
                segmentsCompleted: args.musicSegmentsCompleted ?? args.musicSegmentsTotal,
            },
        };
    }
    if (halted) {
        return { state: 'cut', error: 'Score cut from production' };
    }
    return {
        state: 'in_production',
        subStatus: args.musicSubStage,
        partialData: {
            segmentsTotal: args.musicSegmentsTotal,
            segmentsCompleted: args.musicSegmentsCompleted,
        },
    };
}

export function derivePipelineFromLive(
    cg: LiveCurrentGeneration,
    nowMs: number = Date.now()
): PipelineState {
    const pipelineStage = (cg.stage as PipelineStage) ?? 'PENDING';
    const activeSub = detectActiveSubStage(cg.message);
    const halted = isPipelineHaltedFromErrors(cg.recentErrors);
    const orientation: VideoOrientation = cg.orientation ?? 'landscape';

    // ── Master flag: is the run unambiguously finished? ──────────────────
    // For videos opened from history, generation_progress fields like
    // shotPlan/shotsCompleted/shotsTotal aren't populated — we only have
    // the artifact URLs. When the timeline + audio (when needed) are
    // present, the pipeline must have completed every upstream stage. So
    // every node retroactively becomes `wrapped`, regardless of which
    // sub_stage signals are missing.
    const audioReady = !!cg.audioUrl || cg.contentType === 'SLIDES';
    const runWrapped = !!cg.htmlUrl && audioReady;

    // Pitch is always wrapped — the prompt exists from t=0.
    const pitch: NodeSlot<PitchArtifact> = {
        state: 'wrapped',
        data: {
            prompt: cg.prompt,
            referenceCount: 0,
        },
    };

    const screenplayState: NodeState = runWrapped
        ? 'wrapped'
        : stateForLinearNode(
              pipelineStage,
              activeSub,
              !!cg.scriptUrl,
              'screenplay',
              NODE_STAGE.screenplay
          );
    const screenplay: NodeSlot<ScreenplayArtifact> =
        screenplayState === 'wrapped'
            ? { state: 'wrapped', data: { scriptUrl: cg.scriptUrl } }
            : screenplayState === 'in_production'
              ? { state: 'in_production' }
              : { state: 'scheduled' };

    const narrationState: NodeState = runWrapped
        ? 'wrapped'
        : stateForLinearNode(
              pipelineStage,
              activeSub,
              !!cg.audioUrl,
              'narration',
              NODE_STAGE.narration
          );
    const narration: NodeSlot<NarrationArtifact> =
        narrationState === 'wrapped'
            ? {
                  state: 'wrapped',
                  data: { audioUrl: cg.audioUrl, wordsUrl: cg.wordsUrl },
              }
            : narrationState === 'in_production'
              ? { state: 'in_production' }
              : { state: 'scheduled' };

    // Storyboard wraps when shotPlan arrives (director_done), filming has
    // obviously begun (shotsCompleted > 0), or the run is fully wrapped.
    const inHtmlStage = pipelineStage === 'HTML';
    const storyboardKnown = !!cg.shotPlan?.length || (cg.shotsCompleted ?? 0) > 0;
    const storyboardState: NodeState =
        runWrapped || storyboardKnown
            ? 'wrapped'
            : inHtmlStage
              ? 'in_production'
              : STAGE_ORDER.indexOf(pipelineStage) > STAGE_ORDER.indexOf('HTML')
                ? 'wrapped'
                : 'scheduled';
    const storyboard: NodeSlot<StoryboardArtifact> =
        storyboardState === 'wrapped' && cg.shotPlan?.length
            ? {
                  state: 'wrapped',
                  data: {
                      scenes: cg.shotPlan.map((s, arrayIdx) => ({
                          index: typeof s.shot_index === 'number' ? s.shot_index : arrayIdx,
                          shotType: s.shot_type,
                          startTime: s.start_time,
                          endTime: s.end_time,
                          durationS: s.duration_s,
                          narrationExcerpt: s.narration_excerpt,
                      })),
                  },
              }
            : storyboardState === 'wrapped'
              ? { state: 'wrapped', data: { scenes: [] } }
              : storyboardState === 'in_production'
                ? { state: 'in_production' }
                : { state: 'scheduled' };

    // Filming = the act of all scenes wrapping. Aggregate counter (used as
    // fallback when scene-level data is missing).
    const total = cg.shotsTotal ?? cg.shotPlan?.length ?? 0;
    const done = cg.shotsCompleted ?? 0;
    const filmingDone = (total > 0 && done >= total) || runWrapped;
    const filmingActive = inHtmlStage && (storyboardKnown || total > 0);
    const filmingState: NodeState = filmingDone
        ? 'wrapped'
        : halted
          ? 'cut'
          : filmingActive
            ? 'in_production'
            : 'scheduled';
    const filming: NodeSlot<FilmingArtifact> =
        filmingState === 'wrapped'
            ? { state: 'wrapped', data: { shotsCompleted: total, shotsTotal: total } }
            : filmingState === 'in_production'
              ? {
                    state: 'in_production',
                    partialData: { shotsCompleted: done, shotsTotal: total },
                }
              : filmingState === 'cut'
                ? {
                      state: 'cut',
                      error:
                          cg.recentErrors?.find((e) => !e.retrying)?.error || 'Production halted',
                  }
                : { state: 'scheduled' };

    // Per-scene slots — only populated when shotPlan is known. Each scene's
    // state is derived from its index relative to `done` + any matching
    // `recentErrors`. Phase 2 doesn't enrich with thumbnails; that happens
    // post-derivation via `enrichScenesWithTimelineThumbnails`.
    const scenes: SceneSlot[] = (cg.shotPlan ?? []).map((s, arrayIdx) => {
        // Defensive fallback: when the BE omits shot_index (older payloads
        // or partial plans), use the array position so the UI never
        // renders a chain of scenes labeled "01" / "01" / "01" or collapses
        // them to a single position via colliding ids.
        const idx = typeof s.shot_index === 'number' ? s.shot_index : arrayIdx;
        const errEntry = cg.recentErrors?.find((e) => e.shot_index === idx);
        let sceneState: NodeState = 'scheduled';
        if (runWrapped) sceneState = 'wrapped';
        else if (errEntry && !errEntry.retrying) sceneState = 'cut';
        else if (errEntry && errEntry.retrying) sceneState = 'reshoot';
        else if (idx < done) sceneState = 'wrapped';
        else if (idx === done && inHtmlStage) sceneState = 'in_production';
        return {
            state: sceneState,
            index: idx,
            shotType: s.shot_type,
            narrationExcerpt: s.narration_excerpt,
            durationS: s.duration_s,
            startTime: s.start_time,
            endTime: s.end_time,
            error: sceneState === 'cut' ? errEntry?.error : undefined,
        };
    });

    // Final Cut wraps when timeline + audio (when needed) are present —
    // i.e. exactly the runWrapped condition.
    const finalCut: NodeSlot<FinalCutArtifact> = runWrapped
        ? {
              state: 'wrapped',
              data: {
                  timelineUrl: cg.htmlUrl!,
                  audioUrl: cg.audioUrl,
                  wordsUrl: cg.wordsUrl,
                  contentType: cg.contentType,
                  orientation,
              },
          }
        : halted
          ? { state: 'cut', error: 'Production halted' }
          : { state: 'in_production' };

    // ── Research (Phase 4) ───────────────────────────────────────────────
    // The pre-script intent router doesn't emit SSE events, so live state is
    // limited to "is there a URL the BE will probably scrape?" The richer
    // payload (sources / screenshots / excerpt) is enriched post-hoc from
    // `metadata.intent_outcomes` in PipelineFlow's enrichedState memo.
    const research = derivedResearchLive({
        prompt: cg.prompt,
        routingOverrides: cg.options.routing_overrides,
        scriptDone: !!cg.scriptUrl,
        runWrapped,
        halted,
        pipelineStage,
    });

    // ── Beats (v2 pipeline) ──────────────────────────────────────────────
    // Visible while BeatPlanner is running (activeSub === 'beats_planning').
    // Stays as `wrapped` once the script step is done (BeatPlanner runs
    // before _draft_script, so script_done implies beats are done too).
    // Hidden entirely on legacy v1 runs that never emitted beats_*.
    const beats = derivedBeatsLive({
        activeSubStage: activeSub,
        scriptDone: !!cg.scriptUrl,
        runWrapped,
        halted,
        // Active OR script_done implies we definitely saw beats fire on v2.
        sawBeatsEver: activeSub === 'beats_planning' || activeSub === 'beats_done',
    });

    // ── Talent / Score (Phase 3) ─────────────────────────────────────────
    // Show the Talent branch when the user requested a host avatar OR the BE
    // has emitted any avatar_* sub_stage event (covers the resume-from-history
    // case where `cg.options.host` may be missing but the SSE replay still
    // contains the stage events).
    const hostType = cg.options.host?.type;
    const talentRequested = hostType === 'avatar';
    const hostStageSeen = !!cg.hostSubStage;
    const talent = derivedTalent({
        requested: talentRequested,
        sawStage: hostStageSeen,
        runWrapped,
        halted,
        hostShotCount: cg.hostShotCount,
        hostShotCompleted: cg.hostShotCompleted,
        hostBatchDone: cg.hostBatchDone,
        hostSubStage: cg.hostSubStage,
    });

    // Music gating: live `cg.options` doesn't carry `background_music_enabled`
    // (FE GenerateVideoRequest doesn't expose it), so we only know music is in
    // the pipeline once we see a `background_music_*` sub_stage event. That
    // matches the live UX — there's nothing to show before the first event.
    const musicStageSeen = !!cg.musicSubStage;
    const score = derivedScore({
        sawStage: musicStageSeen,
        runWrapped,
        halted,
        musicSegmentsTotal: cg.musicSegmentsTotal,
        musicSegmentsCompleted: cg.musicSegmentsCompleted,
        musicDone: cg.musicDone,
        musicUrl: cg.musicUrl,
        musicSubStage: cg.musicSubStage,
    });

    const status: PipelineState['status'] = halted
        ? 'halted'
        : runWrapped
          ? 'wrapped'
          : 'in_production';

    return {
        status,
        videoId: cg.videoId,
        prompt: cg.prompt,
        contentType: cg.contentType,
        orientation,
        pitch,
        screenplay,
        narration,
        storyboard,
        scenes,
        filming,
        ...(research ? { research } : {}),
        ...(beats ? { beats } : {}),
        ...(talent ? { talent } : {}),
        ...(score ? { score } : {}),
        finalCut,
        stats: {
            elapsedMs: cg.startedAtMs ? nowMs - cg.startedAtMs : undefined,
            cumulativeTokens: cg.cumulativeTokens,
            tokenUsage: cg.tokenUsage,
        },
        artifactUrls: {
            script: cg.scriptUrl,
            audio: cg.audioUrl,
            words: cg.wordsUrl,
            timeline: cg.htmlUrl,
            videoMp4: cg.videoMp4Url,
        },
    };
}

// ── Canonical source: VideoStatusResponse (status-first model) ──────────
//
// Single derivation that produces a `PipelineState` from `/status` alone —
// the dual-path (live SSE → currentGeneration vs. polled status) collapses
// here. URLs come from `status.s3_urls`, configuration from
// `status.metadata.user_selections`, Research/Talent/Score enrichment from
// `status.metadata.{intent_outcomes,host,audio_tracks}`.
//
// Live runs feed this via `useVideoState`'s React Query polling; SSE only
// triggers re-fetches and is not the data channel. History-restored runs go
// through the same path with no separate hydration step.

export function derivePipelineFromStatus(
    status: VideoStatusResponse,
    opts?: {
        /** When provided, drives the "Elapsed" counter. Caller pins this once
         *  at submit time so derivation stays pure. */
        startedAtMs?: number;
        /** Fallbacks when the BE status payload omits a field (mostly
         *  defensive — modern /status responses include all three). */
        promptOverride?: string;
        contentTypeOverride?: ContentType;
        orientationOverride?: VideoOrientation;
    },
    nowMs: number = Date.now()
): PipelineState {
    const gp = status.generation_progress ?? null;
    const meta = status.metadata ?? null;
    const userSel: VideoStatusUserSelections = meta?.user_selections ?? {};
    const pipelineStage = (status.current_stage as PipelineStage) ?? 'PENDING';

    // ── BE-driven top-level status ─────────────────────────────────────
    // Trust `status.status` as the source of truth; the old "infer from URL
    // presence" trick is brittle once /status returns URLs incrementally.
    const beStatus = status.status;
    const halted = beStatus === 'FAILED' || beStatus === 'STALLED' || beStatus === 'CANCELLED';
    const beCompleted = beStatus === 'COMPLETED';

    // S3 URLs flattened from `s3_urls` (BE returns every populated key).
    const s3 = status.s3_urls ?? {};
    const scriptUrl = s3.script;
    const audioUrl = s3.audio;
    const wordsUrl = s3.words;
    const timelineUrl = s3.timeline;
    const videoMp4Url = s3.video;

    // Content metadata: prefer caller override, then user_selections snapshot,
    // then the status's top-level content_type / language. `prompt` follows
    // the same precedence.
    const contentType: ContentType =
        opts?.contentTypeOverride ?? userSel.content_type ?? status.content_type ?? 'VIDEO';
    const orientation: VideoOrientation =
        opts?.orientationOverride ?? userSel.orientation ?? 'landscape';
    const prompt = opts?.promptOverride ?? status.prompt ?? userSel.prompt ?? '';

    // Review-mode detection: a run that wraps at SCRIPT and was explicitly
    // target_stage='SCRIPT' is awaiting user review, not done. The console's
    // `reviewing` state subscribes to this.
    const targetStage = userSel.target_stage;
    const awaitingReview = beCompleted && targetStage === 'SCRIPT' && pipelineStage === 'SCRIPT';

    // The "everything upstream is done" flag — drives retroactive wrapping
    // when the BE status hits COMPLETED. For SLIDES content_type the audio
    // gate is bypassed (no narration produced).
    const audioReadyOrNotRequired = !!audioUrl || contentType === 'SLIDES';
    const runWrapped = beCompleted && !awaitingReview && !!timelineUrl && audioReadyOrNotRequired;

    // ── Pitch ─────────────────────────────────────────────────────────
    // Always wrapped — the prompt exists from t=0. Phase 2 will expand
    // PitchArtifact to carry the full user_selections snapshot.
    const pitch: NodeSlot<PitchArtifact> = {
        state: 'wrapped',
        data: { prompt, referenceCount: userSel.reference_files_count ?? 0 },
    };

    // ── Screenplay ────────────────────────────────────────────────────
    const screenplay: NodeSlot<ScreenplayArtifact> =
        scriptUrl || runWrapped || awaitingReview
            ? { state: 'wrapped', data: { scriptUrl } }
            : pipelineStage === 'SCRIPT'
              ? { state: 'in_production' }
              : STAGE_ORDER.indexOf(pipelineStage) > STAGE_ORDER.indexOf('SCRIPT')
                ? { state: 'wrapped', data: {} }
                : { state: 'scheduled' };

    // ── Narration ─────────────────────────────────────────────────────
    const narration: NodeSlot<NarrationArtifact> =
        audioUrl || runWrapped
            ? { state: 'wrapped', data: { audioUrl, wordsUrl } }
            : pipelineStage === 'TTS' || pipelineStage === 'WORDS'
              ? { state: 'in_production' }
              : STAGE_ORDER.indexOf(pipelineStage) > STAGE_ORDER.indexOf('TTS')
                ? { state: 'wrapped', data: {} }
                : { state: 'scheduled' };

    // ── Storyboard ────────────────────────────────────────────────────
    const shotPlan = gp?.shot_plan ?? [];
    const shotsCompleted = gp?.shots_completed ?? 0;
    const shotsTotal = gp?.shots_total ?? 0;
    const storyboardScenes = shotPlan.map((s, arrayIdx) => ({
        index: typeof s.shot_index === 'number' ? s.shot_index : arrayIdx,
        shotType: s.shot_type,
        startTime: s.start_time,
        endTime: s.end_time,
        durationS: s.duration_s,
        narrationExcerpt: s.narration_excerpt,
    }));
    const storyboard: NodeSlot<StoryboardArtifact> =
        shotPlan.length > 0 || runWrapped
            ? { state: 'wrapped', data: { scenes: storyboardScenes } }
            : pipelineStage === 'HTML'
              ? { state: 'in_production' }
              : { state: 'scheduled' };

    // ── Filming (aggregate counter; also drives the legacy free-tier node) ──
    const filming: NodeSlot<FilmingArtifact> = runWrapped
        ? {
              state: 'wrapped',
              data: { shotsCompleted: shotsTotal || shotsCompleted, shotsTotal },
          }
        : halted
          ? { state: 'cut', error: status.error_message || 'Production halted' }
          : pipelineStage === 'HTML' && shotsTotal > 0
            ? { state: 'in_production', partialData: { shotsCompleted, shotsTotal } }
            : { state: 'scheduled' };

    // ── Per-scene slots ───────────────────────────────────────────────
    const errors = gp?.errors ?? [];
    const scenes: SceneSlot[] = shotPlan.map((s, arrayIdx) => {
        const idx = typeof s.shot_index === 'number' ? s.shot_index : arrayIdx;
        const errEntry = errors.find((e) => e.shot_index === idx);
        let sceneState: NodeState = 'scheduled';
        if (runWrapped) sceneState = 'wrapped';
        else if (errEntry && !errEntry.retrying) sceneState = 'cut';
        else if (errEntry && errEntry.retrying) sceneState = 'reshoot';
        else if (idx < shotsCompleted) sceneState = 'wrapped';
        else if (idx === shotsCompleted && pipelineStage === 'HTML') sceneState = 'in_production';
        return {
            state: sceneState,
            index: idx,
            shotType: s.shot_type,
            narrationExcerpt: s.narration_excerpt,
            durationS: s.duration_s,
            startTime: s.start_time,
            endTime: s.end_time,
            error: sceneState === 'cut' ? errEntry?.error : undefined,
        };
    });

    // ── Final Cut ─────────────────────────────────────────────────────
    const finalCut: NodeSlot<FinalCutArtifact> = runWrapped
        ? {
              state: 'wrapped',
              data: {
                  timelineUrl: timelineUrl!,
                  audioUrl,
                  wordsUrl,
                  contentType,
                  orientation,
              },
          }
        : halted
          ? { state: 'cut', error: status.error_message || 'Production halted' }
          : { state: awaitingReview ? 'scheduled' : 'in_production' };

    // ── Research (from metadata.intent_outcomes) ──────────────────────
    // intent_outcomes is written ONCE at gen start before any pipeline stage
    // runs — so the moment /status is polled, sources / screenshots / excerpts
    // are available. Absorbs the PipelineFlow.enrichedState research branch.
    const research = derivedResearchFromStatus({
        prompt,
        intent: meta?.intent_outcomes,
        routingOverrides: userSel.routing_overrides,
        pipelineStage,
        runWrapped,
        halted,
    });

    // ── Talent (from metadata.host) ───────────────────────────────────
    // Host outputs are accumulated server-side as the avatar batch runs.
    // Phase 3 BE work will flush per-shot. Until then, the artifacts arrive
    // at batch end — same UX as today for already-finished videos.
    const talent = derivedTalentFromStatus({
        userSelHostType: userSel.host?.type,
        userSelGenerateAvatar: userSel.generate_avatar,
        metaHost: meta?.host,
        runWrapped,
        halted,
    });

    // ── Score (from user_selections + metadata.audio_tracks) ──────────
    // The merged Lyria track is in timeline.json today (`meta.audio_tracks`);
    // Phase 3 BE work will mirror it into status.metadata.audio_tracks. We
    // read defensively from status — if missing, PipelineFlow's existing
    // `useBackgroundMusicTrack` hook continues to backfill the URL until BE
    // exposure lands.
    const score = derivedScoreFromStatus({
        userSelEnabled: userSel.background_music_enabled,
        metaEnabled: meta?.background_music_enabled,
        audioTracks: meta?.audio_tracks,
        runWrapped,
        halted,
    });

    const tokenUsage = status.token_usage ?? null;
    const cumulativeTokens = gp?.cumulative_tokens;

    const pipelineStatus: PipelineState['status'] = awaitingReview
        ? 'awaiting_review'
        : halted
          ? 'halted'
          : runWrapped
            ? 'wrapped'
            : 'in_production';

    return {
        status: pipelineStatus,
        videoId: status.video_id,
        prompt,
        contentType,
        orientation,
        pitch,
        screenplay,
        narration,
        storyboard,
        scenes,
        filming,
        ...(research ? { research } : {}),
        ...(talent ? { talent } : {}),
        ...(score ? { score } : {}),
        finalCut,
        stats: {
            elapsedMs: opts?.startedAtMs ? nowMs - opts.startedAtMs : undefined,
            cumulativeTokens,
            tokenUsage,
        },
        artifactUrls: {
            script: scriptUrl,
            audio: audioUrl,
            words: wordsUrl,
            timeline: timelineUrl,
            videoMp4: videoMp4Url,
        },
    };
}

// ── Helpers for derivePipelineFromStatus ────────────────────────────────
//
// Three internal helpers absorb the enrichment logic previously held in
// PipelineFlow's `enrichedState` memo. Hoisting them here gives a single
// shape contract for any consumer of `/status` and avoids the dual
// "live state + memo enrichment" path.

function derivedResearchFromStatus(args: {
    prompt: string;
    intent: VideoStatusMetadata['intent_outcomes'];
    routingOverrides?: Record<string, unknown> | null;
    pipelineStage: PipelineStage;
    runWrapped: boolean;
    halted: boolean;
}): NodeSlot<ResearchArtifact> | undefined {
    const { intent, runWrapped, halted, pipelineStage, prompt } = args;
    const hasUrl = promptContainsUrl(prompt);
    const overrides = (
        args.routingOverrides as
            | { tools?: { scrape_url?: boolean; web_search?: boolean } }
            | undefined
    )?.tools;
    const explicitScrape = overrides?.scrape_url === true;
    const explicitSearch = overrides?.web_search === true;
    const explicitSkip = overrides?.scrape_url === false && overrides?.web_search === false;

    const toolsEnabled = intent?.tools_enabled ?? [];
    const scrapeArt = intent?.scrape_url_artifacts;
    const searchArt = intent?.web_search_artifacts;
    const intentHappened =
        toolsEnabled.includes('scrape_url') ||
        toolsEnabled.includes('web_search') ||
        !!scrapeArt ||
        !!searchArt;

    if (explicitSkip) return undefined;
    if (!intentHappened && !hasUrl && !explicitScrape && !explicitSearch) return undefined;

    const enrichedData: ResearchArtifact = {
        scrapedAny: !!scrapeArt && !scrapeArt.error,
        searchedAny: !!searchArt && !searchArt.error,
        urlsAttempted:
            scrapeArt?.urls_attempted ?? (hasUrl ? extractPromptUrls(prompt) : undefined),
        screenshots: (scrapeArt?.files_captured ?? [])
            .filter((f) => !!f.url)
            .map((f) => ({ url: f.url as string, name: f.name })),
        scrapedExcerpt: scrapeArt?.text_excerpt,
        searchAnswer: searchArt?.answer,
        sources: (searchArt?.sources ?? [])
            .filter((s) => !!s.url)
            .map((s) => ({ url: s.url as string, host: s.host, title: s.title })),
        searchQuery: searchArt?.query,
    };

    if (halted) return { state: 'cut', error: 'Research cut from production' };

    // Research runs entirely pre-SCRIPT. Once the pipeline has moved past
    // SCRIPT (or the run is wrapped), it's done. While in PENDING/SCRIPT,
    // it's actively running and its artifacts may be partial.
    const isPreOrInScript =
        pipelineStage === 'PENDING' ||
        STAGE_ORDER.indexOf(pipelineStage) <= STAGE_ORDER.indexOf('SCRIPT');

    if (runWrapped || !isPreOrInScript) {
        return { state: 'wrapped', data: enrichedData };
    }
    return { state: 'in_production', partialData: enrichedData };
}

function derivedTalentFromStatus(args: {
    userSelHostType?: 'avatar' | 'raw';
    userSelGenerateAvatar?: boolean;
    metaHost?: VideoStatusMetadata['host'];
    runWrapped: boolean;
    halted: boolean;
}): NodeSlot<TalentArtifact> | undefined {
    const { userSelHostType, userSelGenerateAvatar, metaHost, runWrapped, halted } = args;
    const requested = userSelHostType === 'avatar' || userSelGenerateAvatar === true;
    const hostEnabled = metaHost ? metaHost.enabled !== false : false;
    const isAvatarBlock =
        metaHost?.type === 'avatar' || (metaHost && !metaHost.type && !!metaHost.avatar);

    if (!requested && !(hostEnabled && isAvatarBlock)) return undefined;

    const outputs = metaHost?.outputs;
    const takes = (outputs?.shot_artifacts ?? []).map((a) => ({
        shotIndex: a.shot_index,
        hostImageUrl: a.host_image_url,
        avatarVideoUrl: a.avatar_video_url,
        durationS: a.duration_s_actual ?? a.duration_s,
        status: a.status,
        error: a.error,
    }));
    const completedTakes = takes.filter(
        (t) => t.status === 'completed' || !!t.avatarVideoUrl || !!t.hostImageUrl
    );
    const total = outputs?.host_shot_count ?? takes.length ?? 0;

    if (halted) return { state: 'cut', error: 'Talent cut from production' };
    if (runWrapped || completedTakes.length > 0) {
        return {
            state: 'wrapped',
            data: {
                completed: completedTakes.length || total,
                total: total || completedTakes.length,
                takes,
            },
        };
    }
    // Phase 3 will populate partialData.takes here once BE flushes per-shot.
    // Until then, "requested but not yet wrapped" shows as scheduled.
    return { state: 'scheduled' };
}

function derivedScoreFromStatus(args: {
    userSelEnabled?: boolean | null;
    metaEnabled?: boolean | null;
    audioTracks?: VideoStatusMetadata['audio_tracks'];
    runWrapped: boolean;
    halted: boolean;
}): NodeSlot<ScoreArtifact> | undefined {
    const enabled = args.userSelEnabled === true || args.metaEnabled === true;
    const bgTrack = (args.audioTracks ?? []).find((t) => t?.id === 'background-music');
    const url = bgTrack?.url;

    if (!enabled && !url) return undefined;
    if (args.halted) return { state: 'cut', error: 'Score cut from production' };
    if (args.runWrapped || url) {
        return { state: 'wrapped', data: { audioUrl: url, label: bgTrack?.label } };
    }
    // Phase 3 BE work will surface segment counters; until then "enabled but
    // not yet wrapped" shows as scheduled.
    return { state: 'scheduled' };
}
