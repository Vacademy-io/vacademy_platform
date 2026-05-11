"""
Pydantic models for the "build a brand kit by scraping a website" feature.

The response shape mirrors the FE's BrandKitWritePayload (snake_case) so the
admin dashboard's BrandKitDrawer can `form.reset(response.draft)` without a
mapping layer. Persistence stays on admin_core_service — this endpoint only
returns a draft.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


WatermarkPosition = Literal["top-left", "top-right", "bottom-left", "bottom-right"]
BackgroundType = Literal["white", "black"]


class BrandPaletteDraft(BaseModel):
    primary: Optional[str] = None
    secondary: Optional[str] = None
    accent: Optional[str] = None
    background: Optional[str] = None


class IntroOutroDraft(BaseModel):
    enabled: bool = False
    duration_seconds: float = 3.0
    html: str = ""


class WatermarkDraft(BaseModel):
    enabled: bool = False
    position: WatermarkPosition = "top-right"
    opacity: float = 0.5
    html: str = ""


class BrandKitDraft(BaseModel):
    """Mirrors BrandKitWritePayload on the FE — snake_case throughout."""

    name: str
    is_default: bool = False
    background_type: BackgroundType = "white"
    palette: BrandPaletteDraft = Field(default_factory=BrandPaletteDraft)
    heading_font: Optional[str] = None
    body_font: Optional[str] = None
    layout_theme: Optional[str] = None
    logo_file_id: Optional[str] = None
    intro: IntroOutroDraft = Field(default_factory=IntroOutroDraft)
    outro: IntroOutroDraft = Field(default_factory=IntroOutroDraft)
    watermark: WatermarkDraft = Field(default_factory=WatermarkDraft)


class BrandKitScrapePreview(BaseModel):
    source_url: str
    logo_url: Optional[str] = None
    screenshot_url: Optional[str] = None


class BrandKitScrapeRequest(BaseModel):
    url: HttpUrl

    model_config = ConfigDict(extra="ignore")


class BrandKitScrapeResponse(BaseModel):
    draft: BrandKitDraft
    preview: BrandKitScrapePreview
    warnings: List[str] = Field(default_factory=list)


# Internal — what we expect the LLM to emit (validated, then folded into the
# user-facing draft). Looser than BrandKitDraft so we can repair partial output.
class BrandKitDraftLLMOut(BaseModel):
    name: Optional[str] = None
    background_type: Optional[BackgroundType] = None
    palette: Optional[BrandPaletteDraft] = None
    heading_font: Optional[str] = None
    body_font: Optional[str] = None
    intro_html: Optional[str] = None
    outro_html: Optional[str] = None
    watermark_html: Optional[str] = None

    model_config = ConfigDict(extra="ignore")
