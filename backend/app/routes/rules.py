"""Rules library endpoint -- returns the full library so the frontend can render the questionnaire."""

from fastapi import APIRouter, Depends

from ..auth.deps import get_current_user
from ..models import User
from ..schemas import RulesLibraryOut, DimensionSchema, QuestionSchema

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("", response_model=RulesLibraryOut)
def get_rules(
    _user: User = Depends(get_current_user),
) -> RulesLibraryOut:
    """
    Return the full rules library.

    The frontend calls this once on load to render the questionnaire.
    We read from the module-level RULES constant loaded at startup.

    Auth: any authenticated user. Reading the rules content is needed by
    every customer role to render the questionnaire and reports — distinct
    from the rules library *editor* which is rules_editor only (R&P).
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
