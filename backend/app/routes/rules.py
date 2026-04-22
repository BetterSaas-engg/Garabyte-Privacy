"""Rules library endpoint -- returns the full library so the frontend can render the questionnaire."""

from fastapi import APIRouter

from ..schemas import RulesLibraryOut, DimensionSchema, QuestionSchema

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("", response_model=RulesLibraryOut)
def get_rules() -> RulesLibraryOut:
    """
    Return the full rules library.

    The frontend calls this once on load to render the questionnaire.
    We read from the module-level RULES constant loaded at startup.
    """
    # Lazy import to avoid circular imports (main.py imports this router).
    from ..main import RULES

    dims: list[DimensionSchema] = []
    for d in RULES.dimensions:
        questions = [
            QuestionSchema(
                id=q.id,
                text=q.text,
                options=[{"value": o.value, "label": o.label} for o in q.options],
                evidence_prompt=q.evidence_prompt,
                regulatory_note=q.regulatory_note,
            )
            for q in d.questions
        ]
        dims.append(DimensionSchema(
            id=d.id,
            name=d.name,
            description=d.description,
            weight=d.weight,
            questions=questions,
        ))
    return RulesLibraryOut(dimensions=dims)
