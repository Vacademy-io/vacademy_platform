from typing import Optional
from pydantic import BaseModel, HttpUrl

class UrlScrapeRequest(BaseModel):
    url: HttpUrl

class UrlScrapeResponse(BaseModel):
    content: str
    title: Optional[str] = None
