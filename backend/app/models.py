import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class ConsultationStatus(str, enum.Enum):
    recording = "recording"
    transcribing = "transcribing"
    transcript_ready = "transcript_ready"
    generating = "generating"
    drafted = "drafted"
    sent = "sent"


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    specialization: Mapped[str] = mapped_column(String(255), nullable=False)
    clinic: Mapped[str] = mapped_column(String(255), nullable=False)
    reg_no: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    consultations: Mapped[list["Consultation"]] = relationship(back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    claim_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    known_allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    consultations: Mapped[list["Consultation"]] = relationship(back_populates="patient")
    caregiver_links: Mapped[list["CaregiverPatientLink"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )


class Caregiver(Base):
    __tablename__ = "caregivers"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    claim_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient_links: Mapped[list["CaregiverPatientLink"]] = relationship(
        back_populates="caregiver", cascade="all, delete-orphan"
    )


class CaregiverPatientLink(Base):
    __tablename__ = "caregiver_patient_links"
    __table_args__ = (UniqueConstraint("caregiver_id", "patient_id", name="uq_caregiver_patient"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    caregiver_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("caregivers.id"), nullable=False)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    relationship_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    caregiver: Mapped["Caregiver"] = relationship(back_populates="patient_links")
    patient: Mapped["Patient"] = relationship(back_populates="caregiver_links")


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    doctor_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    status: Mapped[ConsultationStatus] = mapped_column(
        Enum(ConsultationStatus, name="consultation_status"),
        nullable=False,
        default=ConsultationStatus.recording,
    )
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transcript_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    doctor: Mapped["Doctor"] = relationship(back_populates="consultations")
    patient: Mapped["Patient"] = relationship(back_populates="consultations")
    prescription: Mapped["Prescription | None"] = relationship(
        back_populates="consultation", uselist=False, cascade="all, delete-orphan"
    )


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    consultation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("consultations.id"), unique=True, nullable=False
    )
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    diet_advice: Mapped[str | None] = mapped_column(Text, nullable=True)
    advice: Mapped[str | None] = mapped_column(Text, nullable=True)
    chief_complaint_hi: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis_hi: Mapped[str | None] = mapped_column(Text, nullable=True)
    diet_advice_hi: Mapped[str | None] = mapped_column(Text, nullable=True)
    advice_hi: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature: Mapped[str | None] = mapped_column(String(50), nullable=True)
    blood_pressure: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pulse: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weight: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    consultation: Mapped["Consultation"] = relationship(back_populates="prescription")
    medicines: Mapped[list["Medicine"]] = relationship(
        back_populates="prescription", cascade="all, delete-orphan", order_by="Medicine.sort_order"
    )
    tests: Mapped[list["Test"]] = relationship(
        back_populates="prescription", cascade="all, delete-orphan", order_by="Test.sort_order"
    )


class Medicine(Base):
    __tablename__ = "medicines"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    prescription_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("prescriptions.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dose: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)
    duration: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_inferred: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    timing: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timing_when: Mapped[str | None] = mapped_column(String(50), nullable=True)
    frequency_hi: Mapped[str | None] = mapped_column(String(150), nullable=True)
    duration_hi: Mapped[str | None] = mapped_column(String(150), nullable=True)
    timing_hi: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timing_when_hi: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    prescription: Mapped["Prescription"] = relationship(back_populates="medicines")


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    prescription_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("prescriptions.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    instructions: Mapped[str | None] = mapped_column(String(255), nullable=True)
    instructions_hi: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    prescription: Mapped["Prescription"] = relationship(back_populates="tests")


class PrescriptionAudio(Base):
    __tablename__ = "prescription_audio"
    __table_args__ = (UniqueConstraint("prescription_id", "lang", name="uq_prescription_audio_lang"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    prescription_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("prescriptions.id"), nullable=False
    )
    lang: Mapped[str] = mapped_column(String(5), nullable=False)
    audio_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
