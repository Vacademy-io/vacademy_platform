import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException
import ipaddress
from urllib.parse import urlparse
import socket
import logging

logger = logging.getLogger(__name__)

class ScraperService:
    async def scrape_url(self, url: str) -> dict:
        # 1. Validation & SSRF Check
        self._validate_url(url)
        
        # 2. Fetching
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                html_content = response.text
        except httpx.HTTPStatusError as e:
             logger.warning(f"HTTP error fetching URL {url}: {e}")
             if e.response.status_code == 403:
                 raise HTTPException(status_code=403, detail="Access denied to the target URL.")
             if e.response.status_code == 404:
                 raise HTTPException(status_code=404, detail="Target URL not found.")
             raise HTTPException(status_code=e.response.status_code, detail=f"Error fetching URL: {str(e)}")
        except httpx.RequestError as e:
            logger.warning(f"Request error fetching URL {url}: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to reach the URL or timeout: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error fetching URL {url}: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to fetch user provided URL: {str(e)}")

        # 3. Processing/Filtering
        return self._extract_content(html_content)

    def _validate_url(self, url: str):
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname
            if not hostname:
                raise HTTPException(status_code=400, detail="Invalid URL: Missing hostname")

            # Basic SSRF check
            # Resolve to IP
            ip = socket.gethostbyname(hostname)
            ip_addr = ipaddress.ip_address(ip)
            
            if ip_addr.is_private or ip_addr.is_loopback or ip_addr.is_link_local:
                 raise HTTPException(status_code=400, detail="Public access only. Access to internal/private resources is forbidden.")
        except socket.gaierror:
             raise HTTPException(status_code=400, detail="Invalid hostname or DNS resolution failed.")
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid URL format.")
        except HTTPException:
            raise
        except Exception as e:
             logger.error(f"SSRF validation error for {url}: {e}")
             raise HTTPException(status_code=400, detail="URL validation failed.")

    def _extract_content(self, html: str) -> dict:
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove noise
            for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'iframe']):
                tag.decompose()
                
            # Extract title
            title = soup.title.string.strip() if soup.title else None
            
            # Extract main content
            # We want to preserve basic structure (h1-h6, p). 
            # A simple strategy is to get text with newlines.
            body = soup.body if soup.body else soup
            
            # get_text with separator handles paragraphs reasonably well if they are block elements
            text = body.get_text(separator='\n\n', strip=True)
            
            # Limit to 20,000 characters
            if len(text) > 20000:
                text = text[:20000] + "..."
                
            return {"content": text, "title": title}
        except Exception as e:
            logger.error(f"Error parsing HTML content: {e}")
            raise HTTPException(status_code=500, detail="Failed to process content from the URL.")
