"""
WebSocket router for full-duplex voice conversations.

Uses Sarvam AI REST APIs for STT/TTS (will be upgraded to WebSocket streaming later).
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..db import get_sessionmaker
from ..repositories.chat_session_repository import ChatSessionRepository
from ..services.sarvam_service import SarvamService
from ..services.ai_chat_agent_service import AiChatAgentService
from ..services.context_resolver_service import ContextResolverService
from ..services.tool_manager_service import ToolManagerService
from ..services.chat_llm_client import ChatLLMClient
from ..services.api_key_resolver import ApiKeyResolver
from ..services.institute_settings_service import InstituteSettingsService
from ..services.embedding_service import EmbeddingService
from ..services.rag_service import RAGService
from ..services.learning_analytics_service import LearningAnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat-agent", tags=["voice-agent"])

# Audio chunk size for TTS streaming to client (~32 KB)
TTS_CHUNK_SIZE = 32 * 1024


def _build_chat_agent_service(db_session) -> AiChatAgentService:
    """Build an AiChatAgentService instance manually (no FastAPI Depends)."""
    context_resolver = ContextResolverService(db_session)
    institute_settings = InstituteSettingsService(db_session)
    api_key_resolver = ApiKeyResolver(db_session)
    llm_client = ChatLLMClient(api_key_resolver)
    embedding_service = EmbeddingService(api_key_resolver)
    rag_service = RAGService(db_session, embedding_service)
    analytics_service = LearningAnalyticsService(db_session)
    tool_manager = ToolManagerService(db_session, rag_service=rag_service, analytics_service=analytics_service)

    return AiChatAgentService(
        db_session=db_session,
        context_resolver=context_resolver,
        tool_manager=tool_manager,
        llm_client=llm_client,
        institute_settings=institute_settings,
        rag_service=rag_service,
    )


@router.websocket("/session/{session_id}/voice")
async def voice_session(websocket: WebSocket, session_id: str):
    """
    Full-duplex voice conversation WebSocket.

    Client -> Server messages:
      { "type": "config", "language": "en-IN", "voice": "shubh" }  -- initial config
      { "type": "audio_chunk", "data": "<base64 audio>" }          -- streaming mic audio
      { "type": "audio_end" }                                       -- student finished speaking
      { "type": "end_session" }                                     -- end voice session

    Server -> Client messages:
      { "type": "ready" }                                           -- connection ready
      { "type": "transcript_partial", "text": "..." }              -- real-time STT partial
      { "type": "transcript_final", "text": "..." }                -- final transcript
      { "type": "ai_text", "text": "...", "message_id": N }        -- LLM response text
      { "type": "audio_chunk", "data": "<base64 audio>" }          -- streaming TTS audio
      { "type": "audio_end" }                                       -- TTS finished
      { "type": "summary", "data": { ... } }                       -- session-end scorecard
      { "type": "error", "message": "..." }                         -- error
    """
    await websocket.accept()

    # Create a DB session manually (WebSocket doesn't support FastAPI Depends)
    session_factory = get_sessionmaker()
    db = session_factory()

    try:
        # 1. Verify session exists
        session_repo = ChatSessionRepository(db)
        chat_session = session_repo.get_session_by_id(session_id)
        if not chat_session:
            await websocket.send_json({"type": "error", "message": f"Session {session_id} not found"})
            await websocket.close(code=4004)
            return

        user_id = chat_session.user_id
        institute_id = chat_session.institute_id

        # 2. Create services
        sarvam_service = SarvamService()
        chat_agent_service = _build_chat_agent_service(db)

        # 3. Voice config defaults
        language: str = "en-IN"
        voice: str = "shubh"

        # Audio buffer for accumulating chunks
        audio_buffer: bytearray = bytearray()

        # 4. Send ready signal
        await websocket.send_json({"type": "ready"})
        logger.info(f"Voice session ready for session_id={session_id}, user_id={user_id}")

        # 5. Main loop
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            elif msg_type == "config":
                language = msg.get("language", language)
                voice = msg.get("voice", voice)
                logger.info(f"Voice config updated: language={language}, voice={voice}")

            elif msg_type == "audio_chunk":
                # Accumulate base64-decoded audio bytes
                data_b64 = msg.get("data", "")
                if data_b64:
                    try:
                        audio_buffer.extend(base64.b64decode(data_b64))
                    except Exception:
                        await websocket.send_json({"type": "error", "message": "Invalid base64 audio data"})

            elif msg_type == "audio_end":
                if not audio_buffer:
                    await websocket.send_json({"type": "error", "message": "No audio data received"})
                    continue

                try:
                    # a) Speech-to-Text
                    transcript = await sarvam_service.speech_to_text(
                        audio_bytes=bytes(audio_buffer),
                        language=language,
                    )

                    # b) Send final transcript
                    await websocket.send_json({"type": "transcript_final", "text": transcript})

                    if not transcript.strip():
                        audio_buffer.clear()
                        continue

                    # c) Process through the chat agent (reuse send_message)
                    message_id, ai_status = await chat_agent_service.send_message(
                        session_id=session_id,
                        message=transcript,
                    )

                    # d) Retrieve the AI response text
                    # The agent service processes asynchronously and stores messages.
                    # For voice, we need the response text directly. Poll for the
                    # assistant message that was just created.
                    updates = await chat_agent_service.get_updates(
                        session_id=session_id,
                        last_message_id=message_id,
                    )
                    ai_text = ""
                    ai_msg_id: Optional[int] = None
                    for m in updates.get("messages", []):
                        if m.message_type == "assistant":
                            ai_text = m.content
                            ai_msg_id = m.id
                            break

                    # e) Send AI text to client
                    await websocket.send_json({
                        "type": "ai_text",
                        "text": ai_text,
                        "message_id": ai_msg_id,
                    })

                    # f) Text-to-Speech
                    if ai_text.strip():
                        tts_audio = await sarvam_service.text_to_speech(
                            text=ai_text,
                            language=language,
                            voice=voice,
                        )

                        if tts_audio:
                            # g) Split audio into chunks and send
                            for i in range(0, len(tts_audio), TTS_CHUNK_SIZE):
                                chunk = tts_audio[i : i + TTS_CHUNK_SIZE]
                                await websocket.send_json({
                                    "type": "audio_chunk",
                                    "data": base64.b64encode(chunk).decode("ascii"),
                                })

                        # h) Signal TTS complete
                        await websocket.send_json({"type": "audio_end"})

                except Exception as e:
                    logger.exception(f"Error processing voice turn for session {session_id}")
                    await websocket.send_json({"type": "error", "message": str(e)})
                finally:
                    # i) Clear audio buffer for next turn
                    audio_buffer.clear()

            elif msg_type == "end_session":
                try:
                    # Close the session and return summary
                    success, message_count = await chat_agent_service.close_session(session_id)
                    await websocket.send_json({
                        "type": "summary",
                        "data": {
                            "session_id": session_id,
                            "message_count": message_count,
                            "status": "CLOSED",
                        },
                    })
                except Exception as e:
                    logger.exception(f"Error ending voice session {session_id}")
                    await websocket.send_json({"type": "error", "message": str(e)})
                break

            else:
                await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info(f"Voice WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.exception(f"Voice session error for session {session_id}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            db.close()
        except Exception:
            pass


__all__ = ["router"]
