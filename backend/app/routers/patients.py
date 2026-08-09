from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_doctor
from app.database import get_db
from app.models import Consultation, ConsultationStatus, Doctor, Patient
from app.schemas import (
    PatientAllergyUpdateRequest,
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
    if payload.email:
        existing = db.query(Patient).filter(Patient.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A patient with this email already exists")

    patient = Patient(
        name=payload.name,
        age=payload.age,
        gender=payload.gender,
        phone=payload.phone,
        email=payload.email,
        known_allergies=payload.known_allergies,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.patch("/patients/{patient_id}/allergies", response_model=PatientResponse)
def update_patient_allergies(
    patient_id: str,
    payload: PatientAllergyUpdateRequest,
    db: Session = Depends(get_db),
    _doctor: Doctor = Depends(get_current_doctor),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    patient.known_allergies = payload.known_allergies
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
