from fastapi import APIRouter
from ..schemas.utils import UrlScrapeRequest, UrlScrapeResponse
from ..services.scraper_service import ScraperService

router = APIRouter(prefix="/utils", tags=["utils"])
scraper_service = ScraperService()

@router.post("/scrape-url", response_model=UrlScrapeResponse, summary="Scrape and extract text from a URL")
async def scrape_url(request: UrlScrapeRequest):
    """
    Accepts a URL, fetches its content, and returns the cleaned/filtered text data.
    """
    result = await scraper_service.scrape_url(str(request.url))
    return UrlScrapeResponse(**result)
