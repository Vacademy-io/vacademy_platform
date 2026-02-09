from pydantic import BaseModel, Field
from typing import Optional

class ChatContext(BaseModel):
    page_id: Optional[str] = None
    slide_id: Optional[str] = None
    slide_content: Optional[str] = Field(None, description="Content of the current slide to provide context")

class ChatRequest(BaseModel):
    prompt: str = Field(..., description="Student's doubt or question")
    context: Optional[ChatContext] = None
    institute_id: Optional[str] = Field(None, description="Institute ID for credit deduction")
    user_id: Optional[str] = Field(None, description="User ID for usage tracking")

class ChatResponse(BaseModel):
    content: str = Field(..., description="AI response in MDX format")

