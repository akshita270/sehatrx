from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_doctor
from app.database import get_db
from app.models import Doctor, Patient
from app.schemas import PatientAllergyUpdateRequest, PatientCreateRequest, PatientResponse

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
