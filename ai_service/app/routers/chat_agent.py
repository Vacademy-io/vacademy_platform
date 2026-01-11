"""
API router for AI chat agent with SSE streaming support.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..schemas.chat_agent import (
    InitSessionRequest,
    SendMessageRequest,
    UpdateContextRequest,
    InitSessionResponse,
    SendMessageResponse,
    UpdateContextResponse,
    CloseSessionResponse,
    AIStatus,
)
from ..services.ai_chat_agent_service import AiChatAgentService
from ..dependencies import get_chat_agent_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat-agent", tags=["ai-chat-agent"])


@router.post(
    "/session/init",
    response_model=InitSessionResponse,
    summary="Initialize a new chat session",
    description="Creates a new chat session with context and optionally processes an initial message."
)
async def init_session(
    request: InitSessionRequest,
    service: AiChatAgentService = Depends(get_chat_agent_service),
) -> InitSessionResponse:
    """
    Initialize a new chat session with passive context.
    
    The session will be created immediately. If an initial_message is provided,
    it will be processed asynchronously. Otherwise, a personalized greeting is sent.
    """
    try:
        session_id, ai_status = await service.create_session(
            user_id=request.user_id,
            institute_id=request.institute_id,
            context_type=request.context_type.value if request.context_type else None,
            context_meta=request.context_meta,
            initial_message=request.initial_message,
            user_name=request.user_name,
        )
        
        return InitSessionResponse(
            session_id=session_id,
            status=AIStatus(ai_status),
        )
        
    except Exception as e:
        logger.error(f"Error initializing session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/session/{session_id}/message",
    response_model=SendMessageResponse,
    summary="Send a message to a chat session",
    description="Send a user message to an existing chat session. Processing happens asynchronously."
)
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    service: AiChatAgentService = Depends(get_chat_agent_service),
) -> SendMessageResponse:
    """
    Send a message to an existing chat session.
    
    The message will be saved immediately and processed asynchronously by the AI.
    """
    try:
        message_id, ai_status = await service.send_message(
            session_id=session_id,
            message=request.message,
        )
        
        return SendMessageResponse(
            message_id=message_id,
            status=AIStatus(ai_status),
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/session/{session_id}/context",
    response_model=UpdateContextResponse,
    summary="Update session context",
    description="Update the context for an existing session without triggering AI response. Useful when user navigates between pages."
)
async def update_context(
    session_id: str,
    request: UpdateContextRequest,
    service: AiChatAgentService = Depends(get_chat_agent_service),
) -> UpdateContextResponse:
    """
    Update the context for an existing chat session.
    
    This allows seamless context switching as users navigate between pages
    without needing to create new sessions. The AI will use the updated
    context for future messages.
    
    No AI response is triggered by this endpoint.
    """
    try:
        success = await service.update_context(
            session_id=session_id,
            context_type=request.context_type.value,
            context_meta=request.context_meta,
        )
        
        return UpdateContextResponse(
            session_id=session_id,
            context_type=request.context_type.value,
            success=success,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/session/{session_id}/stream",
    summary="Stream messages via SSE",
    description="Opens a persistent SSE connection for real-time message updates. Client receives events as they occur."
)
async def stream_session(
    session_id: str,
    request: Request,
    service: AiChatAgentService = Depends(get_chat_agent_service),
):
    """
    SSE endpoint for real-time message streaming.
    
    The client opens a persistent connection and receives events in real-time:
    - 'message' events: New chat messages (user, assistant, tool_call, tool_result)
    - 'status' events: AI and session status updates
    - 'ping' events: Keepalive pings every 30 seconds
    ```
    """
    async def event_generator():
        logger.info(f"Starting SSE event generator for session {session_id}")
        try:
            async for event in service.stream_session(session_id):
                # Format as SSE event
                event_type = event.get("event", "message")
                event_data = event.get("data", {})
                
                # Convert data to JSON string
                data_str = json.dumps(event_data)
                
                logger.debug(f"Yielding SSE event '{event_type}' for session {session_id}")
                
                # Yield SSE formatted string: event: <type>\ndata: <json>\n\n
                yield f"event: {event_type}\ndata: {data_str}\n\n"
                    
        except ValueError as e:
            logger.error(f"Session error: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            logger.error(f"SSE streaming error: {e}")
            yield f"event: error\ndata: {json.dumps({'error': 'Internal server error'})}\n\n"
        finally:
            logger.info(f"SSE event generator finished for session {session_id}")
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/session/{session_id}/updates",
    summary="Get messages (fallback for non-SSE clients)",
    description="Fallback endpoint for clients that don't support SSE. Returns messages since last_message_id."
)
async def get_updates_fallback(
    session_id: str,
    last_message_id: Optional[int] = Query(None, description="Get messages after this ID"),
    service: AiChatAgentService = Depends(get_chat_agent_service),
):
    """
    Fallback polling endpoint for clients that cannot use SSE.
    
    Prefer using the /stream endpoint for better performance and real-time updates.
    """
    try:
        result = await service.get_updates(
            session_id=session_id,
            last_message_id=last_message_id,
        )
        
        # Convert messages to dict format
        messages_data = [
            {
                "id": msg.id,
                "type": msg.message_type,
                "content": msg.content,
                "metadata": msg.meta_data,
                "created_at": msg.created_at.isoformat(),
            }
            for msg in result["messages"]
        ]
        
        return {
            "messages": messages_data,
            "ai_status": result["ai_status"],
            "session_status": result["session_status"],
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting updates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/session/{session_id}/close",
    response_model=CloseSessionResponse,
    summary="Close a chat session",
    description="Close an active chat session. No further messages can be sent after closing."
)
async def close_session(
    session_id: str,
    service: AiChatAgentService = Depends(get_chat_agent_service),
) -> CloseSessionResponse:
    """
    Close a chat session.
    
    This marks the session as CLOSED and prevents further messages.
    """
    try:
        success, message_count = await service.close_session(session_id)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        return CloseSessionResponse(
            session_id=session_id,
            status="CLOSED",
            message_count=message_count,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/debug/active-streams",
    summary="Debug: List active SSE connections",
    description="Returns the count of active SSE listeners per session (for debugging)"
)
async def debug_active_streams(
    service: AiChatAgentService = Depends(get_chat_agent_service),
):
    """Debug endpoint to check active SSE connections."""
    active_streams = {
        session_id: len(queues) 
        for session_id, queues in service._session_queues.items()
    }
    return {
        "active_streams": active_streams,
        "total_sessions": len(active_streams),
        "total_listeners": sum(active_streams.values())
    }


__all__ = ["router"]
