from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ConsultationStatus

Role = Literal["doctor", "patient", "caregiver"]


# ---------- Auth ----------


class DoctorRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    specialization: str
    clinic: str
    reg_no: str
    phone: str


class PatientRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    claim_code: str | None = None
    phone: str | None = None
    age: int | None = None
    gender: str | None = None
    known_allergies: str | None = None


class CaregiverRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    claim_code: str | None = None
    phone: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Role


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    user: "MeResponse"


class MeResponse(BaseModel):
    id: str
    name: str
    email: str | None = None
    role: Role
    specialization: str | None = None
    clinic: str | None = None
    reg_no: str | None = None
    phone: str | None = None
    age: int | None = None
    gender: str | None = None
    known_allergies: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    phone: str | None = None
    specialization: str | None = None
    clinic: str | None = None
    age: int | None = None
    gender: str | None = None
    known_allergies: str | None = None


# ---------- Patients ----------


class PatientCreateRequest(BaseModel):
    name: str
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    known_allergies: str | None = None


class PatientAllergyUpdateRequest(BaseModel):
    known_allergies: str


class PatientResponse(BaseModel):
    id: str
    name: str
    email: str | None = None
    phone: str | None = None
    age: int | None = None
    gender: str | None = None
    known_allergies: str | None = None
    claim_code: str | None = None


class PatientHistoryMedicine(BaseModel):
    name: str
    dose: str
    duration: str


class PatientHistoryItem(BaseModel):
    consultation_id: str
    date: datetime
    doctor_name: str
    chief_complaint: str | None = None
    diagnosis: str | None = None
    medicines: list[PatientHistoryMedicine] = []


# ---------- Caregivers ----------


class CaregiverLinkRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    relationship_label: str | None = None


class CaregiverResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str | None = None
    relationship_label: str | None = None
    has_registered: bool = False
    claim_code: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CaregiverPatientResponse(BaseModel):
    id: str
    name: str
    age: int | None = None
    gender: str | None = None
    relationship_label: str | None = None

    model_config = ConfigDict(from_attributes=True)

    model_config = ConfigDict(from_attributes=True)


# ---------- Medicines ----------


class MedicineItem(BaseModel):
    name: str
    dose: str
    freq: str
    duration: str
    durationInferred: bool = False
    timing: str = ""
    timingWhen: str = ""


class MedicineResponse(BaseModel):
    id: str
    name: str
    dose: str
    frequency: str
    duration: str
    duration_inferred: bool = False
    timing: str | None = None
    timing_when: str | None = None
    frequency_hi: str | None = None
    duration_hi: str | None = None
    timing_hi: str | None = None
    timing_when_hi: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TestItem(BaseModel):
    name: str
    instructions: str = ""


class TestResponse(BaseModel):
    id: str
    name: str
    instructions: str | None = None
    instructions_hi: str | None = None

    model_config = ConfigDict(from_attributes=True)


class VitalsItem(BaseModel):
    temperature: str = ""
    bloodPressure: str = ""
    pulse: str = ""
    weight: str = ""


# ---------- LLM structured output ----------


class PrescriptionDraft(BaseModel):
    chiefComplaint: str
    diagnosis: str
    vitals: VitalsItem
    medicines: list[MedicineItem]
    tests: list[TestItem]
    dietAdvice: str
    advice: str
    newAllergyMentioned: str = ""


class MedicineTranslation(BaseModel):
    freqHi: str
    durationHi: str
    timingHi: str
    timingWhenHi: str


class TestTranslation(BaseModel):
    instructionsHi: str


class PrescriptionTranslation(BaseModel):
    chiefComplaintHi: str
    diagnosisHi: str
    medicines: list[MedicineTranslation]
    tests: list[TestTranslation]
    dietAdviceHi: str
    adviceHi: str


# ---------- Prescriptions ----------


class PrescriptionUpdateRequest(BaseModel):
    chiefComplaint: str
    diagnosis: str
    vitals: VitalsItem = VitalsItem()
    medicines: list[MedicineItem]
    tests: list[TestItem] = []
    dietAdvice: str = ""
    advice: str


class PrescriptionResponse(BaseModel):
    id: str
    chief_complaint: str | None = None
    diagnosis: str | None = None
    diet_advice: str | None = None
    advice: str | None = None
    chief_complaint_hi: str | None = None
    diagnosis_hi: str | None = None
    diet_advice_hi: str | None = None
    advice_hi: str | None = None
    temperature: str | None = None
    blood_pressure: str | None = None
    pulse: str | None = None
    weight: str | None = None
    medicines: list[MedicineResponse] = []
    tests: list[TestResponse] = []
    created_at: datetime
    new_allergy_mentioned: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PrescriptionDetailResponse(PrescriptionResponse):
    doctor_name: str
    doctor_specialization: str
    doctor_clinic: str
    doctor_reg_no: str
    patient_name: str
    patient_age: int | None = None
    patient_gender: str | None = None
    patient_known_allergies: str | None = None


# ---------- Consultations ----------


class ConsultationCreateRequest(BaseModel):
    patient_id: str


class ConsultationResponse(BaseModel):
    id: str
    doctor_id: str
    patient_id: str
    patient_name: str
    patient_age: int | None = None
    patient_gender: str | None = None
    patient_known_allergies: str | None = None
    status: ConsultationStatus
    transcript_text: str | None = None
    created_at: datetime
    updated_at: datetime
    prescription: PrescriptionResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class TranscriptUpdateRequest(BaseModel):
    transcript_text: str


class TranscribeResponse(BaseModel):
    transcript_text: str


TokenResponse.model_rebuild()
