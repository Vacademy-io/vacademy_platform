"""
Layer 3 — Assessment generation from a class-recording transcript.

Takes the English transcript of a lecture (admin_core_service fetches it from
S3 after Whisper transcription completes), uses Gemini 2.5 Flash to author a
concise title + N MCQ questions, and emits them in the original audio language
detected by Whisper (so a Hindi lecture yields Hindi questions even though the
transcript fed to the LLM is the English translation).

Model resolution: reuses the existing `agent` use case in `ai_model_defaults`
(google/gemini-2.5-flash) — no schema change required for v1.

Auth: same dual-auth shape as the transcription router (institute API key OR
internal service token), so admin_core_service can call it server-to-server.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..dependencies import get_institute_id_or_internal
from ..models.ai_token_usage import RequestType
from ..repositories.ai_api_keys_repository import AiApiKeysRepository  # noqa: F401  (kept for parity)
from ..services.ai_billing import preflight_tool_credits, record_tool_billing
from ..services.ai_models_service import AIModelsService
from ..services.api_key_resolver import ApiKeyResolver
from ..services.chat_llm_client import ChatLLMClient
from ..services.quiz_service import QuizService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assessment", tags=["assessment-generation"])

# Soft cap so a runaway client can't burn an entire LLM context on a single call.
MAX_NUM_QUESTIONS = 50

# Fallback if ai_model_defaults isn't populated for any reason.
FALLBACK_MODEL = "google/gemini-2.5-flash"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GenerateAssessmentRequest(BaseModel):
    transcript_text: str = Field(
        ...,
        description="The English transcript of the class recording. Pass the full "
                    "transcript — the underlying LLM has a 1M-token context.",
    )
    target_language: str = Field(
        default="en",
        description="ISO 639-1 code of the language to emit questions in. Use "
                    "Whisper's detected_language for the source recording. "
                    "Supported: en, hi, ta, te, bn, mr, gu, kn, ml, pa, or, as.",
    )
    num_questions: int = Field(
        default=20,
        ge=1,
        le=MAX_NUM_QUESTIONS,
        description=f"How many MCQs to generate (1-{MAX_NUM_QUESTIONS}).",
    )
    model: Optional[str] = Field(
        None,
        description="Optional explicit model override (e.g. 'google/gemini-2.5-pro'). "
                    "When None, resolves to the `agent` use case default in ai_model_defaults.",
    )
    institute_id: Optional[str] = Field(
        None,
        description="Required only when calling with X-Internal-Service-Token. "
                    "Ignored when using X-Institute-Key auth.",
    )
    include_images: bool = Field(
        default=False,
        description="When true, also generate a Gemini image illustration for "
                    "each question stem and each option, embedded as inline "
                    "<img> tags. Adds 30-120s of latency and substantial API "
                    "spend (~5 image calls per question), so off by default.",
    )
    user_id: Optional[str] = Field(
        None,
        description="Verified actor (teacher/admin) for credit attribution. "
                    "admin_core forwards CustomUserDetails.getId().",
    )
    idempotency_key: Optional[str] = Field(
        None,
        description="Dedup key for the credit charge so a retry (RestTemplate "
                    "timeout after success, double-click) can't double-charge. "
                    "admin_core sends 'assessment:{artifactId}'.",
    )


class AssessmentQuestion(BaseModel):
    id: str
    question: str
    options: list[str]
    correct_answer_index: int
    explanation: str


class GenerateAssessmentResponse(BaseModel):
    title: str
    questions: list[AssessmentQuestion]
    target_language: str
    model_used: str


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/generate-from-transcript", response_model=GenerateAssessmentResponse)
async def generate_from_transcript(
    request: GenerateAssessmentRequest,
    auth: tuple = Depends(get_institute_id_or_internal),
    db: Session = Depends(db_dependency),
):
    """Generate a title + MCQ questions from a lecture transcript.

    Returns generated content only — does NOT persist anywhere. Callers
    (typically admin_core_service) are responsible for storing the output.
    """
    resolved_institute_id, auth_mode = auth
    if auth_mode == "INTERNAL":
        if not request.institute_id:
            raise HTTPException(
                status_code=400,
                detail="institute_id is required in request body when using X-Internal-Service-Token",
            )
        institute_id = request.institute_id
    else:
        institute_id = resolved_institute_id

    if not request.transcript_text or not request.transcript_text.strip():
        raise HTTPException(status_code=400, detail="transcript_text must not be empty")

    # Pre-flight credit gate (academy-credits). Block before spending an LLM
    # call when the institute can't afford the parametric estimate.
    tool_params = {
        "num_questions": request.num_questions,
        "include_images": request.include_images,
    }
    estimate = preflight_tool_credits(
        db, tool_key="assessment", tool_params=tool_params, institute_id=institute_id
    )
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: this assessment needs ~{estimate['estimated_credits']} "
                f"credits but the balance is {estimate.get('current_balance')}."
            ),
        )

    # Resolve model: explicit override > `agent` use case default > hardcoded fallback.
    model = request.model
    if not model:
        try:
            resp = AIModelsService(db).get_models_for_use_case("agent")
            if resp and resp.default_model:
                model = resp.default_model.model_id
        except Exception as e:
            logger.warning(f"[assessment-gen] AIModelsService lookup failed, using fallback: {e}")
    if not model:
        model = FALLBACK_MODEL

    # Build a QuizService instance with a per-request DB-backed key resolver
    # so per-institute key/model overrides (from ai_api_keys table) apply.
    api_key_resolver = ApiKeyResolver(db)
    llm_client = ChatLLMClient(api_key_resolver)
    svc = QuizService(llm_client=llm_client)

    try:
        result = await svc.generate_assessment_from_transcript(
            transcript_text=request.transcript_text,
            target_language=request.target_language,
            num_questions=request.num_questions,
            institute_id=institute_id,
            user_id=request.user_id,
            model=model,
            include_images=request.include_images,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Charge credits: max(parametric estimate, actual token cost). Best-effort —
    # the assessment has already been generated, so billing must never 500.
    # Bill images on the count ACTUALLY delivered (not num_questions × toggle),
    # and dedup on the idempotency key so a retry can't double-charge.
    usage = result.get("usage") or {}
    billing_params = {
        "num_questions": request.num_questions,
        "image_count": int(result.get("images_generated") or 0),
    }
    record_tool_billing(
        tool_key="assessment",
        tool_params=billing_params,
        request_type=RequestType.ASSESSMENT,
        model=model,
        prompt_tokens=int(usage.get("prompt_tokens") or 0),
        completion_tokens=int(usage.get("completion_tokens") or 0),
        institute_id=institute_id,
        user_id=request.user_id,
        user_role="ADMIN" if request.user_id else None,
        idempotency_key=request.idempotency_key,
    )

    logger.info(
        f"[assessment-gen] [{institute_id}] generated {len(result['questions'])} "
        f"questions (lang={request.target_language}, model={model})"
    )
    return GenerateAssessmentResponse(
        title=result["title"],
        questions=[AssessmentQuestion(**q) for q in result["questions"]],
        target_language=request.target_language,
        model_used=model,
    )
