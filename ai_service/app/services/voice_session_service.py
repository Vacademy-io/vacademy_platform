"""
Voice session service — orchestrates voice conversation turns (STT transcript -> LLM -> TTS text).
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session

from ..repositories.chat_session_repository import ChatSessionRepository
from ..repositories.chat_message_repository import ChatMessageRepository
from ..services.context_resolver_service import ContextResolverService
from ..services.chat_llm_client import ChatLLMClient
from ..services.institute_settings_service import InstituteSettingsService
from ..services.token_usage_service import TokenUsageService
from ..models.ai_token_usage import ApiProvider, RequestType

logger = logging.getLogger(__name__)


class VoiceSessionService:
    """
    Orchestrates voice conversation turns.
    Takes a transcript from STT, processes it with the LLM, and returns the AI response text.
    """

    def __init__(
        self,
        db_session: Session,
        llm_client: ChatLLMClient,
        institute_settings: InstituteSettingsService,
        context_resolver: ContextResolverService,
    ):
        self.db = db_session
        self.llm_client = llm_client
        self.institute_settings = institute_settings
        self.context_resolver = context_resolver
        self.session_repo = ChatSessionRepository(db_session)
        self.message_repo = ChatMessageRepository(db_session)

    def record_voice_media_usage(
        self,
        kind: str,
        institute_id: str,
        user_id: str,
        session_id: str,
        language: str,
        characters: int,
        detail: Optional[str] = None,
        provider: str = "sarvam",
    ) -> None:
        """
        Attribute Sarvam STT/TTS spend to the institute that caused it.

        Voice used to be the one AI surface that cost real money per turn and
        left no usage row behind. Provider stays "google_tts" — that is the
        value the api_provider CHECK constraint allows for premium TTS, and
        tts_provider carries the real vendor (see V225).
        """
        try:
            TokenUsageService(self.db).record_usage(
                api_provider=ApiProvider.GOOGLE_TTS,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                request_type=RequestType.TTS_PREMIUM if kind == "tts" else RequestType.TRANSCRIPTION,
                institute_id=institute_id,
                user_id=user_id,
                model=(
                    {"sarvam": "sarvam:bulbul-v3", "google": "google:chirp3-hd", "edge": "edge:neural"}.get(
                        provider, provider
                    )
                    if kind == "tts"
                    else "sarvam:saaras-v3"
                ),
                request_id=session_id,
                tts_provider=provider if kind == "tts" else "sarvam",
                character_count=max(characters, 0),
                metadata={"surface": "voice_call", "language": language, "detail": detail},
            )
        except Exception:
            # Metering must never take a call down.
            logger.exception(f"Failed to record voice usage for session {session_id}")

    async def _prepare_turn(
        self,
        session_id: str,
        user_id: str,
        institute_id: str,
    ) -> tuple:
        """Resolve everything a turn needs: (session_mode, system_prompt, temperature)."""
        session = self.session_repo.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        session_mode = getattr(session, "session_mode", "text") or "text"
        context = await self.context_resolver.resolve_context(
            context_type=session.context_type or "general",
            context_meta=session.context_meta or {},
            user_id=user_id,
            institute_id=institute_id,
        )
        ai_settings = self.institute_settings.get_ai_settings(institute_id)
        system_prompt = self._build_voice_system_prompt(
            mode=session_mode,
            institute_rules=self.institute_settings.format_rules_for_prompt(ai_settings),
            context=context,
            user_id=user_id,
            institute_id=institute_id,
        )
        return session_mode, system_prompt, self.institute_settings.get_temperature(ai_settings)

    async def generate_opening_turn(
        self,
        session_id: str,
        user_id: str,
        institute_id: str,
        model: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Produce the line the agent speaks the moment the student joins the call,
        so nobody has to type or tap to get the conversation started.

        Returns None when the session already has conversation — a reconnect
        mid-call must not replay a greeting over the top of it.
        """
        if self.message_repo.get_conversation_history(session_id, limit=1):
            return None

        session_mode, system_prompt, temperature = await self._prepare_turn(
            session_id, user_id, institute_id
        )

        if session_mode == "voice_interview":
            opening_instruction = (
                "The student has just joined the interview call. Greet them by name in one short "
                "sentence, say what the interview is about, then immediately ask your first question."
            )
        elif session_mode == "voice_oral_test":
            opening_instruction = (
                "The student has just joined the oral test call. Greet them by name in one short "
                "sentence, say what the test covers, then immediately ask your first question."
            )
        else:
            opening_instruction = (
                "The student has just joined the voice call. Greet them by name in one short "
                "sentence and ask what they would like help with. Keep it to two sentences."
            )

        llm_response = await self.llm_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"[SYSTEM] {opening_instruction}"},
            ],
            temperature=temperature,
            max_tokens=150,
            institute_id=institute_id,
            user_id=user_id,
            model=model,
        )

        ai_text = (llm_response.get("content") or "").strip()
        if not ai_text:
            return None

        # Only the spoken line is stored: the instruction above is scaffolding,
        # and keeping it in history would leak into later turns.
        assistant_message = self.message_repo.create_message(
            session_id=session_id,
            message_type="assistant",
            content=ai_text,
            metadata={
                "source": "voice_llm",
                "turn": "opening",
                "provider": llm_response.get("provider"),
                "model": llm_response.get("model"),
            },
        )
        self.session_repo.update_last_active(session_id)

        return {"ai_text": ai_text, "message_id": assistant_message.id}

    async def process_voice_turn(
        self,
        session_id: str,
        transcript: str,
        user_id: str,
        institute_id: str,
        model: Optional[str] = None,
    ) -> dict:
        """
        Process a single voice conversation turn.

        1. Save user message (transcript) to DB
        2. Get session to read session_mode and context
        3. Resolve context via context_resolver
        4. Build mode-specific system prompt
        5. Get conversation history (last 10 messages)
        6. Call LLM
        7. Save assistant message to DB
        8. Return { "ai_text": str, "message_id": int, "metadata": dict }
        """
        # 1. Save user transcript as a message
        user_message = self.message_repo.create_message(
            session_id=session_id,
            message_type="user",
            content=transcript,
            metadata={"source": "voice_stt"},
        )

        # 2-4. Session mode, resolved context and the mode-specific prompt
        _session_mode, system_prompt, temperature = await self._prepare_turn(
            session_id, user_id, institute_id
        )

        # 5. Conversation history (last 10 messages)
        history = self.message_repo.get_conversation_history(session_id, limit=10)
        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        for msg in history:
            role = "user" if msg.message_type == "user" else "assistant"
            messages.append({"role": role, "content": msg.content})

        # 6. Call LLM
        llm_response = await self.llm_client.chat_completion(
            messages=messages,
            temperature=temperature,
            max_tokens=300,  # short responses for voice
            institute_id=institute_id,
            user_id=user_id,
            model=model,  # platform "voice call model" when set; else the chatbot model
        )

        ai_text = llm_response.get("content", "")

        # 7. Save assistant message
        metadata = {
            "source": "voice_llm",
            "provider": llm_response.get("provider"),
            "model": llm_response.get("model"),
        }
        assistant_message = self.message_repo.create_message(
            session_id=session_id,
            message_type="assistant",
            content=ai_text,
            metadata=metadata,
        )

        # Update session last_active
        self.session_repo.update_last_active(session_id)

        # 8. Return result
        return {
            "ai_text": ai_text,
            "message_id": assistant_message.id,
            "metadata": metadata,
        }

    def _build_voice_system_prompt(
        self,
        mode: str,
        institute_rules: str,
        context: dict,
        user_id: str,
        institute_id: str,
    ) -> str:
        """
        Build system prompt specific to voice modes.
        Prompts instruct the LLM to keep responses SHORT (under 50 words) since they will be spoken aloud.
        """
        context_data = context.get("context_data", {})
        user_details = context.get("user_details", {})
        user_name = user_details.get("name", "Student")
        topic = context_data.get("voice_topic") or context_data.get("chapter") or context_data.get("name") or context_data.get("topic") or "the given subject"

        # Performance context snippet
        user_perf = context.get("user_performance", {})
        perf_snippet = ""
        if user_perf.get("strengths") or user_perf.get("weaknesses"):
            strengths = ", ".join(s["topic"] for s in user_perf.get("strengths", [])[:3])
            weaknesses = ", ".join(w["topic"] for w in user_perf.get("weaknesses", [])[:3])
            perf_snippet = f"\nStudent strengths: {strengths or 'N/A'}. Weaknesses: {weaknesses or 'N/A'}."

        base_voice_rule = (
            "CRITICAL: Keep every response under 50 words. You are speaking aloud — be concise, "
            "conversational, and natural. Do not use markdown, bullet points, or formatting."
        )

        if mode == "voice_interview":
            prompt = (
                f"You are conducting a mock interview with {user_name} on the topic: {topic}. "
                f"Ask one question at a time. Wait for the student's answer before proceeding. "
                f"Give brief feedback after each answer, then ask the next question. "
                f"Be encouraging but honest.{perf_snippet}\n\n"
                f"{base_voice_rule}\n\n{institute_rules}"
            )
        elif mode == "voice_doubt":
            prompt = (
                f"You are helping {user_name} discuss their doubt verbally about: {topic}. "
                f"Use Socratic questioning — guide the student to the answer rather than giving it directly. "
                f"Ask clarifying questions. Be patient and supportive.{perf_snippet}\n\n"
                f"{base_voice_rule}\n\n{institute_rules}"
            )
        elif mode == "voice_oral_test":
            prompt = (
                f"You are administering an oral test to {user_name} on: {topic}. "
                f"Ask one question at a time. After the student answers, clearly state whether it is "
                f"correct or incorrect and give the right answer if wrong. Then move to the next question. "
                f"Track the score internally.{perf_snippet}\n\n"
                f"{base_voice_rule}\n\n{institute_rules}"
            )
        else:
            # Fallback for text mode used over voice (general conversation)
            prompt = (
                f"You are a helpful voice tutor assisting {user_name}. "
                f"Topic context: {topic}.{perf_snippet}\n\n"
                f"{base_voice_rule}\n\n{institute_rules}"
            )

        return prompt

    async def generate_session_summary(
        self,
        session_id: str,
        mode: str,
        institute_id: str,
        user_id: str,
    ) -> dict:
        """
        Generate end-of-session scorecard.

        1. Fetch all messages for the session
        2. Build a summary prompt based on mode
        3. Call LLM to generate: { score, total_questions, strengths, areas_to_improve, feedback }
        4. Save summary as a special assistant message with metadata type="summary"
        5. Return the summary dict
        """
        # 1. Fetch all messages
        all_messages = self.message_repo.get_messages_by_session(session_id)
        if not all_messages:
            return {
                "score": 0,
                "total_questions": 0,
                "strengths": [],
                "areas_to_improve": [],
                "feedback": "No conversation data available to summarize.",
            }

        # Build conversation transcript for the LLM
        transcript_lines = []
        for msg in all_messages:
            role_label = "Student" if msg.message_type == "user" else "Tutor"
            transcript_lines.append(f"{role_label}: {msg.content}")
        transcript_text = "\n".join(transcript_lines)

        # 2. Build summary prompt based on mode
        if mode == "voice_interview":
            summary_instruction = (
                "You just conducted a mock interview. Analyze the conversation and produce a JSON scorecard."
            )
        elif mode == "voice_oral_test":
            summary_instruction = (
                "You just administered an oral test. Analyze the conversation and produce a JSON scorecard."
            )
        elif mode == "voice_doubt":
            summary_instruction = (
                "You just had a doubt-resolution session. Analyze how well the student understood the topic "
                "and produce a JSON scorecard."
            )
        else:
            summary_instruction = (
                "Analyze the following tutoring conversation and produce a JSON scorecard."
            )

        summary_prompt = (
            f"{summary_instruction}\n\n"
            f"Conversation transcript:\n{transcript_text}\n\n"
            f"Respond ONLY with valid JSON in this exact format:\n"
            f'{{"score": <number 0-100>, "total_questions": <number>, '
            f'"strengths": ["strength1", "strength2"], '
            f'"areas_to_improve": ["area1", "area2"], '
            f'"feedback": "Overall feedback paragraph"}}'
        )

        messages = [
            {"role": "system", "content": "You are an assessment evaluator. Respond only with valid JSON."},
            {"role": "user", "content": summary_prompt},
        ]

        # 3. Call LLM
        llm_response = await self.llm_client.chat_completion(
            messages=messages,
            temperature=0.2,
            max_tokens=800,
            institute_id=institute_id,
            user_id=user_id,
        )

        raw_content = llm_response.get("content", "{}")

        # Parse JSON from LLM response
        try:
            # Strip markdown code fences if present
            cleaned = raw_content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()
            summary = json.loads(cleaned)
        except (json.JSONDecodeError, ValueError):
            logger.warning(f"Failed to parse summary JSON for session {session_id}: {raw_content}")
            summary = {
                "score": 0,
                "total_questions": 0,
                "strengths": [],
                "areas_to_improve": [],
                "feedback": raw_content,
            }

        # Ensure all expected keys exist
        summary.setdefault("score", 0)
        summary.setdefault("total_questions", 0)
        summary.setdefault("strengths", [])
        summary.setdefault("areas_to_improve", [])
        summary.setdefault("feedback", "")

        # 4. Save summary as special assistant message
        self.message_repo.create_message(
            session_id=session_id,
            message_type="assistant",
            content=json.dumps(summary),
            metadata={"type": "summary", "mode": mode},
        )

        # 5. Return
        return summary


__all__ = ["VoiceSessionService"]
