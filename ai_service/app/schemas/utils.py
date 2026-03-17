from pydantic import BaseModel, HttpUrl

class UrlScrapeRequest(BaseModel):
    url: HttpUrl

class UrlScrapeResponse(BaseModel):
    content: str
    title: str | None = None
