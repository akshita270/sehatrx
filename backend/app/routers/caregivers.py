from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import generate_claim_code, get_current_caregiver, get_current_patient
from app.database import get_db
from app.limiter import limiter
from app.models import Caregiver, CaregiverPatientLink, Patient, Prescription, PrescriptionAudio
from app.schemas import CaregiverLinkRequest, CaregiverPatientResponse, CaregiverResponse, PrescriptionDetailResponse
from app.services.openai_client import SpeechSynthesisError, synthesize_speech
from app.services.pdf_builder import build_prescription_pdf
from app.services.speech_script import build_speech_script

router = APIRouter(tags=["caregivers"])


@router.get("/patients/me/caregivers", response_model=list[CaregiverResponse])
def list_my_caregivers(db: Session = Depends(get_db), patient: Patient = Depends(get_current_patient)):
    links = (
        db.query(CaregiverPatientLink)
        .filter(CaregiverPatientLink.patient_id == patient.id)
        .order_by(CaregiverPatientLink.created_at.desc())
        .all()
    )
    return [
        CaregiverResponse(
            id=link.caregiver.id,
            name=link.caregiver.name,
            email=link.caregiver.email,
            phone=link.caregiver.phone,
            relationship_label=link.relationship_label,
            has_registered=bool(link.caregiver.password_hash),
            claim_code=link.caregiver.claim_code if not link.caregiver.password_hash else None,
        )
        for link in links
    ]


@router.post("/patients/me/caregivers", response_model=CaregiverResponse, status_code=status.HTTP_201_CREATED)
def add_caregiver(
    payload: CaregiverLinkRequest,
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    caregiver = db.query(Caregiver).filter(Caregiver.email == payload.email).first()
    if not caregiver:
        caregiver = Caregiver(name=payload.name, email=payload.email, phone=payload.phone, claim_code=generate_claim_code())
        db.add(caregiver)
        db.flush()
    elif not caregiver.password_hash and not caregiver.claim_code:
        caregiver.claim_code = generate_claim_code()

    existing_link = (
        db.query(CaregiverPatientLink)
        .filter(CaregiverPatientLink.caregiver_id == caregiver.id, CaregiverPatientLink.patient_id == patient.id)
        .first()
    )
    if existing_link:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This person already has access")

    link = CaregiverPatientLink(
        caregiver_id=caregiver.id,
        patient_id=patient.id,
        relationship_label=payload.relationship_label,
    )
    db.add(link)
    db.commit()
    db.refresh(caregiver)

    return CaregiverResponse(
        id=caregiver.id,
        name=caregiver.name,
        email=caregiver.email,
        phone=caregiver.phone,
        relationship_label=link.relationship_label,
        has_registered=bool(caregiver.password_hash),
        claim_code=caregiver.claim_code if not caregiver.password_hash else None,
    )


@router.delete("/patients/me/caregivers/{caregiver_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_caregiver(
    caregiver_id: str,
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_current_patient),
):
    link = (
        db.query(CaregiverPatientLink)
        .filter(CaregiverPatientLink.caregiver_id == caregiver_id, CaregiverPatientLink.patient_id == patient.id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access record not found")
    db.delete(link)
    db.commit()


def _get_linked_patient(patient_id: str, caregiver: Caregiver, db: Session) -> Patient:
    link = (
        db.query(CaregiverPatientLink)
        .filter(CaregiverPatientLink.caregiver_id == caregiver.id, CaregiverPatientLink.patient_id == patient_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return link.patient


@router.get("/caregiver/patients", response_model=list[CaregiverPatientResponse])
def list_linked_patients(db: Session = Depends(get_db), caregiver: Caregiver = Depends(get_current_caregiver)):
    links = (
        db.query(CaregiverPatientLink)
        .filter(CaregiverPatientLink.caregiver_id == caregiver.id)
        .order_by(CaregiverPatientLink.created_at.desc())
        .all()
    )
    return [
        CaregiverPatientResponse(
            id=link.patient.id,
            name=link.patient.name,
            age=link.patient.age,
            gender=link.patient.gender,
            relationship_label=link.relationship_label,
        )
        for link in links
    ]


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


@router.get("/caregiver/patients/{patient_id}/prescriptions", response_model=list[PrescriptionDetailResponse])
def list_patient_prescriptions_for_caregiver(
    patient_id: str,
    db: Session = Depends(get_db),
    caregiver: Caregiver = Depends(get_current_caregiver),
):
    patient = _get_linked_patient(patient_id, caregiver, db)
    prescriptions = (
        db.query(Prescription)
        .join(Prescription.consultation)
        .filter(Prescription.consultation.has(patient_id=patient.id))
        .order_by(Prescription.created_at.desc())
        .all()
    )
    return [_to_detail(p) for p in prescriptions]


@router.get(
    "/caregiver/patients/{patient_id}/prescriptions/{prescription_id}",
    response_model=PrescriptionDetailResponse,
)
def patient_prescription_detail_for_caregiver(
    patient_id: str,
    prescription_id: str,
    db: Session = Depends(get_db),
    caregiver: Caregiver = Depends(get_current_caregiver),
):
    _get_linked_patient(patient_id, caregiver, db)
    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.consultation.patient_id != patient_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")
    return _to_detail(prescription)


@router.get("/caregiver/patients/{patient_id}/prescriptions/{prescription_id}/audio")
@limiter.limit("20/hour")
def patient_prescription_audio_for_caregiver(
    request: Request,
    patient_id: str,
    prescription_id: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    caregiver: Caregiver = Depends(get_current_caregiver),
):
    if lang not in ("en", "hi"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lang must be 'en' or 'hi'")

    _get_linked_patient(patient_id, caregiver, db)
    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.consultation.patient_id != patient_id:
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


@router.get("/caregiver/patients/{patient_id}/prescriptions/{prescription_id}/pdf")
def patient_prescription_pdf_for_caregiver(
    patient_id: str,
    prescription_id: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    caregiver: Caregiver = Depends(get_current_caregiver),
):
    if lang not in ("en", "hi"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lang must be 'en' or 'hi'")

    _get_linked_patient(patient_id, caregiver, db)
    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.consultation.patient_id != patient_id:
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
