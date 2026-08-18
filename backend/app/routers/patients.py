from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth import get_current_doctor
from app.database import get_db
from app.models import Consultation, ConsultationStatus, Doctor, Patient, Prescription
from app.schemas import (
    PatientCreateRequest,
    PatientHistoryItem,
    PatientHistoryMedicine,
    PatientResponse,
)

router = APIRouter(tags=["patients"])


@router.get("/patients", response_model=list[PatientResponse])
def list_patients(
    q: str | None = None,
    db: Session = Depends(get_db),
    _doctor: Doctor = Depends(get_current_doctor),
):
    query = db.query(Patient)
    if q:
        query = query.filter(Patient.name.ilike(f"%{q}%"))
    return query.order_by(Patient.name).all()


@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreateRequest,
    db: Session = Depends(get_db),
    _doctor: Doctor = Depends(get_current_doctor),
):
    existing = None
    if payload.email:
        existing = db.query(Patient).filter(Patient.email == payload.email).first()
    if not existing and payload.phone:
        existing = db.query(Patient).filter(Patient.phone == payload.phone).first()

    if existing:
        # Same patient seen again (possibly by a different doctor) - reuse their record
        # instead of creating a disconnected duplicate with no history.
        existing.name = payload.name or existing.name
        existing.age = payload.age or existing.age
        existing.gender = payload.gender or existing.gender
        existing.phone = payload.phone or existing.phone
        existing.email = payload.email or existing.email
        db.commit()
        db.refresh(existing)
        return existing

    patient = Patient(
        name=payload.name,
        age=payload.age,
        gender=payload.gender,
        phone=payload.phone,
        email=payload.email,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/patients/{patient_id}/history", response_model=list[PatientHistoryItem])
def patient_history(
    patient_id: str,
    db: Session = Depends(get_db),
    _doctor: Doctor = Depends(get_current_doctor),
):
    """Past sent prescriptions for a patient, across every doctor who has seen them."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    consultations = (
        db.query(Consultation)
        .options(
            joinedload(Consultation.doctor),
            joinedload(Consultation.prescription).selectinload(Prescription.medicines),
        )
        .filter(
            Consultation.patient_id == patient_id,
            Consultation.status == ConsultationStatus.sent,
        )
        .order_by(Consultation.created_at.desc())
        .all()
    )

    return [
        PatientHistoryItem(
            consultation_id=c.id,
            date=c.created_at,
            doctor_name=c.doctor.name,
            chief_complaint=c.prescription.chief_complaint if c.prescription else None,
            diagnosis=c.prescription.diagnosis if c.prescription else None,
            medicines=[
                PatientHistoryMedicine(name=m.name, dose=m.dose, duration=m.duration)
                for m in (c.prescription.medicines if c.prescription else [])
            ],
        )
        for c in consultations
    ]
