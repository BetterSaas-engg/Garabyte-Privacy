"""Rules library API schemas -- flatter version of the rules_loader dataclasses for JSON transport."""

from typing import Any, Optional

from pydantic import BaseModel


class QuestionSchema(BaseModel):
    id: str
    text: str
    options: list[dict[str, Any]]
    evidence_prompt: Optional[str] = None
    regulatory_note: Optional[str] = None


class DimensionSchema(BaseModel):
    id: str
    name: str
    description: str
    weight: float
    questions: list[QuestionSchema]


class RulesLibraryOut(BaseModel):
    dimensions: list[DimensionSchema]
