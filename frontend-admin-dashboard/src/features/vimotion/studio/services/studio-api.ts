/**
 * Typed HTTP client for the Vimotion Studio multi-asset video editing pipeline.
 *
 * Backend mounts at {AI_SERVICE_BASE_URL}/external/studio/v1/* via
 * app_factory.py. See app/routers/studio_projects.py for the source of truth.
 *
 * Type shapes mirror app/schemas/studio_projects.py — keep in sync. Maintainer
 * notes in docs/ai_content/AI_VIDEO_STUDIO.md §11.
 *
 * P1 surface (real backend handlers): projects CRUD. The wizard / build /
 * frame / render endpoints currently throw HTTP 501; placeholder client
 * functions are defined so FE can import once and not need a churn pass
 * when P2+ lands.
 */
import { AI_SERVICE_BASE_URL } from '@/constants/urls';

// ---------------------------------------------------------------------------
// Enums (mirror app/schemas/studio_projects.py)
// ---------------------------------------------------------------------------

export type AssetKind = 'video' | 'image';
export type AssetMode = 'podcast' | 'demo' | 'photo' | 'screenshot' | 'diagram';
export type TargetAspect = '9:16' | '16:9' | '1:1';
export type WizardStep = 'arrangement' | 'cuts' | 'overlays' | 'audio';
export type ProjectStatus =
    | 'DRAFT'
    | 'PLANNING'
    | 'READY_TO_BUILD'
    | 'BUILDING'
    | 'PUBLISHED'
    | 'ARCHIVED';
export type BuildStatus =
    | 'PENDING'
    | 'BUILDING'
    | 'AWAITING_EDIT'
    | 'RENDERED'
    | 'FAILED';
export type BuildStage =
    | 'PENDING'
    | 'ASSEMBLE_AUDIO'
    | 'ASSEMBLE_WORDS'
    | 'ASSEMBLE_TIMELINE'
    | 'COMPOSE_HTML'
    | 'UPLOAD'
    | 'HANDOFF'
    | 'RENDERED'
    | 'FAILED';
export type ToolUserAction = 'accepted' | 'rejected' | 'edited' | 'auto';

export type CutAggressiveness = 'light' | 'medium' | 'aggressive';
export type CaptionPreset = 'hormozi' | 'karaoke' | 'pop' | 'clean' | 'none';
export type BgmPolicy = 'auto' | 'always' | 'never';
export type SfxPolicy = 'auto' | 'always' | 'never';
export type TransitionStyle = 'cuts_only' | 'smooth' | 'energetic';

// ---------------------------------------------------------------------------
// Per-asset overrides
// ---------------------------------------------------------------------------

export interface AssetOverrides {
    initial_range_s?: [number, number] | null;
    exclude_ranges_s?: [number, number][];
    audio_only?: boolean;
    video_only?: boolean;
    primary_speaker_face_id?: string | null;
    notes?: string | null;
}

export interface AssetRef {
    asset_id: string;
    handle: string;
    kind: AssetKind;
    mode?: AssetMode | null;
    overrides?: AssetOverrides | null;
}

// ---------------------------------------------------------------------------
// Project-level preferences + model overrides
// ---------------------------------------------------------------------------

export interface ProjectPreferences {
    cut_aggressiveness?: CutAggressiveness | null;
    caption_preset?: CaptionPreset | null;
    bgm_policy?: BgmPolicy | null;
    sfx_policy?: SfxPolicy | null;
    transition_style?: TransitionStyle | null;
    color_scheme_hints?: string[];
    tone?: string | null;
    notes?: string | null;
}

export interface ModelOverrides {
    default?: string | null;
    per_stage?: Record<string, string> | null;
}

// ---------------------------------------------------------------------------
// Create / update project
// ---------------------------------------------------------------------------

export interface CreateProjectRequest {
    name?: string | null;
    source_asset_refs: AssetRef[];
    user_prompt?: string | null;
    target_aspect?: TargetAspect | null;
    target_duration_s?: number | null;
    preferences?: ProjectPreferences | null;
    model_overrides?: ModelOverrides | null;
}

export interface UpdateProjectRequest {
    name?: string | null;
    source_asset_refs?: AssetRef[] | null;
    user_prompt?: string | null;
    target_aspect?: TargetAspect | null;
    target_duration_s?: number | null;
    preferences?: ProjectPreferences | null;
    model_overrides?: ModelOverrides | null;
}

// ---------------------------------------------------------------------------
// Wizard plan / confirm / refine
// ---------------------------------------------------------------------------

export interface OperationSpec {
    tool: string;
    params: Record<string, unknown>;
    reason?: string | null;
}

export interface WizardStepPlan {
    step: WizardStep;
    operations: OperationSpec[];
    notes?: string | null;
}

export interface WizardPlanRequest {
    extra_context?: string | null;
    tools_disabled?: string[];
    tools_enabled?: string[];
}

export interface RefineStepRequest {
    refinement_prompt: string;
}

export interface OperationDecision {
    operation_index: number;
    action: ToolUserAction;
    edited_params?: Record<string, unknown> | null;
}

export interface ConfirmedStepPlan {
    step: WizardStep;
    operations: OperationSpec[];
    decisions: OperationDecision[];
    manual_operations: OperationSpec[];
    operation_order?: number[] | null;
    skipped: boolean;
}

export interface ConfirmStepRequest {
    confirmed: ConfirmedStepPlan;
}

// ---------------------------------------------------------------------------
// Builds + project responses
// ---------------------------------------------------------------------------

export interface CreateBuildRequest {
    name?: string | null;
    notes?: string | null;
    from_build_id?: string | null;
    aspect?: TargetAspect | null;
    fps?: number | null;
}

export interface BuildSummary {
    id: string;
    project_id: string;
    version: number;
    name?: string | null;
    notes?: string | null;
    status: BuildStatus;
    build_stage: BuildStage;
    progress: number;
    has_video: boolean;
    is_published: boolean;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface BuildResponse {
    id: string;
    project_id: string;
    version: number;
    name?: string | null;
    notes?: string | null;
    plan_snapshot: Record<string, unknown>;
    status: BuildStatus;
    build_stage: BuildStage;
    progress: number;
    stages: Array<Record<string, unknown>>;
    s3_urls: Record<string, unknown>;
    config: Record<string, unknown>;
    extra_metadata: Record<string, unknown>;
    error_message?: string | null;
    is_published: boolean;
    created_at?: string | null;
    updated_at?: string | null;
    completed_at?: string | null;
}

export interface BuildStatusResponse {
    id: string;
    project_id: string;
    version: number;
    status: BuildStatus;
    build_stage: BuildStage;
    progress: number;
    error_message?: string | null;
    live?: Record<string, unknown> | null;
}

export interface ProjectSummary {
    id: string;
    institute_id: string;
    name?: string | null;
    status: ProjectStatus;
    asset_count: number;
    build_count: number;
    published_build_id?: string | null;
    target_aspect?: TargetAspect | null;
    target_duration_s?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface ProjectResponse {
    id: string;
    institute_id: string;
    name?: string | null;
    source_asset_refs: AssetRef[];
    user_prompt?: string | null;
    target_aspect?: TargetAspect | null;
    target_duration_s?: number | null;
    preferences?: ProjectPreferences | null;
    model_overrides?: ModelOverrides | null;
    confirmed_plan: Record<string, unknown>;
    published_build_id?: string | null;
    builds: BuildSummary[];
    status: ProjectStatus;
    config: Record<string, unknown>;
    extra_metadata: Record<string, unknown>;
    error_message?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    archived_at?: string | null;
}

// ---------------------------------------------------------------------------
// Frame + render (per build)
// ---------------------------------------------------------------------------

export interface AddStudioFrameRequest {
    html: string;
    in_time?: number | null;
    exit_time?: number | null;
    z?: number | null;
    entry_id?: string | null;
    insert_after_entry_id?: string | null;
    html_start_x?: number | null;
    html_start_y?: number | null;
    html_end_x?: number | null;
    html_end_y?: number | null;
    entry_meta?: Record<string, unknown> | null;
}

export interface UpdateStudioFrameRequest {
    entry_id?: string | null;
    frame_index?: number | null;
    html?: string | null;
    in_time?: number | null;
    exit_time?: number | null;
    z?: number | null;
    entry_meta?: Record<string, unknown> | null;
}

export interface DeleteStudioFrameRequest {
    entry_id?: string | null;
    frame_index?: number | null;
}

export interface ReorderStudioFrameRequest {
    entry_id: string;
    to_index: number;
}

export interface FrameResponse {
    status: string;
    build_id: string;
    entry_id?: string | null;
    frame_index?: number | null;
    timeline_url?: string | null;
    total_duration?: number | null;
    entry_count?: number | null;
    message?: string | null;
}

export type CaptionFontFamily =
    | 'system' | 'inter' | 'montserrat' | 'noto-sans' | 'fira-code';
export type CaptionStyleKind = 'phrase' | 'karaoke';
export type CaptionPosition = 'top' | 'bottom';
export type CaptionSizeBucket = 'S' | 'M' | 'L';
export type ResolutionBucket = '720p' | '1080p';

export interface StudioRenderRequest {
    resolution?: ResolutionBucket | null;
    fps?: number | null;
    show_captions?: boolean | null;
    show_branding?: boolean | null;
    caption_position?: CaptionPosition | null;
    caption_text_color?: string | null;
    caption_bg_color?: string | null;
    caption_bg_opacity?: number | null;
    caption_size?: CaptionSizeBucket | null;
    caption_style?: CaptionStyleKind | null;
    caption_font_family?: CaptionFontFamily | null;
    caption_font_weight?: number | null;
    caption_text_stroke_width?: number | null;
    caption_text_stroke_color?: string | null;
    caption_highlight_color?: string | null;
    caption_preset?: string | null;
}

export interface StudioRenderResponse {
    job_id: string;
    status: string;
}

// ---------------------------------------------------------------------------
// Pagination params
// ---------------------------------------------------------------------------

export interface ListProjectsParams {
    limit?: number;
    offset?: number;
    status?: ProjectStatus;
    include_archived?: boolean;
}

export interface ListBuildsParams {
    limit?: number;
    offset?: number;
    status?: BuildStatus;
    include_archived?: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const BASE = `${AI_SERVICE_BASE_URL}/external/studio/v1`;

function headers(apiKey: string): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-Institute-Key': apiKey,
    };
}

async function readError(resp: Response, fallback: string): Promise<string> {
    try {
        const body = await resp.text();
        return body
            ? `${fallback} (${resp.status}): ${body.slice(0, 400)}`
            : `${fallback} (${resp.status})`;
    } catch {
        return `${fallback} (${resp.status})`;
    }
}

function buildQuery(params: object): string {
    const sp = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null) continue;
        sp.set(key, String(val));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
}

// ── Projects CRUD (P1: wired) ──────────────────────────────────────────────

export async function createStudioProject(
    apiKey: string,
    request: CreateProjectRequest
): Promise<ProjectResponse> {
    const resp = await fetch(`${BASE}/projects`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(request),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Create studio project failed'));
    return resp.json();
}

export async function listStudioProjects(
    apiKey: string,
    params: ListProjectsParams = {}
): Promise<ProjectSummary[]> {
    const resp = await fetch(`${BASE}/projects${buildQuery(params)}`, {
        method: 'GET',
        headers: headers(apiKey),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'List studio projects failed'));
    return resp.json();
}

export async function getStudioProject(
    apiKey: string,
    projectId: string
): Promise<ProjectResponse> {
    const resp = await fetch(`${BASE}/projects/${encodeURIComponent(projectId)}`, {
        method: 'GET',
        headers: headers(apiKey),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Get studio project failed'));
    return resp.json();
}

export async function updateStudioProject(
    apiKey: string,
    projectId: string,
    request: UpdateProjectRequest
): Promise<ProjectResponse> {
    const resp = await fetch(`${BASE}/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: headers(apiKey),
        body: JSON.stringify(request),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Update studio project failed'));
    return resp.json();
}

export async function deleteStudioProject(
    apiKey: string,
    projectId: string
): Promise<void> {
    const resp = await fetch(`${BASE}/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        headers: headers(apiKey),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Delete studio project failed'));
}

// ── Wizard (P2+: backend returns 501 today) ────────────────────────────────

export async function planWizardStep(
    apiKey: string,
    projectId: string,
    step: WizardStep,
    request: WizardPlanRequest = {}
): Promise<WizardStepPlan> {
    const resp = await fetch(
        `${BASE}/projects/${encodeURIComponent(projectId)}/wizard/${step}/plan`,
        { method: 'POST', headers: headers(apiKey), body: JSON.stringify(request) }
    );
    if (!resp.ok) throw new Error(await readError(resp, `Plan ${step} step failed`));
    return resp.json();
}

export async function confirmWizardStep(
    apiKey: string,
    projectId: string,
    step: WizardStep,
    request: ConfirmStepRequest
): Promise<ProjectResponse> {
    const resp = await fetch(
        `${BASE}/projects/${encodeURIComponent(projectId)}/wizard/${step}/confirm`,
        { method: 'POST', headers: headers(apiKey), body: JSON.stringify(request) }
    );
    if (!resp.ok) throw new Error(await readError(resp, `Confirm ${step} step failed`));
    return resp.json();
}

export async function refineWizardStep(
    apiKey: string,
    projectId: string,
    step: WizardStep,
    request: RefineStepRequest
): Promise<WizardStepPlan> {
    const resp = await fetch(
        `${BASE}/projects/${encodeURIComponent(projectId)}/wizard/${step}/refine`,
        { method: 'POST', headers: headers(apiKey), body: JSON.stringify(request) }
    );
    if (!resp.ok) throw new Error(await readError(resp, `Refine ${step} step failed`));
    return resp.json();
}

// ── Builds (P4+: backend returns 501 today) ────────────────────────────────

export async function createStudioBuild(
    apiKey: string,
    projectId: string,
    request: CreateBuildRequest
): Promise<BuildResponse> {
    const resp = await fetch(
        `${BASE}/projects/${encodeURIComponent(projectId)}/builds`,
        { method: 'POST', headers: headers(apiKey), body: JSON.stringify(request) }
    );
    if (!resp.ok) throw new Error(await readError(resp, 'Create studio build failed'));
    return resp.json();
}

export async function listStudioBuilds(
    apiKey: string,
    projectId: string,
    params: ListBuildsParams = {}
): Promise<BuildSummary[]> {
    const resp = await fetch(
        `${BASE}/projects/${encodeURIComponent(projectId)}/builds${buildQuery(params)}`,
        { method: 'GET', headers: headers(apiKey) }
    );
    if (!resp.ok) throw new Error(await readError(resp, 'List studio builds failed'));
    return resp.json();
}

export async function getStudioBuild(
    apiKey: string,
    buildId: string
): Promise<BuildResponse> {
    const resp = await fetch(`${BASE}/builds/${encodeURIComponent(buildId)}`, {
        method: 'GET',
        headers: headers(apiKey),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Get studio build failed'));
    return resp.json();
}

export async function getStudioBuildStatus(
    apiKey: string,
    buildId: string
): Promise<BuildStatusResponse> {
    const resp = await fetch(
        `${BASE}/builds/${encodeURIComponent(buildId)}/status`,
        { method: 'GET', headers: headers(apiKey) }
    );
    if (!resp.ok) throw new Error(await readError(resp, 'Get build status failed'));
    return resp.json();
}

export async function publishStudioBuild(
    apiKey: string,
    buildId: string
): Promise<ProjectResponse> {
    const resp = await fetch(
        `${BASE}/builds/${encodeURIComponent(buildId)}/publish`,
        { method: 'POST', headers: headers(apiKey) }
    );
    if (!resp.ok) throw new Error(await readError(resp, 'Publish build failed'));
    return resp.json();
}

export async function deleteStudioBuild(apiKey: string, buildId: string): Promise<void> {
    const resp = await fetch(`${BASE}/builds/${encodeURIComponent(buildId)}`, {
        method: 'DELETE',
        headers: headers(apiKey),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Delete studio build failed'));
}

export async function renderStudioBuild(
    apiKey: string,
    buildId: string,
    request: StudioRenderRequest = {}
): Promise<StudioRenderResponse> {
    const resp = await fetch(`${BASE}/builds/${encodeURIComponent(buildId)}/render`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(request),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Render studio build failed'));
    return resp.json();
}
