"""Incident-structure response schema — mirrors media_service
IncidentAIStructureResponse (snake_case, nulls included, declared field order).

Wire shape returned to the client (Spring default JsonInclude.ALWAYS → nulls
present). `property_loss` also accepts the LLM's `property_damages` spelling on
input (Java @JsonAlias) but always emits `property_loss`.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class PersonInjuredAI(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    nature: Optional[str] = None
    is_employee: Optional[bool] = None
    id_number: Optional[str] = None


class PropertyLossAI(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    description: Optional[str] = None
    loss_value: Optional[float] = None
    type: Optional[str] = None


class SuspectAI(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    description: Optional[str] = None


class IncidentAIStructureResponse(BaseModel):
    """Field order matches the Java DTO declaration order (Pydantic preserves it)."""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    event_code: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    title: Optional[str] = None
    is_suspect_known: Optional[bool] = None
    was_reported_to_police: Optional[bool] = None
    people_injured: Optional[List[PersonInjuredAI]] = None
    # Java @JsonAlias("property_damages") — accept either on input, emit property_loss.
    property_loss: Optional[List[PropertyLossAI]] = Field(
        default=None,
        validation_alias=AliasChoices("property_loss", "property_damages"),
        serialization_alias="property_loss",
    )
    suspects: Optional[List[SuspectAI]] = None
