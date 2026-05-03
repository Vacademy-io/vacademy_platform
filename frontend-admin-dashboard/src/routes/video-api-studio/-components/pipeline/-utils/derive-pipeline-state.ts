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
    VideoStatusResponse,
    VideoUrls,
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
    status: 'in_production' | 'wrapped' | 'halted';
    videoId: string;
    prompt: string;
    contentType: ContentType;
    orientation: VideoOrientation;
    pitch: NodeSlot<PitchArtifact>;
    research?: NodeSlot<ResearchArtifact>;
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
        },
    };
}

// ── Polled source: VideoStatusResponse + VideoUrls ──────────────────────

export function derivePipelineFromStatus(
    status: VideoStatusResponse,
    urls: VideoUrls,
    extra?: {
        prompt?: string;
        contentType?: ContentType;
        orientation?: VideoOrientation;
        startedAtMs?: number;
    },
    nowMs: number = Date.now()
): PipelineState {
    const gp = status.generation_progress ?? null;
    const pipelineStage = (status.current_stage as PipelineStage) ?? 'PENDING';
    const halted = status.status === 'FAILED' || status.status === 'STALLED';

    const s3 = (status.s3_urls ?? {}) as Record<string, string | undefined>;
    const scriptUrl = s3.script;
    const audioUrl = urls.audio_url ?? s3.audio ?? undefined;
    const wordsUrl = urls.words_url ?? s3.words ?? undefined;
    const timelineUrl = urls.html_url ?? s3.timeline ?? undefined;
    const videoMp4Url = urls.video_url ?? s3.video ?? undefined;

    const contentType: ContentType =
        extra?.contentType ??
        (status as unknown as { content_type?: ContentType }).content_type ??
        'VIDEO';
    const orientation: VideoOrientation = extra?.orientation ?? 'landscape';
    const prompt = extra?.prompt ?? (status as unknown as { prompt?: string }).prompt ?? '';

    // Same master flag as the live derivation: timeline + audio (when needed)
    // means the run is unambiguously finished, regardless of which stage the
    // BE record happens to report.
    const audioReadyOrNotRequired = !!audioUrl || contentType === 'SLIDES';
    const runWrapped = !!timelineUrl && audioReadyOrNotRequired;
    const allLinearWrapped = runWrapped;

    const pitch: NodeSlot<PitchArtifact> = {
        state: 'wrapped',
        data: { prompt, referenceCount: 0 },
    };

    const screenplay: NodeSlot<ScreenplayArtifact> =
        scriptUrl || allLinearWrapped
            ? { state: 'wrapped', data: { scriptUrl } }
            : pipelineStage === 'SCRIPT'
              ? { state: 'in_production' }
              : STAGE_ORDER.indexOf(pipelineStage) > STAGE_ORDER.indexOf('SCRIPT')
                ? { state: 'wrapped', data: {} }
                : { state: 'scheduled' };

    const narration: NodeSlot<NarrationArtifact> =
        audioUrl || allLinearWrapped
            ? { state: 'wrapped', data: { audioUrl, wordsUrl } }
            : pipelineStage === 'TTS' || pipelineStage === 'WORDS'
              ? { state: 'in_production' }
              : STAGE_ORDER.indexOf(pipelineStage) > STAGE_ORDER.indexOf('TTS')
                ? { state: 'wrapped', data: {} }
                : { state: 'scheduled' };

    const shotPlan = gp?.shot_plan ?? [];
    const shotsCompleted = gp?.shots_completed ?? 0;
    const shotsTotal = gp?.shots_total ?? 0;

    const storyboard: NodeSlot<StoryboardArtifact> =
        shotPlan.length > 0 || allLinearWrapped
            ? {
                  state: 'wrapped',
                  data: {
                      scenes: shotPlan.map((s, arrayIdx) => ({
                          index: typeof s.shot_index === 'number' ? s.shot_index : arrayIdx,
                          shotType: s.shot_type,
                          startTime: s.start_time,
                          endTime: s.end_time,
                          durationS: s.duration_s,
                          narrationExcerpt: s.narration_excerpt,
                      })),
                  },
              }
            : pipelineStage === 'HTML'
              ? { state: 'in_production' }
              : { state: 'scheduled' };

    const filming: NodeSlot<FilmingArtifact> = allLinearWrapped
        ? {
              state: 'wrapped',
              data: { shotsCompleted: shotsTotal || shotsCompleted, shotsTotal },
          }
        : halted
          ? { state: 'cut', error: 'Production halted' }
          : pipelineStage === 'HTML' && shotsTotal > 0
            ? {
                  state: 'in_production',
                  partialData: { shotsCompleted, shotsTotal },
              }
            : { state: 'scheduled' };

    // Per-scene slots from the polled shot plan. State derives from
    // `shots_completed` (and `errors[]` once we wire up post-fix retry
    // visualization).
    const errors = gp?.errors ?? [];
    const scenes: SceneSlot[] = shotPlan.map((s, arrayIdx) => {
        const idx = typeof s.shot_index === 'number' ? s.shot_index : arrayIdx;
        const errEntry = errors.find((e) => e.shot_index === idx);
        let sceneState: NodeState = 'scheduled';
        if (allLinearWrapped) sceneState = 'wrapped';
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
          ? { state: 'cut', error: 'Production halted' }
          : { state: 'in_production' };

    // FE's VideoStatusResponse type doesn't currently include token_usage,
    // even though the BE Pydantic schema does. Read it via cast.
    const tokenUsage = ((status as unknown as { token_usage?: TokenUsage | null }).token_usage ??
        null) as TokenUsage | null;
    const cumulativeTokens = gp?.cumulative_tokens;

    return {
        status: halted ? 'halted' : timelineUrl ? 'wrapped' : 'in_production',
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
        finalCut,
        stats: {
            elapsedMs: extra?.startedAtMs ? nowMs - extra.startedAtMs : undefined,
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
