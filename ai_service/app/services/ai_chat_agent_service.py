"""
Main AI Chat Agent service with agentic processing loop and SSE support.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
from uuid import uuid4

from sqlalchemy.orm import Session

from ..repositories.chat_session_repository import ChatSessionRepository
from ..repositories.chat_message_repository import ChatMessageRepository
from ..services.context_resolver_service import ContextResolverService
from ..services.tool_manager_service import ToolManagerService
from ..services.chat_llm_client import ChatLLMClient
from ..services.institute_settings_service import InstituteSettingsService
from ..models.chat_message import ChatMessage

logger = logging.getLogger(__name__)


class AiChatAgentService:
    """
    Orchestrates the AI chat agent with agentic capabilities and SSE support.
    Handles session management, message processing, and real-time streaming.
    """
    
    def __init__(
        self,
        db_session: Session,
        context_resolver: ContextResolverService,
        tool_manager: ToolManagerService,
        llm_client: ChatLLMClient,
        institute_settings: InstituteSettingsService,
    ):
        self.db = db_session
        self.session_repo = ChatSessionRepository(db_session)
        self.message_repo = ChatMessageRepository(db_session)
        self.context_resolver = context_resolver
        self.tool_manager = tool_manager
        self.llm_client = llm_client
        self.institute_settings = institute_settings
    
    async def create_session(
        self,
        user_id: str,
        institute_id: str,
        context_type: Optional[str] = None,
        context_meta: Optional[Dict[str, Any]] = None,
        initial_message: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Create a new chat session and optionally process initial message.
    
        Returns:
            Tuple of (session_id, ai_status)
        """
        # Use GENERAL context if not provided
        if context_type is None:
            context_type = "general"
        if context_meta is None:
            context_meta = {}
            
        # Create session
        session = self.session_repo.create_session(
            user_id=user_id,
            institute_id=institute_id,
            context_type=context_type,
            context_meta=context_meta,
        )
        
        logger.info(f"Created chat session {session.id} for user {user_id}")
        
        # If initial message provided, save it and return
        if initial_message:
            # Save user message
            self.message_repo.create_message(
                session_id=session.id,
                message_type="user",
                content=initial_message,
            )
            
            # Client will immediately connect to SSE stream which will process the message
            return (session.id, "idle")
        
        # No initial message - AI will generate personalized greeting on first connection
        # The SSE stream will detect no initial message and generate one based on user context
        return (session.id, "idle")
    
    async def send_message(
        self,
        session_id: str,
        message: str,
    ) -> tuple[int, str]:
        """
        Send a message to an existing session.
        
        Returns:
            Tuple of (message_id, ai_status)
        """
        # Verify session exists and is active
        session = self.session_repo.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        if session.status != "ACTIVE":
            raise ValueError(f"Session {session_id} is not active")
        
        # Save user message
        msg = self.message_repo.create_message(
            session_id=session_id,
            message_type="user",
            content=message,
        )
        
        # Update last_active
        self.session_repo.update_last_active(session_id)
        
        # Client's SSE stream will detect new message and process it
        return (msg.id, "idle")
    
    async def update_context(
        self,
        session_id: str,
        context_type: str,
        context_meta: Dict[str, Any],
    ) -> bool:
        """
        Update the context for an existing session without triggering AI response.
        This allows seamless context switching as users navigate between pages.
            
        Returns:
            True if successful
        """
        # Verify session exists and is active
        session = self.session_repo.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        if session.status != "ACTIVE":
            raise ValueError(f"Session {session_id} is not active")
        
        # Update session context
        success = self.session_repo.update_context(
            session_id=session_id,
            context_type=context_type,
            context_meta=context_meta
        )
        
        if success:
            logger.info(f"Context updated for session {session_id}: {context_type}")
        
        return success
    
    async def get_updates(
        self,
        session_id: str,
        last_message_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get new messages since last_message_id.
        Used for initial state before SSE connection and fallback.
        
        Returns:
            Dict with messages, ai_status, and session_status
        """
        # Verify session exists
        session = self.session_repo.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Get new messages
        messages = self.message_repo.get_messages_by_session(
            session_id=session_id,
            after_message_id=last_message_id,
        )
        
        # Check if there's a pending unprocessed user message
        latest = self.message_repo.get_latest_message(session_id)
        ai_status = "thinking" if latest and latest.message_type == "user" else "idle"
        
        return {
            "messages": messages,
            "ai_status": ai_status,
            "session_status": session.status,
        }
    
    async def stream_session(
        self,
        session_id: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream messages for a session via SSE.
        Directly processes new user messages and streams all events in real-time.
            
        Yields:
            Dict with event type and data for SSE
        """
        # Verify session exists
        session = self.session_repo.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        logger.info(f"SSE stream started for session {session_id}")
        
        # Send existing messages first
        existing_messages = self.message_repo.get_messages_by_session(session_id)
        logger.info(f"Sending {len(existing_messages)} existing messages to SSE stream for session {session_id}")
        
        for msg in existing_messages:
            yield {
                "event": "message",
                "data": {
                    "id": msg.id,
                    "type": msg.message_type,
                    "content": msg.content,
                    "metadata": msg.meta_data,
                    "created_at": msg.created_at.isoformat()
                }
            }
        
        # Track last processed message to avoid duplicates
        last_processed_id = existing_messages[-1].id if existing_messages else 0
        
        # If no messages exist, generate AI greeting
        if not existing_messages:
            logger.info(f"No existing messages for session {session_id}, generating AI greeting")
            
            # Generate greeting via agentic processing with special system instruction
            async for event in self._stream_greeting_generation(session_id, session.user_id, session.institute_id):
                yield event
                
                # Update last processed ID if it's a message event
                if event.get("event") == "message" and event.get("data", {}).get("id"):
                    last_processed_id = max(last_processed_id, event["data"]["id"])
            
            # Send idle status after greeting
            yield {
                "event": "status",
                "data": {
                    "ai_status": "idle",
                    "session_status": session.status
                }
            }
        
        # Check if there's an unprocessed user message
        latest = self.message_repo.get_latest_message(session_id)
        needs_processing = latest and latest.message_type == "user" and latest.id > last_processed_id
        
        # Send initial status
        ai_status = "thinking" if needs_processing else "idle"
        yield {
            "event": "status",
            "data": {
                "ai_status": ai_status,
                "session_status": session.status
            }
        }
        
        # If there's a pending user message, process it now
        if needs_processing:
            logger.info(f"Processing pending user message for session {session_id}")
            
            # Stream the agentic processing loop
            async for event in self._stream_agentic_processing(session_id, session.user_id, session.institute_id):
                yield event
                
                # Update last processed ID if it's a message event
                if event.get("event") == "message" and event.get("data", {}).get("id"):
                    last_processed_id = max(last_processed_id, event["data"]["id"])
            
            # Send idle status after processing
            yield {
                "event": "status",
                "data": {
                    "ai_status": "idle",
                    "session_status": session.status
                }
            }
        
        # Keep connection alive and watch for new messages
        logger.info(f"SSE stream entering polling loop for session {session_id}")
        
        idle_counter = 0
        max_idle_time = 30 * 60  # 30 minutes in seconds (polling every 2 seconds = 900 iterations)
        max_idle_iterations = max_idle_time // 2
        
        while True:
            # Check for new messages
            new_messages = self.message_repo.get_messages_by_session(
                session_id=session_id,
                after_message_id=last_processed_id
            )
            
            if new_messages:
                # Reset idle counter when activity detected
                idle_counter = 0
                
                # Found new user message(s) - process them
                for msg in new_messages:
                    if msg.message_type == "user":
                        logger.info(f"New user message detected for session {session_id}, starting processing")
                        
                        # Send the user message first
                        yield {
                            "event": "message",
                            "data": {
                                "id": msg.id,
                                "type": msg.message_type,
                                "content": msg.content,
                                "metadata": msg.meta_data,
                                "created_at": msg.created_at.isoformat()
                            }
                        }
                        
                        last_processed_id = msg.id
                        
                        # Send thinking status
                        yield {
                            "event": "status",
                            "data": {
                                "ai_status": "thinking",
                                "session_status": session.status
                            }
                        }
                        
                        # Stream the processing
                        async for event in self._stream_agentic_processing(session_id, session.user_id, session.institute_id):
                            yield event
                            
                            # Update last processed ID
                            if event.get("event") == "message" and event.get("data", {}).get("id"):
                                last_processed_id = max(last_processed_id, event["data"]["id"])
                        
                        # Send idle status
                        yield {
                            "event": "status",
                            "data": {
                                "ai_status": "idle",
                                "session_status": session.status
                            }
                        }
            else:
                # No new messages - increment idle counter
                idle_counter += 1
                
                # If idle timeout reached, close the stream
                if idle_counter >= max_idle_iterations:
                    logger.info(f"Session {session_id} idle for 30 minutes, closing stream")
                    break
            
            # Check if session closed
            session = self.session_repo.get_session_by_id(session_id)
            if not session or session.status == "CLOSED":
                logger.info(f"Session {session_id} closed, ending stream")
                break
            
            # Send keepalive and wait before checking again
            yield {
                "event": "comment",
                "data": {"message": "keepalive"}
            }
            
            await asyncio.sleep(2)  # Poll every 2 seconds
        
        logger.info(f"SSE stream ended for session {session_id}")
    
    async def close_session(self, session_id: str) -> tuple[bool, int]:
        """
        Close a chat session.
        
        Returns:
            Tuple of (success, message_count)
        """
        success = self.session_repo.close_session(session_id)
        
        if success:
            count = self.message_repo.count_messages_by_session(session_id)
            return (True, count)
        
        return (False, 0)
    
    async def _stream_greeting_generation(
        self,
        session_id: str,
        user_id: str,
        institute_id: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate personalized AI greeting for new session.
        
        Yields:
            SSE event dictionaries
        """
        try:
            # Fetch session
            session = self.session_repo.get_session_by_id(session_id)
            if not session:
                return
            
            # Resolve context (includes user details)
            context = await self.context_resolver.resolve_context(
                session.context_type,
                session.context_meta,
                user_id,
                institute_id,
            )
            
            # Fetch institute AI settings
            ai_settings = self.institute_settings.get_ai_settings(institute_id)
            institute_rules = self.institute_settings.format_rules_for_prompt(ai_settings)
            temperature = self.institute_settings.get_temperature(ai_settings)
            
            # Build system prompt with greeting instruction
            system_prompt = self._build_system_prompt(institute_rules, context, user_id, institute_id, is_greeting=True)
            
            # Call LLM for greeting
            messages = [{"role": "system", "content": system_prompt}]
            
            try:
                response = await self.llm_client.chat_completion(
                    messages=messages,
                    tools=None,  # No tools for greeting
                    temperature=temperature,
                    institute_id=institute_id,
                    user_id=user_id,
                )
                
                greeting_content = response.get("content", "Hi! How can I help you today?")
                
                # Save greeting as assistant message
                greeting_msg = self.message_repo.create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content=greeting_content,
                )
                
                # Yield the greeting message
                yield {
                    "event": "message",
                    "data": {
                        "id": greeting_msg.id,
                        "type": greeting_msg.message_type,
                        "content": greeting_msg.content,
                        "metadata": greeting_msg.meta_data,
                        "created_at": greeting_msg.created_at.isoformat()
                    }
                }
                
            except Exception as e:
                logger.error(f"Error generating greeting: {e}")
                # Fallback greeting
                greeting_msg = self.message_repo.create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content="Hi! I'm your AI tutor. How can I help you today?",
                )
                yield {
                    "event": "message",
                    "data": {
                        "id": greeting_msg.id,
                        "type": greeting_msg.message_type,
                        "content": greeting_msg.content,
                        "metadata": greeting_msg.meta_data,
                        "created_at": greeting_msg.created_at.isoformat()
                    }
                }
                
        except Exception as e:
            logger.error(f"Error in greeting generation for session {session_id}: {e}")
    
    async def _stream_agentic_processing(
        self,
        session_id: str,
        user_id: str,
        institute_id: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Main agentic processing loop with tool calling support.
        Streams events as they happen (tool calls, results, assistant responses).
        
        Yields:
            SSE event dictionaries
        """
        try:
            # 1. Fetch session (fresh - to get latest context from API updates)
            session = self.session_repo.get_session_by_id(session_id)
            if not session:
                return
            
            # 2. Get conversation history (last 5 user messages = 10 total with responses)
            history = self.message_repo.get_conversation_history(session_id, limit=10)
            
            # 3. Resolve passive context (includes user performance data and user details)
            # NOTE: This reads fresh context_type and context_meta from session object,
            # so it will use any updates made via the context update API
            context = await self.context_resolver.resolve_context(
                session.context_type,
                session.context_meta,
                user_id,
                institute_id,
            )
            
            # 4. Fetch institute AI settings
            ai_settings = self.institute_settings.get_ai_settings(institute_id)
            institute_rules = self.institute_settings.format_rules_for_prompt(ai_settings)
            temperature = self.institute_settings.get_temperature(ai_settings)
            
            # 5. Build system prompt
            system_prompt = self._build_system_prompt(institute_rules, context, user_id, institute_id, is_greeting=False)
            
            # 6. Build messages for LLM
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add history
            for msg in history:
                if msg.message_type == "user":
                    messages.append({"role": "user", "content": msg.content})
                elif msg.message_type == "assistant":
                    messages.append({"role": "assistant", "content": msg.content})
            
            # 7. Agentic loop with tool calling
            max_iterations = 5
            iteration = 0
            tools = self.tool_manager.get_tool_definitions()
            
            while iteration < max_iterations:
                iteration += 1
                logger.info(f"Agentic loop iteration {iteration} for session {session_id}")
                
                # Call LLM
                try:
                    response = await self.llm_client.chat_completion(
                        messages=messages,
                        tools=tools,
                        temperature=temperature,
                        institute_id=institute_id,
                        user_id=user_id,
                    )
                except Exception as e:
                    logger.error(f"LLM call failed: {e}")
                    # Yield error message
                    error_msg = self.message_repo.create_message(
                        session_id=session_id,
                        message_type="assistant",
                        content="I encountered an error processing your request. Please try again.",
                    )
                    yield {
                        "event": "message",
                        "data": {
                            "id": error_msg.id,
                            "type": error_msg.message_type,
                            "content": error_msg.content,
                            "metadata": error_msg.meta_data,
                            "created_at": error_msg.created_at.isoformat()
                        }
                    }
                    break
                
                # Check for tool calls
                tool_calls = response.get("tool_calls")
                
                logger.info(f"LLM response received for session {session_id}, tool_calls: {bool(tool_calls)}, content: {bool(response.get('content'))}")
                
                if not tool_calls:
                    # No tool calls - final response
                    final_content = response.get("content", "")
                    logger.info(f"Final response for session {session_id}, content length: {len(final_content) if final_content else 0}")
                    if final_content:
                        logger.info(f"Creating assistant message for session {session_id}")
                        msg = self.message_repo.create_message(
                            session_id=session_id,
                            message_type="assistant",
                            content=final_content,
                        )
                        logger.info(f"Created message {msg.id}, yielding to SSE stream")
                        
                        # Yield the assistant message
                        yield {
                            "event": "message",
                            "data": {
                                "id": msg.id,
                                "type": msg.message_type,
                                "content": msg.content,
                                "metadata": msg.meta_data,
                                "created_at": msg.created_at.isoformat()
                            }
                        }
                    else:
                        logger.warning(f"LLM returned empty content for session {session_id}")
                    break
                
                # Process tool calls
                for tool_call in tool_calls:
                    tool_name = tool_call["function"]["name"]
                    tool_args_str = tool_call["function"]["arguments"]
                    
                    # Parse arguments
                    try:
                        tool_args = json.loads(tool_args_str) if isinstance(tool_args_str, str) else tool_args_str
                    except json.JSONDecodeError:
                        tool_args = {}
                    
                    # Inject user_id if tool needs it
                    if "user_id" in tool_args and not tool_args["user_id"]:
                        tool_args["user_id"] = user_id
                    
                    # Send engaging message before tool execution
                    engaging_messages = {
                        "get_learning_progress": "Let me check your progress! 🔍",
                        "get_student_feedback": "Looking up your feedback... 📝",
                        "search_related_resources": "Searching for helpful resources... 🔎",
                    }
                    
                    engaging_msg_content = engaging_messages.get(tool_name, "One moment, let me check that for you... ⏳")
                    
                    engaging_msg = self.message_repo.create_message(
                        session_id=session_id,
                        message_type="assistant",
                        content=engaging_msg_content,
                    )
                    
                    # Yield the engaging message
                    yield {
                        "event": "message",
                        "data": {
                            "id": engaging_msg.id,
                            "type": engaging_msg.message_type,
                            "content": engaging_msg.content,
                            "metadata": engaging_msg.meta_data,
                            "created_at": engaging_msg.created_at.isoformat()
                        }
                    }
                    
                    # Execute tool
                    tool_result = await self.tool_manager.execute_tool(tool_name, tool_args)
                    
                    # Save tool call and result
                    tool_call_msg = self.message_repo.create_message(
                        session_id=session_id,
                        message_type="tool_call",
                        content=f"Calling tool: {tool_name}",
                        metadata={
                            "tool_name": tool_name,
                            "tool_arguments": tool_args,
                            "tool_call_id": tool_call["id"],
                        }
                    )
                    
                    # Yield tool call event
                    yield {
                        "event": "message",
                        "data": {
                            "id": tool_call_msg.id,
                            "type": tool_call_msg.message_type,
                            "content": tool_call_msg.content,
                            "metadata": tool_call_msg.meta_data,
                            "created_at": tool_call_msg.created_at.isoformat()
                        }
                    }
                    
                    tool_result_msg = self.message_repo.create_message(
                        session_id=session_id,
                        message_type="tool_result",
                        content=tool_result,
                        metadata={
                            "tool_name": tool_name,
                            "tool_call_id": tool_call["id"],
                        }
                    )
                    
                    # Yield tool result event
                    yield {
                        "event": "message",
                        "data": {
                            "id": tool_result_msg.id,
                            "type": tool_result_msg.message_type,
                            "content": tool_result_msg.content,
                            "metadata": tool_result_msg.meta_data,
                            "created_at": tool_result_msg.created_at.isoformat()
                        }
                    }
                    
                    # Add to conversation for next LLM call
                    messages.append({
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [tool_call]
                    })
                    messages.append({
                        "role": "tool",
                        "content": tool_result,
                        "tool_call_id": tool_call["id"],
                        "name": tool_name,
                    })
                
                # Continue loop to process tool results
            
            # Update session last_active
            self.session_repo.update_last_active(session_id)
            
        except Exception as e:
            logger.error(f"Error in agentic processing for session {session_id}: {e}")
            # Yield error message
            error_msg = self.message_repo.create_message(
                session_id=session_id,
                message_type="assistant",
                content="I encountered an error processing your request. Please try again.",
            )
            yield {
                "event": "message",
                "data": {
                    "id": error_msg.id,
                    "type": error_msg.message_type,
                    "content": error_msg.content,
                    "metadata": error_msg.meta_data,
                    "created_at": error_msg.created_at.isoformat()
                }
            }
    
    def _build_system_prompt(self, institute_rules: str, context: Dict[str, Any], user_id: str, institute_id: str, is_greeting: bool = False) -> str:
        """
        Build the system prompt combining institute rules and context.
        
        Args:
            is_greeting: If True, instructs AI to generate a personalized greeting
        """
        import json
        
        # Extract user details
        user_details = context.get("user_details", {})
        user_name = user_details.get("name", "Student")
        user_email = user_details.get("email")
        
        # Build user identity section
        user_identity = f"""IMPORTANT - USER IDENTITY:
- Current User ID: {user_id}
- Current Institute ID: {institute_id}
- Student Name: {user_name}"""
        if user_email:
            user_identity += f"\n- Student Email: {user_email}"
        user_identity += """
- When you call tools that require user_id or institute_id, use these values above
- DO NOT ask the user for their user_id or institute_id - you already have them
- Address the student by their name naturally in conversation"""
        
        # Format context as JSON string
        context_str = json.dumps({
            "context_type": context.get("context_type"),
            "context_data": context.get("context_data"),
            "user_performance": context.get("user_performance")
        }, indent=2)
        
        # Extract assistant name from institute rules
        assistant_name = "your AI tutor"
        if "You are" in institute_rules:
            # Try to extract name from "You are {name}, a {role}" pattern
            import re
            match = re.search(r'You are ([^,]+),', institute_rules)
            if match:
                assistant_name = match.group(1).strip()
        
        greeting_instruction = ""
        if is_greeting:
            greeting_instruction = f"""

SPECIAL INSTRUCTION - GENERATE GREETING:
This is the first message of the conversation. Generate a warm, personalized greeting for {user_name}.
- Introduce yourself using your name: "{assistant_name}"
- Use the student's name naturally
- Reference the current context (slide/course/general)
- Keep it friendly and encouraging (1-2 sentences)
- End with an open question to engage them
- Example: "Hi {user_name}! 👋 I'm {assistant_name}, here to help you master this topic. What would you like to explore first?"
"""
        
        prompt = f"""You are an AI educational tutor helping students learn. Your role is to guide students to understand concepts rather than just providing answers.

{user_identity}

{institute_rules}

CONTEXT INFORMATION:
{context_str}{greeting_instruction}

INSTRUCTIONS FOR USING CONTEXT:
The context above contains three key pieces of information:

1. CONTEXT DATA (context_type & context_data):
   - What the student is currently viewing (slide/course/general)
   - Specific content, materials, or topics they're working on
   - Their progress and difficulty level
   - Use this to understand what "this", "here", or "the slide" refers to

2. USER PERFORMANCE (user_performance):
   - Student's strengths: Topics/skills they excel at
   - Student's weaknesses: Topics/skills they struggle with
   - Overall performance metrics and improvement areas
   - Topics mastered vs topics they're struggling with
   - Use this when student asks about "my weaknesses", "my strengths", "what should I focus on", "give me feedback"

3. CONVERSATION HISTORY:
   - Last 5 user messages (system provides this separately)
   - Use for maintaining conversation context

HOW TO USE THIS INFORMATION:
- Reference specific slide content or course materials when relevant
- When student asks about their performance/weaknesses/strengths, use the user_performance data
- Tailor difficulty based on their known strengths and weaknesses
- If they're asking about a topic in their "weaknesses" list, provide extra support
- If they're asking about a topic in their "strengths" list, you can go deeper
- Suggest focus areas based on their improvement_areas or topics_struggling

RESPONSE FORMATTING - CRITICAL:
Your responses will be rendered as Markdown in a React frontend. Follow these formatting rules:

1. **Use Proper Markdown Syntax:**
   - Use actual line breaks (not \\n escape sequences)
   - Use `##` for headings, `**bold**`, `*italic*`, `- ` for lists
   - Use `---` for horizontal rules
   - Use ` ``` ` for code blocks
   - Use `> ` for blockquotes

2. **Rich Formatting When Appropriate:**
   When showing progress, data, or structured information, use Markdown tables, lists, or formatting:
   
   Example for progress:
   ```markdown
   ## Your Progress
   
   | Course | Progress | Status |
   |--------|----------|--------|
   | Biology | 75% | 🟢 On Track |
   | Math | 45% | 🟡 Needs Focus |
   
   ### What You Completed Today
   - ✅ Quiz 1 (100%)
   - ✅ Quiz 2 (100%)
   - ✅ Quiz 3 (100%)
   ```

3. **When to Use Rich Formatting:**
   - Progress reports: Use tables or formatted lists with emojis
   - Multiple items: Use bullet points or numbered lists
   - Comparisons: Use tables
   - Important info: Use **bold** or ## headings
   - Quotes or definitions: Use blockquotes
   - Step-by-step: Use numbered lists

4. **Keep It Simple When Not Needed:**
   - Regular explanations: Plain paragraphs
   - Simple answers: Short, direct text
   - Conversations: Natural, flowing text

5. **Response Length - Be Smart:**
   - Simple questions deserve simple answers:
     * "What's 2+2?" → "4"
     * "What does DNA stand for?" → "Deoxyribonucleic Acid"
     * "Is this correct?" → "Yes!" or "Not quite."
   - Complex questions deserve detailed explanations:
     * "Explain photosynthesis" → Full explanation with steps
     * "How do I solve this?" → Step-by-step guidance
     * "What's my progress?" → Detailed breakdown with tables
   - Match your response length to what the student needs:
     * Factual questions: 1-2 sentences
     * Conceptual questions: 2-4 paragraphs
     * Problem-solving: Step-by-step with examples

6. **General Response Guidelines:**
   - Be encouraging, supportive, and patient
   - Break down complex concepts into simpler parts
   - Ask guiding questions to help students think critically
   - Use analogies and examples to clarify difficult topics
   - Guide students through thinking rather than giving direct answers
   - Use tools when you need real-time information (grades, progress, resources, what's next)
   - Use a friendly, conversational tone

ADAPTIVE TEACHING:
- For topics in their weaknesses: Provide foundational explanations, check understanding frequently
- For topics in their strengths: Challenge with deeper questions, real-world applications
- If overall_performance is low: Be extra encouraging, break things down more
- If last_assessment_score is available: Reference it when discussing their progress

LEARNING PATH GUIDANCE:
When student asks "What's next?" or "What should I learn next?":
- Use get_learning_progress tool (includes next_recommendation)
- Check the "next_recommendation" field in the response
- If status is "next_available": Explain what they completed and what comes next with enthusiasm
- If status is "chapter_complete": Congratulate them and suggest exploring the next chapter
- Encourage continuous learning and acknowledge their progress
- Example: "Great work on 'Cell Structure'! Next up is 'Cell Division' which builds on what you just learned. Ready to continue? 🧬"

When student asks "What are my weaknesses?" or "What should I improve?":
- Refer to the weaknesses and topics_struggling from user_performance
- Be constructive and encouraging
- Suggest specific study strategies for each weakness
- Connect weaknesses to current context if relevant
"""
        return prompt.strip()


__all__ = ["AiChatAgentService"]
