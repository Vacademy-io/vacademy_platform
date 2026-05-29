"""
Router for the Vimotion Studio multi-asset video editing pipeline.

Status: P4 — projects CRUD (P1) + wizard plan/confirm/refine (P2/P3) + builds
(create/list/get/status/publish/delete, P4) all wired. Editor /frame/* + render
endpoints remain 501 stubs awaiting P5.

See docs/ai_content/AI_VIDEO_STUDIO.md for phase status and the full
endpoint surface (§4) + user-control surface (§13).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from ..dependencies import get_institute_from_api_key
from ..models.ai_studio_build import AiStudioBuild
from ..models.ai_studio_project import AiStudioProject
from ..repositories.ai_studio_build_repository import AiStudioBuildRepository
from ..repositories.ai_studio_project_repository import AiStudioProjectRepository
from ..schemas.studio_projects import (
    AddStudioFrameRequest,
    AssetRef,
    BuildResponse,
    BuildStatusResponse,
    BuildSummary,
    ConfirmStepRequest,
    CreateBuildRequest,
    CreateProjectRequest,
    DeleteStudioFrameRequest,
    FrameResponse,
    ModelOverrides,
    ProjectPreferences,
    ProjectResponse,
    ProjectSummary,
    RefineStepRequest,
    ReorderStudioFrameRequest,
    StudioRenderRequest,
    StudioRenderResponse,
    UpdateProjectRequest,
    UpdateStudioFrameRequest,
    WizardPlanRequest,
    WizardStep,
    WizardStepPlan,
)
from ..services.studio_asset_validator import (
    failures_to_http_detail,
    validate_asset_refs,
)
from ..services.studio_asset_manifest import build_asset_manifest_with_raw
from ..services.studio_plan_service import StudioPlanService, resolve_step_model
from ..services import studio_cut_detectors
from ..services.studio_orchestrator import (
    BuildContext,
    dispatch_build,
    register_all_stages as register_studio_build_stages,
)

# Install the build-stage handlers on top of the orchestrator's no-ops.
register_studio_build_stages()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/external/studio/v1", tags=["studio"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _not_implemented(endpoint: str) -> HTTPException:
    """Centralized 501 body so the FE can identify unwired endpoints uniformly."""
    return HTTPException(
        status_code=501,
        detail={
            "error": "not_implemented",
            "endpoint": endpoint,
            "message": (
                f"Studio endpoint '{endpoint}' is part of the P0 contract surface "
                "but not yet wired. See docs/ai_content/AI_VIDEO_STUDIO.md §8 "
                "for the current phase status."
            ),
        },
    )


# Project-level config keys we store inside the project's `config` JSONB.
# Defined here (not in schemas) because they're server-internal storage
# layout, not external contract.
_CONFIG_KEY_PREFERENCES = "preferences"
_CONFIG_KEY_MODEL_OVERRIDES = "model_overrides"


def _derive_project_name(prompt: Optional[str]) -> Optional[str]:
    """Auto-name from the first ~60 chars of the prompt when name is absent."""
    if not prompt:
        return None
    cleaned = " ".join(prompt.split())
    if len(cleaned) <= 60:
        return cleaned or None
    return cleaned[:57].rstrip() + "..."


def _extract_preferences(project: AiStudioProject) -> Optional[ProjectPreferences]:
    raw = (project.config or {}).get(_CONFIG_KEY_PREFERENCES)
    if not isinstance(raw, dict) or not raw:
        return None
    try:
        return ProjectPreferences.model_validate(raw)
    except Exception as e:  # pragma: no cover — config corruption is a bug
        logger.warning(f"Project {project.id} has malformed preferences in config: {e}")
        return None


def _extract_model_overrides(project: AiStudioProject) -> Optional[ModelOverrides]:
    raw = (project.config or {}).get(_CONFIG_KEY_MODEL_OVERRIDES)
    if not isinstance(raw, dict) or not raw:
        return None
    try:
        return ModelOverrides.model_validate(raw)
    except Exception as e:  # pragma: no cover
        logger.warning(f"Project {project.id} has malformed model_overrides: {e}")
        return None


def _build_summary(
    build: AiStudioBuild,
    published_build_id: Optional[str],
) -> BuildSummary:
    s3_urls = build.s3_urls or {}
    extra = build.extra_metadata or {}
    return BuildSummary(
        id=str(build.id),
        project_id=str(build.project_id),
        version=build.version,
        name=extra.get("name") if isinstance(extra.get("name"), str) else None,
        notes=extra.get("notes") if isinstance(extra.get("notes"), str) else None,
        status=build.status,  # type: ignore[arg-type]
        build_stage=build.build_stage,  # type: ignore[arg-type]
        progress=build.progress or 0,
        has_video=bool(s3_urls.get("video")),
        is_published=published_build_id is not None and str(build.id) == str(published_build_id),
        created_at=build.created_at.isoformat() if build.created_at else None,
        updated_at=build.updated_at.isoformat() if build.updated_at else None,
    )


def _project_summary(project: AiStudioProject, build_count: int) -> ProjectSummary:
    refs = project.source_asset_refs or []
    return ProjectSummary(
        id=str(project.id),
        institute_id=project.institute_id,
        name=project.name,
        status=project.status,  # type: ignore[arg-type]
        asset_count=len(refs) if isinstance(refs, list) else 0,
        build_count=build_count,
        published_build_id=str(project.published_build_id) if project.published_build_id else None,
        target_aspect=project.target_aspect,  # type: ignore[arg-type]
        target_duration_s=project.target_duration_s,
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None,
    )


def _project_response(
    project: AiStudioProject,
    builds: list[AiStudioBuild],
) -> ProjectResponse:
    refs_raw = project.source_asset_refs or []
    refs: list[AssetRef] = []
    if isinstance(refs_raw, list):
        for r in refs_raw:
            try:
                refs.append(AssetRef.model_validate(r))
            except Exception as e:
                logger.warning(f"Project {project.id} has malformed asset ref {r}: {e}")
    published_build_id = (
        str(project.published_build_id) if project.published_build_id else None
    )
    return ProjectResponse(
        id=str(project.id),
        institute_id=project.institute_id,
        name=project.name,
        source_asset_refs=refs,
        user_prompt=project.user_prompt,
        target_aspect=project.target_aspect,  # type: ignore[arg-type]
        target_duration_s=project.target_duration_s,
        preferences=_extract_preferences(project),
        model_overrides=_extract_model_overrides(project),
        confirmed_plan=project.confirmed_plan or {},
        published_build_id=published_build_id,
        builds=[_build_summary(b, published_build_id) for b in builds],
        status=project.status,  # type: ignore[arg-type]
        config=project.config or {},
        extra_metadata=project.extra_metadata or {},
        error_message=project.error_message,
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None,
        archived_at=project.archived_at.isoformat() if project.archived_at else None,
    )


def _serialize_config(
    preferences: Optional[ProjectPreferences],
    model_overrides: Optional[ModelOverrides],
    base: Optional[dict] = None,
) -> dict:
    """Merge preferences + model_overrides into a config dict.

    Existing keys in `base` are preserved unless overwritten by the args.
    None args do NOT clear existing keys (consistent with our "None = skip"
    update semantic — see Known Limitations in AI_VIDEO_STUDIO.md).
    """
    out = dict(base or {})
    if preferences is not None:
        out[_CONFIG_KEY_PREFERENCES] = preferences.model_dump(exclude_none=False)
    if model_overrides is not None:
        out[_CONFIG_KEY_MODEL_OVERRIDES] = model_overrides.model_dump(exclude_none=True)
    return out


def _parse_stored_refs(project: AiStudioProject) -> list[AssetRef]:
    """Parse the project's stored source_asset_refs JSONB into AssetRef models.
    Malformed entries are skipped (logged)."""
    refs: list[AssetRef] = []
    for r in project.source_asset_refs or []:
        try:
            refs.append(AssetRef.model_validate(r))
        except Exception as e:
            logger.warning(f"Project {project.id} malformed asset ref {r}: {e}")
    return refs


async def _plan_inputs(
    project: AiStudioProject,
    institute_id: str,
    step: str,
) -> tuple[list[dict], dict]:
    """Validate assets + build (manifest, detect_ctx) for a wizard step.

    Raises 400 if no asset survives validation. The detect_ctx carries the
    raw video contexts + the kept arrangement segments + cut thresholds, which
    the deterministic cut detectors consume (harmless/unused for LLM-only
    steps like arrangement).
    """
    refs = _parse_stored_refs(project)
    validation = validate_asset_refs(refs, institute_id)
    if not validation.assets:
        raise HTTPException(status_code=400, detail={
            "error": "no_valid_assets",
            "message": "None of this project's source assets are usable anymore.",
            "failures": failures_to_http_detail(validation.failures)["failures"],
        })
    manifest, raw_contexts = await build_asset_manifest_with_raw(refs, validation.by_handle)

    preferences = (project.config or {}).get(_CONFIG_KEY_PREFERENCES)
    detect_ctx = {
        "raw_contexts": raw_contexts,
        "segments": studio_cut_detectors.arrangement_segments(
            _prior_confirmed_steps(project, step)
        ),
        "min_silence_s": studio_cut_detectors.min_silence_for(preferences),
        "fillers_aggressive": studio_cut_detectors.fillers_aggressive(preferences),
    }
    return manifest, detect_ctx


def _load_project_or_404(
    repo: AiStudioProjectRepository,
    project_id: str,
    institute_id: str,
) -> AiStudioProject:
    """Fetch a project, asserting institute scope. Raises 404 otherwise.

    A wrong-institute lookup intentionally returns 404 (not 403) to avoid
    leaking the fact that a project with that id exists for another tenant.

    A malformed (non-UUID) project_id also returns 404 rather than letting
    session.get() raise a DB DataError → 500.
    """
    from uuid import UUID
    try:
        UUID(project_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail={
            "error": "project_not_found",
            "project_id": project_id,
        })
    project = repo.get_by_id(project_id)
    if project is None or project.institute_id != institute_id:
        raise HTTPException(status_code=404, detail={
            "error": "project_not_found",
            "project_id": project_id,
        })
    return project


# ---------------------------------------------------------------------------
# Projects — CRUD (P1: wired)
# ---------------------------------------------------------------------------

@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: CreateProjectRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> ProjectResponse:
    """Create a new Studio project.

    Server-side flow:
      1. Validate every asset_id belongs to the institute + status=COMPLETED
         + kind matches. Per-asset failures surface in `detail.failures[]`.
      2. Auto-derive `name` from `user_prompt` if not provided.
      3. Persist `preferences` + `model_overrides` inside the `config` JSONB
         (server-internal storage layout — see _CONFIG_KEY_* constants).
      4. Return the full ProjectResponse with empty builds list.
    """
    validation = validate_asset_refs(body.source_asset_refs, institute_id)
    if not validation.ok:
        raise HTTPException(status_code=400, detail=failures_to_http_detail(validation.failures))

    repo = AiStudioProjectRepository()
    project = repo.create(
        institute_id=institute_id,
        name=body.name or _derive_project_name(body.user_prompt),
        source_asset_refs=[r.model_dump(exclude_none=True) for r in body.source_asset_refs],
        user_prompt=body.user_prompt,
        target_aspect=body.target_aspect,
        target_duration_s=body.target_duration_s,
        config=_serialize_config(body.preferences, body.model_overrides),
    )
    return _project_response(project, builds=[])


@router.get("/projects", response_model=list[ProjectSummary])
async def list_projects(
    institute_id: str = Depends(get_institute_from_api_key),
    limit: int = Query(50, ge=1, le=200, description="Max projects to return."),
    offset: int = Query(0, ge=0, description="Pagination offset."),
    status: Optional[str] = Query(None, description="Filter by ProjectStatus (DRAFT, PLANNING, ...)."),
    include_archived: bool = Query(False, description="Include ARCHIVED projects in the result."),
) -> list[ProjectSummary]:
    """Paginated project list for the calling institute.

    `build_count` per row requires a per-project query — done in a single
    pass with the build repo. For institutes with thousands of projects this
    becomes a hotspot worth a JOIN/aggregation later; acceptable for P1.
    """
    repo = AiStudioProjectRepository()
    build_repo = AiStudioBuildRepository()
    projects = repo.list_by_institute(
        institute_id=institute_id,
        include_archived=include_archived,
        status=status,
        limit=limit,
        offset=offset,
    )
    summaries: list[ProjectSummary] = []
    for p in projects:
        builds = build_repo.list_by_project(str(p.id))
        summaries.append(_project_summary(p, build_count=len(builds)))
    return summaries


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
) -> ProjectResponse:
    repo = AiStudioProjectRepository()
    project = _load_project_or_404(repo, project_id, institute_id)
    builds = AiStudioBuildRepository().list_by_project(str(project.id))
    return _project_response(project, builds)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    body: UpdateProjectRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> ProjectResponse:
    """Partial update.

    None means leave-alone per the reels precedent; see Known Limitations
    in AI_VIDEO_STUDIO.md §9 for the documented workaround.

    When `source_asset_refs` is provided, it's re-validated end-to-end.
    """
    repo = AiStudioProjectRepository()
    project = _load_project_or_404(repo, project_id, institute_id)

    if body.source_asset_refs is not None:
        validation = validate_asset_refs(body.source_asset_refs, institute_id)
        if not validation.ok:
            raise HTTPException(
                status_code=400,
                detail=failures_to_http_detail(validation.failures),
            )

    # Merge new preferences/overrides into the existing config JSONB. The
    # repo's update_fields takes a full replacement for `config`, so we
    # rebuild it here from project.config + the deltas.
    new_config: Optional[dict] = None
    if body.preferences is not None or body.model_overrides is not None:
        new_config = _serialize_config(
            body.preferences, body.model_overrides, base=project.config or {}
        )

    repo.update_fields(
        project_id=project_id,
        name=body.name,
        source_asset_refs=(
            [r.model_dump(exclude_none=True) for r in body.source_asset_refs]
            if body.source_asset_refs is not None
            else None
        ),
        user_prompt=body.user_prompt,
        target_aspect=body.target_aspect,
        target_duration_s=body.target_duration_s,
        config=new_config,
    )
    # Re-fetch so the response reflects the persisted state (including
    # auto-touched updated_at).
    project = _load_project_or_404(repo, project_id, institute_id)
    builds = AiStudioBuildRepository().list_by_project(str(project.id))
    return _project_response(project, builds)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
) -> Response:
    """Soft delete (status → ARCHIVED). Builds stay intact and queryable
    by id; they just don't surface in the default project list.
    """
    repo = AiStudioProjectRepository()
    _load_project_or_404(repo, project_id, institute_id)
    repo.archive(project_id)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Wizard — per-step plan / confirm / refine (P2+)
# ---------------------------------------------------------------------------

def _extract_model_overrides_dict(project: AiStudioProject) -> dict:
    """Raw model_overrides dict from config (for resolve_step_model). Empty
    dict when absent — resolve_step_model handles that."""
    raw = (project.config or {}).get(_CONFIG_KEY_MODEL_OVERRIDES)
    return raw if isinstance(raw, dict) else {}


def _tier_of(project: AiStudioProject) -> str:
    tier = (project.config or {}).get("tier")
    return tier if isinstance(tier, str) and tier else "free"


def _prior_confirmed_steps(project: AiStudioProject, step: WizardStep) -> dict:
    """Confirmed step plans BEFORE `step` in wizard order — context for the LLM."""
    order = ["arrangement", "cuts", "overlays", "audio"]
    plan = project.confirmed_plan or {}
    out = {}
    for s in order:
        if s == step:
            break
        if s in plan:
            out[s] = plan[s]
    return out


def _result_to_step_plan(step: WizardStep, result) -> WizardStepPlan:
    from ..schemas.studio_projects import OperationSpec
    ops = []
    for op in result.operations:
        try:
            ops.append(OperationSpec.model_validate(op))
        except Exception as e:
            logger.warning(f"[studio] dropping un-serializable op {op}: {e}")
    return WizardStepPlan(step=step, operations=ops, notes=result.notes)


@router.post("/projects/{project_id}/wizard/{step}/plan", response_model=WizardStepPlan)
async def wizard_plan(
    project_id: str,
    step: WizardStep,
    body: WizardPlanRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> WizardStepPlan:
    """Run the LLM for one wizard step. Always returns a plan (falls back to a
    deterministic one if the LLM is unavailable)."""
    repo = AiStudioProjectRepository()
    project = _load_project_or_404(repo, project_id, institute_id)
    manifest, detect_ctx = await _plan_inputs(project, institute_id, step)

    model = resolve_step_model(_extract_model_overrides_dict(project), step)
    service = StudioPlanService()
    result = await service.plan_step(
        step=step,
        tier=_tier_of(project),
        user_prompt=project.user_prompt,
        manifest=manifest,
        preferences=(project.config or {}).get(_CONFIG_KEY_PREFERENCES),
        constraints={
            "target_aspect": project.target_aspect,
            "target_duration_s": project.target_duration_s,
        },
        prior_steps=_prior_confirmed_steps(project, step),
        extra_context=body.extra_context,
        tools_enabled=body.tools_enabled or None,
        tools_disabled=body.tools_disabled or None,
        model=model,
        detect_ctx=detect_ctx,
    )
    # Mark the project as in-planning (best-effort; doesn't block the response).
    if project.status == "DRAFT":
        repo.update_fields(project_id=project_id, status="PLANNING")
    return _result_to_step_plan(step, result)


@router.post("/projects/{project_id}/wizard/{step}/refine", response_model=WizardStepPlan)
async def wizard_refine(
    project_id: str,
    step: WizardStep,
    body: RefineStepRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> WizardStepPlan:
    """Re-run the step's LLM with the user's free-form refinement intent folded
    into the prompt context."""
    repo = AiStudioProjectRepository()
    project = _load_project_or_404(repo, project_id, institute_id)
    manifest, detect_ctx = await _plan_inputs(project, institute_id, step)

    model = resolve_step_model(_extract_model_overrides_dict(project), step)
    service = StudioPlanService()
    result = await service.plan_step(
        step=step,
        tier=_tier_of(project),
        user_prompt=project.user_prompt,
        manifest=manifest,
        preferences=(project.config or {}).get(_CONFIG_KEY_PREFERENCES),
        constraints={
            "target_aspect": project.target_aspect,
            "target_duration_s": project.target_duration_s,
        },
        prior_steps=_prior_confirmed_steps(project, step),
        extra_context=f"User refinement request: {body.refinement_prompt}",
        model=model,
        detect_ctx=detect_ctx,
    )
    return _result_to_step_plan(step, result)


@router.post("/projects/{project_id}/wizard/{step}/confirm", response_model=ProjectResponse)
async def wizard_confirm(
    project_id: str,
    step: WizardStep,
    body: ConfirmStepRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> ProjectResponse:
    """Persist the user's confirmed plan for one step into
    project.confirmed_plan[step]. The step value in the path must match the body."""
    if body.confirmed.step != step:
        raise HTTPException(status_code=400, detail={
            "error": "step_mismatch",
            "message": f"path step '{step}' != body step '{body.confirmed.step}'",
        })
    repo = AiStudioProjectRepository()
    project = _load_project_or_404(repo, project_id, institute_id)
    repo.patch_confirmed_step(
        project_id=project_id,
        step=step,
        step_plan=body.confirmed.model_dump(exclude_none=True),
    )
    # Advancing the wizard marks the project as planning-in-progress.
    if project.status in ("DRAFT", "PLANNING"):
        repo.update_fields(project_id=project_id, status="PLANNING")
    project = _load_project_or_404(repo, project_id, institute_id)
    builds = AiStudioBuildRepository().list_by_project(str(project.id))
    return _project_response(project, builds)


# ---------------------------------------------------------------------------
# Builds — fork / list / detail / publish / delete (P4)
# ---------------------------------------------------------------------------

def _build_response(build: AiStudioBuild, published_build_id: Optional[str]) -> BuildResponse:
    extra = build.extra_metadata or {}
    return BuildResponse(
        id=str(build.id),
        project_id=str(build.project_id),
        version=build.version,
        name=extra.get("name") if isinstance(extra.get("name"), str) else None,
        notes=extra.get("notes") if isinstance(extra.get("notes"), str) else None,
        plan_snapshot=build.plan_snapshot or {},
        status=build.status,  # type: ignore[arg-type]
        build_stage=build.build_stage,  # type: ignore[arg-type]
        progress=build.progress or 0,
        stages=build.stages or [],
        s3_urls=build.s3_urls or {},
        config=build.config or {},
        extra_metadata=extra,
        error_message=build.error_message,
        is_published=published_build_id is not None and str(build.id) == str(published_build_id),
        created_at=build.created_at.isoformat() if build.created_at else None,
        updated_at=build.updated_at.isoformat() if build.updated_at else None,
        completed_at=build.completed_at.isoformat() if build.completed_at else None,
    )


def _load_build_or_404(
    build_repo: AiStudioBuildRepository,
    proj_repo: AiStudioProjectRepository,
    build_id: str,
    institute_id: str,
) -> tuple[AiStudioBuild, AiStudioProject]:
    """Load a build + its project, asserting institute scope (via the parent
    project). Malformed/foreign ids → 404 (no cross-tenant leak)."""
    from uuid import UUID
    try:
        UUID(build_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail={"error": "build_not_found", "build_id": build_id})
    build = build_repo.get_by_id(build_id)
    if build is None:
        raise HTTPException(status_code=404, detail={"error": "build_not_found", "build_id": build_id})
    project = proj_repo.get_by_id(str(build.project_id))
    if project is None or project.institute_id != institute_id:
        raise HTTPException(status_code=404, detail={"error": "build_not_found", "build_id": build_id})
    return build, project


def _render_config_hash(plan_snapshot: dict, aspect: Optional[str], fps: Optional[int]) -> str:
    """Stable hash of (plan + render knobs) for in-flight build dedup."""
    blob = json.dumps(
        {"plan": plan_snapshot, "aspect": aspect, "fps": fps},
        sort_keys=True, ensure_ascii=False,
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


@router.post("/projects/{project_id}/builds", response_model=BuildResponse, status_code=202)
async def create_build(
    project_id: str,
    body: CreateBuildRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> BuildResponse:
    """Fork a new Build vN from the project's confirmed plan (or a prior
    build's snapshot via from_build_id) and dispatch the async executor.

    Requires a confirmed arrangement — you can't build over nothing. Resolves
    each asset's source URL + kind. Dedups in-flight double-clicks via the
    plan/config hash."""
    repo = AiStudioProjectRepository()
    build_repo = AiStudioBuildRepository()
    project = _load_project_or_404(repo, project_id, institute_id)

    # Pick the plan snapshot: a prior build's frozen plan, or the project's
    # current confirmed plan.
    if body.from_build_id:
        src_build, _ = _load_build_or_404(build_repo, repo, body.from_build_id, institute_id)
        if str(src_build.project_id) != str(project.id):
            raise HTTPException(status_code=400, detail={
                "error": "build_project_mismatch",
                "message": "from_build_id belongs to a different project.",
            })
        plan_snapshot = dict(src_build.plan_snapshot or {})
    else:
        plan_snapshot = dict(project.confirmed_plan or {})

    if "arrangement" not in plan_snapshot:
        raise HTTPException(status_code=400, detail={
            "error": "no_arrangement",
            "message": "Confirm the arrangement step before building.",
        })

    # Resolve source URLs + kinds for every asset.
    refs = _parse_stored_refs(project)
    validation = validate_asset_refs(refs, institute_id)
    if not validation.assets:
        raise HTTPException(status_code=400, detail={
            "error": "no_valid_assets",
            "message": "None of this project's source assets are usable anymore.",
            "failures": failures_to_http_detail(validation.failures)["failures"],
        })
    asset_kinds = {r.handle: r.kind for r in refs}
    source_urls = {
        h: row.source_url for h, row in validation.by_handle.items() if row.source_url
    }

    aspect = body.aspect or project.target_aspect
    fps = body.fps
    config = {
        "aspect": aspect,
        "fps": fps,
        "render_config_hash": _render_config_hash(plan_snapshot, aspect, fps),
    }

    # Dedup an in-flight build with the identical plan+config.
    existing = build_repo.find_active_for_plan(str(project.id), config["render_config_hash"])
    if existing is not None:
        return _build_response(existing, str(project.published_build_id) if project.published_build_id else None)

    extra_metadata = {}
    if body.name:
        extra_metadata["name"] = body.name
    if body.notes:
        extra_metadata["notes"] = body.notes

    build = build_repo.create(
        project_id=str(project.id),
        plan_snapshot=plan_snapshot,
        config=config,
        extra_metadata=extra_metadata,
    )

    # Flip the project to BUILDING (best-effort) and dispatch the executor.
    repo.update_fields(project_id=str(project.id), status="BUILDING")
    dispatch_build(BuildContext(
        build_id=str(build.id),
        project_id=str(project.id),
        institute_id=institute_id,
        version=build.version,
        plan_snapshot=plan_snapshot,
        asset_kinds=asset_kinds,
        source_urls=source_urls,
        aspect=aspect,
        fps=fps,
    ))
    return _build_response(build, None)


@router.get("/projects/{project_id}/builds", response_model=list[BuildSummary])
async def list_builds(
    project_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
    limit: int = Query(50, ge=1, le=200, description="Max builds to return."),
    offset: int = Query(0, ge=0, description="Pagination offset."),
    status: Optional[str] = Query(None, description="Filter by BuildStatus."),
    include_archived: bool = Query(False, description="Include soft-deleted builds."),
) -> list[BuildSummary]:
    repo = AiStudioProjectRepository()
    project = _load_project_or_404(repo, project_id, institute_id)
    published = str(project.published_build_id) if project.published_build_id else None
    builds = AiStudioBuildRepository().list_by_project(
        str(project.id), include_archived=include_archived
    )
    if status:
        builds = [b for b in builds if b.status == status]
    builds = builds[offset : offset + limit]
    return [_build_summary(b, published) for b in builds]


@router.get("/builds/{build_id}", response_model=BuildResponse)
async def get_build(
    build_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
) -> BuildResponse:
    build_repo = AiStudioBuildRepository()
    repo = AiStudioProjectRepository()
    build, project = _load_build_or_404(build_repo, repo, build_id, institute_id)
    return _build_response(build, str(project.published_build_id) if project.published_build_id else None)


@router.get("/builds/{build_id}/status", response_model=BuildStatusResponse)
async def get_build_status(
    build_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
) -> BuildStatusResponse:
    build_repo = AiStudioBuildRepository()
    repo = AiStudioProjectRepository()
    build, _ = _load_build_or_404(build_repo, repo, build_id, institute_id)
    return BuildStatusResponse(
        id=str(build.id),
        project_id=str(build.project_id),
        version=build.version,
        status=build.status,  # type: ignore[arg-type]
        build_stage=build.build_stage,  # type: ignore[arg-type]
        progress=build.progress or 0,
        error_message=build.error_message,
        live=(build.extra_metadata or {}).get("live"),
    )


@router.post("/builds/{build_id}/publish", response_model=ProjectResponse)
async def publish_build(
    build_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
) -> ProjectResponse:
    """Mark this build as the project's published one. Only a built (non-PENDING/
    non-FAILED) build can be published."""
    build_repo = AiStudioBuildRepository()
    repo = AiStudioProjectRepository()
    build, project = _load_build_or_404(build_repo, repo, build_id, institute_id)
    if build.status in ("PENDING", "BUILDING", "FAILED"):
        raise HTTPException(status_code=400, detail={
            "error": "build_not_publishable",
            "message": f"Build is {build.status}; only a completed build can be published.",
        })
    repo.update_fields(
        project_id=str(project.id),
        published_build_id=str(build.id),
        status="PUBLISHED",
    )
    project = _load_project_or_404(repo, str(project.id), institute_id)
    builds = build_repo.list_by_project(str(project.id))
    return _project_response(project, builds)


@router.delete("/builds/{build_id}", status_code=204)
async def delete_build(
    build_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
) -> Response:
    """Soft-delete a build. Refuses (409) if it's the project's published
    build unless the caller has already cleared the publish pointer."""
    build_repo = AiStudioBuildRepository()
    repo = AiStudioProjectRepository()
    build, project = _load_build_or_404(build_repo, repo, build_id, institute_id)
    if project.published_build_id and str(project.published_build_id) == str(build.id):
        raise HTTPException(status_code=409, detail={
            "error": "build_is_published",
            "message": "This build is the project's published one. Publish another build first.",
        })
    build_repo.archive(build_id)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Editor — /frame/* per build (P5)
# ---------------------------------------------------------------------------

def _frame_error_to_http(e: Exception) -> HTTPException:
    """Map frame-service errors to HTTP. Not-found/no-timeline → 4xx, not 500."""
    from ..services.studio_frame_service import StudioBuildNotFound, StudioTimelineNotFound
    if isinstance(e, StudioBuildNotFound):
        return HTTPException(status_code=404, detail={"error": "build_not_found", "message": str(e)})
    if isinstance(e, StudioTimelineNotFound):
        return HTTPException(status_code=409, detail={"error": "timeline_not_ready", "message": str(e)})
    if isinstance(e, (ValueError, IndexError)):
        return HTTPException(status_code=400, detail={"error": "frame_op_failed", "message": str(e)})
    raise e


@router.post("/builds/{build_id}/frame/add", response_model=FrameResponse)
async def add_frame(
    build_id: str,
    body: AddStudioFrameRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> FrameResponse:
    from ..services.studio_frame_service import StudioFrameService
    try:
        result = await asyncio.to_thread(
            StudioFrameService().add_frame,
            build_id, institute_id,
            html=body.html, in_time=body.in_time, exit_time=body.exit_time,
            z=body.z or 0, entry_id=body.entry_id,
            insert_after_entry_id=body.insert_after_entry_id,
            html_start_x=body.html_start_x, html_start_y=body.html_start_y,
            html_end_x=body.html_end_x, html_end_y=body.html_end_y,
            entry_meta=body.entry_meta,
        )
    except Exception as e:
        raise _frame_error_to_http(e)
    return FrameResponse(**result)


@router.post("/builds/{build_id}/frame/update", response_model=FrameResponse)
async def update_frame(
    build_id: str,
    body: UpdateStudioFrameRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> FrameResponse:
    from ..services.studio_frame_service import StudioFrameService
    try:
        result = await asyncio.to_thread(
            StudioFrameService().update_frame,
            build_id, institute_id,
            entry_id=body.entry_id, frame_index=body.frame_index,
            html=body.resolved_html, in_time=body.in_time, exit_time=body.exit_time,
            z=body.z, entry_meta=body.entry_meta,
        )
    except Exception as e:
        raise _frame_error_to_http(e)
    return FrameResponse(**result)


@router.post("/builds/{build_id}/frame/delete", response_model=FrameResponse)
async def delete_frame(
    build_id: str,
    body: DeleteStudioFrameRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> FrameResponse:
    from ..services.studio_frame_service import StudioFrameService
    try:
        result = await asyncio.to_thread(
            StudioFrameService().delete_frame,
            build_id, institute_id,
            entry_id=body.entry_id, frame_index=body.frame_index,
        )
    except Exception as e:
        raise _frame_error_to_http(e)
    return FrameResponse(**result)


@router.post("/builds/{build_id}/frame/reorder", response_model=FrameResponse)
async def reorder_frame(
    build_id: str,
    body: ReorderStudioFrameRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> FrameResponse:
    from ..services.studio_frame_service import StudioFrameService
    try:
        result = await asyncio.to_thread(
            StudioFrameService().reorder_frame,
            build_id, institute_id,
            entry_id=body.entry_id, to_index=body.to_index,
        )
    except Exception as e:
        raise _frame_error_to_http(e)
    return FrameResponse(**result)


# ---------------------------------------------------------------------------
# Render — per build (P5)
# ---------------------------------------------------------------------------

@router.post("/builds/{build_id}/render", response_model=StudioRenderResponse, status_code=202)
async def render_build(
    build_id: str,
    body: StudioRenderRequest,
    institute_id: str = Depends(get_institute_from_api_key),
) -> StudioRenderResponse:
    """Render the (possibly editor-modified) build timeline to MP4 via the
    render worker. Submits + polls in a background task (mirrors reels). The
    build's audio is the source clips' intrinsic audio (browser-captured); a
    silent master narration is generated to satisfy the worker's required
    audio_url. Returns the worker job_id immediately."""
    from ..services.studio_render_service import submit_studio_render
    build_repo = AiStudioBuildRepository()
    repo = AiStudioProjectRepository()
    build, _ = _load_build_or_404(build_repo, repo, build_id, institute_id)
    if build.status not in ("AWAITING_EDIT", "RENDERED"):
        raise HTTPException(status_code=409, detail={
            "error": "build_not_renderable",
            "message": f"Build is {build.status}; render after it reaches AWAITING_EDIT.",
        })
    try:
        job_id = await submit_studio_render(build, body)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail={"error": "render_unavailable", "message": str(e)})
    return StudioRenderResponse(job_id=job_id, status="submitted")
