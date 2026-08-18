from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.auth import get_current_patient
from app.database import get_db
from app.limiter import limiter
from app.models import Patient
from app.schemas import PrescriptionDetailResponse
from app.services.pdf_builder import build_prescription_pdf
from app.services.prescription_access import (
    ensure_lang_available,
    get_or_create_audio,
    get_sent_prescription_for_patient,
    list_sent_prescriptions_for_patient,
    to_prescription_detail,
)

router = APIRouter(prefix="/patients/me/prescriptions", tags=["prescriptions"])


@router.get("", response_model=list[PrescriptionDetailResponse])
def my_prescriptions(
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    prescriptions = list_sent_prescriptions_for_patient(db, patient.id)
    return [to_prescription_detail(p) for p in prescriptions]


@router.get("/{prescription_id}", response_model=PrescriptionDetailResponse)
def my_prescription_detail(
    prescription_id: str,
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    prescription = get_sent_prescription_for_patient(db, prescription_id, patient.id)
    return to_prescription_detail(prescription)


@router.get("/{prescription_id}/audio")
@limiter.limit("20/hour")
def my_prescription_audio(
    request: Request,
    prescription_id: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    prescription = get_sent_prescription_for_patient(db, prescription_id, patient.id)
    ensure_lang_available(prescription, lang)
    audio_bytes = get_or_create_audio(db, prescription, lang)
    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.get("/{prescription_id}/pdf")
def my_prescription_pdf(
    prescription_id: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    prescription = get_sent_prescription_for_patient(db, prescription_id, patient.id)
    ensure_lang_available(prescription, lang)
    pdf_bytes = build_prescription_pdf(prescription, lang)
    filename = f"prescription-{prescription.created_at.strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
