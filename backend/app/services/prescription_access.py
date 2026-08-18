"""Shared read-side logic for prescriptions, used by both the patient-facing router
(prescriptions.py) and the caregiver-facing router (caregivers.py).

This used to be duplicated almost line-for-line in both routers - the same
_to_detail() mapper, the same "fetch or synthesize" audio-caching logic, and the same
lang-validation checks. That already caused a real bug during the allergies migration
(one copy got updated, the other didn't, for a few commits) and, separately, neither
copy filtered out prescriptions that haven't been sent yet - so a doctor-drafted,
not-yet-approved prescription was visible to the patient (and any caregiver) the
moment the draft row was created, defeating the "doctor reviews before it reaches
the patient" guarantee the whole app is built around. Both problems are fixed here,
in one place, so they can't happen again independently in each router.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Consultation, ConsultationStatus, Prescription, PrescriptionAudio
from app.schemas import PrescriptionDetailResponse
from app.services.openai_client import SpeechSynthesisError, synthesize_speech
from app.services.speech_script import build_speech_script

_DETAIL_LOAD_OPTIONS = (
    joinedload(Prescription.consultation).joinedload(Consultation.doctor),
    joinedload(Prescription.consultation).joinedload(Consultation.patient),
    selectinload(Prescription.medicines),
    selectinload(Prescription.tests),
)


def to_prescription_detail(prescription: Prescription) -> PrescriptionDetailResponse:
    doctor = prescription.consultation.doctor
    patient = prescription.consultation.patient
    return PrescriptionDetailResponse(
        id=prescription.id,
        chief_complaint=prescription.chief_complaint,
        diagnosis=prescription.diagnosis,
        allergies=prescription.allergies,
        diet_advice=prescription.diet_advice,
        advice=prescription.advice,
        chief_complaint_hi=prescription.chief_complaint_hi,
        diagnosis_hi=prescription.diagnosis_hi,
        allergies_hi=prescription.allergies_hi,
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
    )


def list_sent_prescriptions_for_patient(db: Session, patient_id: str) -> list[Prescription]:
    """Only prescriptions the doctor has actually approved and sent."""
    return (
        db.query(Prescription)
        .join(Prescription.consultation)
        .options(*_DETAIL_LOAD_OPTIONS)
        .filter(
            Prescription.consultation.has(patient_id=patient_id),
            Prescription.consultation.has(status=ConsultationStatus.sent),
        )
        .order_by(Prescription.created_at.desc())
        .all()
    )


def get_sent_prescription_for_patient(db: Session, prescription_id: str, patient_id: str) -> Prescription:
    """Fetch one prescription, 404-ing unless it belongs to this patient AND has been sent."""
    prescription = (
        db.query(Prescription)
        .options(*_DETAIL_LOAD_OPTIONS)
        .filter(Prescription.id == prescription_id)
        .first()
    )
    if (
        not prescription
        or prescription.consultation.patient_id != patient_id
        or prescription.consultation.status != ConsultationStatus.sent
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")
    return prescription


def ensure_lang_available(prescription: Prescription, lang: str) -> None:
    if lang not in ("en", "hi"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lang must be 'en' or 'hi'")
    if lang == "hi" and not prescription.chief_complaint_hi:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hindi version isn't available for this prescription",
        )


def get_or_create_audio(db: Session, prescription: Prescription, lang: str) -> bytes:
    cached = (
        db.query(PrescriptionAudio)
        .filter(PrescriptionAudio.prescription_id == prescription.id, PrescriptionAudio.lang == lang)
        .first()
    )
    if cached:
        return cached.audio_data

    script = build_speech_script(prescription, lang)
    try:
        audio_bytes = synthesize_speech(script)
    except SpeechSynthesisError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Couldn't generate audio: {exc}")

    cached = PrescriptionAudio(prescription_id=prescription.id, lang=lang, audio_data=audio_bytes)
    db.add(cached)
    db.commit()
    db.refresh(cached)
    return cached.audio_data
