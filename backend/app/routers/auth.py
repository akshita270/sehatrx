from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import (
    CurrentUser,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models import Caregiver, Doctor, Patient
from app.schemas import (
    CaregiverRegisterRequest,
    DoctorRegisterRequest,
    LoginRequest,
    MeResponse,
    PatientRegisterRequest,
    ProfileUpdateRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _doctor_to_me(doctor: Doctor) -> MeResponse:
    return MeResponse(
        id=doctor.id,
        name=doctor.name,
        email=doctor.email,
        role="doctor",
        specialization=doctor.specialization,
        clinic=doctor.clinic,
        reg_no=doctor.reg_no,
        phone=doctor.phone,
    )


def _patient_to_me(patient: Patient) -> MeResponse:
    return MeResponse(
        id=patient.id,
        name=patient.name,
        email=patient.email,
        role="patient",
        phone=patient.phone,
        age=patient.age,
        gender=patient.gender,
        known_allergies=patient.known_allergies,
    )


def _caregiver_to_me(caregiver: Caregiver) -> MeResponse:
    return MeResponse(
        id=caregiver.id,
        name=caregiver.name,
        email=caregiver.email,
        role="caregiver",
        phone=caregiver.phone,
    )


@router.post("/register/doctor", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_doctor(payload: DoctorRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Doctor).filter(Doctor.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    doctor = Doctor(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        specialization=payload.specialization,
        clinic=payload.clinic,
        reg_no=payload.reg_no,
        phone=payload.phone,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    token = create_access_token(doctor.id, "doctor")
    return TokenResponse(access_token=token, role="doctor", user=_doctor_to_me(doctor))


@router.post("/register/patient", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientRegisterRequest, db: Session = Depends(get_db)):
    existing = None
    if payload.email:
        existing = db.query(Patient).filter(Patient.email == payload.email).first()
    if not existing and payload.phone:
        existing = db.query(Patient).filter(Patient.phone == payload.phone).first()

    if existing:
        if existing.password_hash:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already registered - try signing in instead")
        # A doctor already added this person as a walk-in (e.g. from a visit) - link
        # this registration to that existing record instead of creating a duplicate.
        existing.email = payload.email or existing.email
        existing.password_hash = hash_password(payload.password)
        existing.phone = payload.phone or existing.phone
        existing.age = payload.age or existing.age
        existing.gender = payload.gender or existing.gender
        existing.known_allergies = payload.known_allergies or existing.known_allergies
        db.commit()
        db.refresh(existing)
        token = create_access_token(existing.id, "patient")
        return TokenResponse(access_token=token, role="patient", user=_patient_to_me(existing))

    patient = Patient(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        age=payload.age,
        gender=payload.gender,
        known_allergies=payload.known_allergies,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    token = create_access_token(patient.id, "patient")
    return TokenResponse(access_token=token, role="patient", user=_patient_to_me(patient))


@router.post("/register/caregiver", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_caregiver(payload: CaregiverRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Caregiver).filter(Caregiver.email == payload.email).first()
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No family member access request found for this email. Ask the patient to add you first "
            "from their portal, then register with the same email.",
        )
    if existing.password_hash:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    existing.name = payload.name
    existing.password_hash = hash_password(payload.password)
    existing.phone = payload.phone or existing.phone
    db.commit()
    db.refresh(existing)

    token = create_access_token(existing.id, "caregiver")
    return TokenResponse(access_token=token, role="caregiver", user=_caregiver_to_me(existing))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if payload.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.email == payload.identifier).first()
        if not doctor or not verify_password(payload.password, doctor.password_hash):
            raise invalid
        token = create_access_token(doctor.id, "doctor")
        return TokenResponse(access_token=token, role="doctor", user=_doctor_to_me(doctor))

    if payload.role == "caregiver":
        caregiver = db.query(Caregiver).filter(Caregiver.email == payload.identifier).first()
        if not caregiver or not caregiver.password_hash or not verify_password(payload.password, caregiver.password_hash):
            raise invalid
        token = create_access_token(caregiver.id, "caregiver")
        return TokenResponse(access_token=token, role="caregiver", user=_caregiver_to_me(caregiver))

    # Patients may have registered with an email, a phone number, or both.
    patient = (
        db.query(Patient)
        .filter((Patient.email == payload.identifier) | (Patient.phone == payload.identifier))
        .first()
    )
    if not patient or not patient.password_hash or not verify_password(payload.password, patient.password_hash):
        raise invalid
    token = create_access_token(patient.id, "patient")
    return TokenResponse(access_token=token, role="patient", user=_patient_to_me(patient))


@router.get("/me", response_model=MeResponse)
def me(current_user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "doctor":
        doctor = db.get(Doctor, current_user.id)
        if not doctor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
        return _doctor_to_me(doctor)

    if current_user.role == "caregiver":
        caregiver = db.get(Caregiver, current_user.id)
        if not caregiver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found")
        return _caregiver_to_me(caregiver)

    patient = db.get(Patient, current_user.id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return _patient_to_me(patient)


@router.patch("/me", response_model=MeResponse)
def update_me(
    payload: ProfileUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "doctor":
        doctor = db.get(Doctor, current_user.id)
        if not doctor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
        if payload.name is not None:
            doctor.name = payload.name
        if payload.phone is not None:
            doctor.phone = payload.phone
        if payload.specialization is not None:
            doctor.specialization = payload.specialization
        if payload.clinic is not None:
            doctor.clinic = payload.clinic
        db.commit()
        db.refresh(doctor)
        return _doctor_to_me(doctor)

    if current_user.role == "caregiver":
        caregiver = db.get(Caregiver, current_user.id)
        if not caregiver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found")
        if payload.name is not None:
            caregiver.name = payload.name
        if payload.phone is not None:
            caregiver.phone = payload.phone
        db.commit()
        db.refresh(caregiver)
        return _caregiver_to_me(caregiver)

    patient = db.get(Patient, current_user.id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    if payload.name is not None:
        patient.name = payload.name
    if payload.phone is not None:
        patient.phone = payload.phone
    if payload.age is not None:
        patient.age = payload.age
    if payload.gender is not None:
        patient.gender = payload.gender
    if payload.known_allergies is not None:
        patient.known_allergies = payload.known_allergies
    db.commit()
    db.refresh(patient)
    return _patient_to_me(patient)
