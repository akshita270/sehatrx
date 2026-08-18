from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import get_current_caregiver, get_current_patient
from app.database import get_db
from app.limiter import limiter
from app.models import Caregiver, CaregiverPatientLink, Patient
from app.schemas import CaregiverLinkRequest, CaregiverPatientResponse, CaregiverResponse, PrescriptionDetailResponse
from app.services.pdf_builder import build_prescription_pdf
from app.services.prescription_access import (
    ensure_lang_available,
    get_or_create_audio,
    get_sent_prescription_for_patient,
    list_sent_prescriptions_for_patient,
    to_prescription_detail,
)

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
        caregiver = Caregiver(name=payload.name, email=payload.email, phone=payload.phone)
        db.add(caregiver)
        db.flush()

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


@router.get("/caregiver/patients/{patient_id}/prescriptions", response_model=list[PrescriptionDetailResponse])
def list_patient_prescriptions_for_caregiver(
    patient_id: str,
    db: Session = Depends(get_db),
    caregiver: Caregiver = Depends(get_current_caregiver),
):
    patient = _get_linked_patient(patient_id, caregiver, db)
    prescriptions = list_sent_prescriptions_for_patient(db, patient.id)
    return [to_prescription_detail(p) for p in prescriptions]


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
    patient = _get_linked_patient(patient_id, caregiver, db)
    prescription = get_sent_prescription_for_patient(db, prescription_id, patient.id)
    return to_prescription_detail(prescription)


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
    patient = _get_linked_patient(patient_id, caregiver, db)
    prescription = get_sent_prescription_for_patient(db, prescription_id, patient.id)
    ensure_lang_available(prescription, lang)
    audio_bytes = get_or_create_audio(db, prescription, lang)
    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.get("/caregiver/patients/{patient_id}/prescriptions/{prescription_id}/pdf")
def patient_prescription_pdf_for_caregiver(
    patient_id: str,
    prescription_id: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    caregiver: Caregiver = Depends(get_current_caregiver),
):
    patient = _get_linked_patient(patient_id, caregiver, db)
    prescription = get_sent_prescription_for_patient(db, prescription_id, patient.id)
    ensure_lang_available(prescription, lang)
    pdf_bytes = build_prescription_pdf(prescription, lang)
    filename = f"prescription-{prescription.created_at.strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
