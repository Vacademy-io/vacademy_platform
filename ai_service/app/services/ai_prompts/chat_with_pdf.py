"""Chat-with-PDF prompt — ported from media_service
ConstantAiTemplate.getChatWithPdfTemplate() (bound via Spring AI PromptTemplate
in DeepSeekConversationService.getResponseForUserPrompt).

Placeholders {htmlText}, {userPrompt} (appears 3×), {last5Conversation}. The
literal JSON-example braces are kept doubled (``{{``/``}}``) so Python
``str.format(**vars)`` reproduces Spring PromptTemplate's single-brace
collapsing. The Java text-block ``\\s`` trailing-space escapes (whitespace
preservers, semantically irrelevant to the model) render as plain spaces.
"""
from __future__ import annotations

_TEMPLATE = """HTML raw data :  {htmlText}
User Chat :  {userPrompt}
Last 5 Conversations: {last5Conversation}

Prompt:
  - Use the "User Chat" to generate a meaningful response based on the HTML content.
  - Utilize relevant information from the "Last 5 Conversations" (if available) to maintain conversational continuity

   JSON format :

{{
   "user" : "{userPrompt}",
   "response" : "String" //Include Response here in well formatted html format
}}


IMPORTANT: {userPrompt}
Give the response string in a formatted html format
"""


def build_prompt(html_text: str, user_prompt: str, last5_conversation: str) -> str:
    """Bind the chat template. `last5_conversation` is the JSON-serialized list
    of prior turns (ConversationDto: {user, aiResponse, createdAt})."""
    return _TEMPLATE.format(
        htmlText=html_text,
        userPrompt=user_prompt,
        last5Conversation=last5_conversation,
    )
