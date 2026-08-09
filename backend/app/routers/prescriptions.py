from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import get_current_patient
from app.database import get_db
from app.limiter import limiter
from app.models import Patient, Prescription, PrescriptionAudio
from app.schemas import PrescriptionDetailResponse
from app.services.openai_client import SpeechSynthesisError, synthesize_speech
from app.services.pdf_builder import build_prescription_pdf
from app.services.speech_script import build_speech_script

router = APIRouter(prefix="/patients/me/prescriptions", tags=["prescriptions"])


def _to_detail(prescription: Prescription) -> PrescriptionDetailResponse:
    doctor = prescription.consultation.doctor
    patient = prescription.consultation.patient
    return PrescriptionDetailResponse(
        id=prescription.id,
        chief_complaint=prescription.chief_complaint,
        diagnosis=prescription.diagnosis,
        diet_advice=prescription.diet_advice,
        advice=prescription.advice,
        chief_complaint_hi=prescription.chief_complaint_hi,
        diagnosis_hi=prescription.diagnosis_hi,
        diet_advice_hi=prescription.diet_advice_hi,
        advice_hi=prescription.advice_hi,
        temperature=prescription.temperature,
        blood_pressure=prescription.blood_pressure,
        pulse=prescription.pulse,
        weight=prescription.weight,
        medicines=prescription.medicines,
        tests=prescription.tests,
        created_at=prescription.created_at,
        doctor_name=doctor.name,
        doctor_specialization=doctor.specialization,
        doctor_clinic=doctor.clinic,
        doctor_reg_no=doctor.reg_no,
        patient_name=patient.name,
        patient_age=patient.age,
        patient_gender=patient.gender,
        patient_known_allergies=patient.known_allergies,
    )


@router.get("", response_model=list[PrescriptionDetailResponse])
def my_prescriptions(
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    prescriptions = (
        db.query(Prescription)
        .join(Prescription.consultation)
        .filter(Prescription.consultation.has(patient_id=patient.id))
        .order_by(Prescription.created_at.desc())
        .all()
    )
    return [_to_detail(p) for p in prescriptions]


@router.get("/{prescription_id}", response_model=PrescriptionDetailResponse)
def my_prescription_detail(
    prescription_id: str,
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.consultation.patient_id != patient.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")
    return _to_detail(prescription)


@router.get("/{prescription_id}/audio")
@limiter.limit("20/hour")
def my_prescription_audio(
    request: Request,
    prescription_id: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    if lang not in ("en", "hi"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lang must be 'en' or 'hi'")

    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.consultation.patient_id != patient.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")
    if lang == "hi" and not prescription.chief_complaint_hi:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hindi audio isn't available for this prescription")

    cached = (
        db.query(PrescriptionAudio)
        .filter(PrescriptionAudio.prescription_id == prescription.id, PrescriptionAudio.lang == lang)
        .first()
    )
    if not cached:
        script = build_speech_script(prescription, lang)
        try:
            audio_bytes = synthesize_speech(script)
        except SpeechSynthesisError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Couldn't generate audio: {exc}")
        cached = PrescriptionAudio(prescription_id=prescription.id, lang=lang, audio_data=audio_bytes)
        db.add(cached)
        db.commit()
        db.refresh(cached)

    return Response(content=cached.audio_data, media_type="audio/mpeg")


@router.get("/{prescription_id}/pdf")
def my_prescription_pdf(
    prescription_id: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    if lang not in ("en", "hi"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lang must be 'en' or 'hi'")

    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.consultation.patient_id != patient.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")
    if lang == "hi" and not prescription.chief_complaint_hi:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hindi version isn't available for this prescription")

    pdf_bytes = build_prescription_pdf(prescription, lang)
    filename = f"prescription-{prescription.created_at.strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
