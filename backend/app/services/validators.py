from app.schemas import PrescriptionDraft


def is_usable_draft(draft: PrescriptionDraft) -> bool:
    """A draft is usable if it has at least a diagnosis or one medicine."""
    return bool(draft.diagnosis.strip()) or len(draft.medicines) > 0
