from __future__ import annotations
from ..schemas.chat_bot import ChatContext

class ChatPrompts:
    """
    Prompt templates for AI Chat Bot (Tutor).
    """

    @staticmethod
    def build_chat_prompt(user_prompt: str, context: ChatContext | None) -> str:
        """
        Builds a system-like prompt for the AI Tutor.
        Includes context if available and enforces MDX output.
        """
        context_str = ""
        if context:
            if context.slide_content:
                context_str += f"\n**Current Slide Content**:\n{context.slide_content}\n"
            
        return f"""**Role**: You are an expert AI Tutor helping a student learn.
{context_str}
**Student Question**: {user_prompt}

**Instructions**:
1. Answer the student's question clearly and concisely.
2. Verify if the question is related to the provided context (if any).
3. If the question is about the context, use it to provide a specific answer.
4. If the question is general, answer it based on your general knowledge.
5. Use an encouraging and helpful tone.
6. Keep the response structured and easy to read.
7. Try to keep the response concise unless explaining a complex topic.

**Output Format**:
- Return the response in **MDX (Markdown)** format.
- Use standard Markdown features:
  - Bold (`**text**`) for emphasis.
  - Lists (`-` or `1.`) for steps or points.
  - Code blocks (` ```language `) for code examples.
  - Headings (`###`) for sections.
  - Table syntax for tabular data.
- Do NOT wrap the entire response in a code block. Return raw MDX.
"""

__all__ = ["ChatPrompts"]
