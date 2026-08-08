from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_doctor
from app.database import get_db
from app.limiter import limiter
from app.models import Consultation, ConsultationStatus, Doctor, Medicine, Patient, Prescription, Test
from app.schemas import (
    ConsultationCreateRequest,
    ConsultationResponse,
    MedicineItem,
    PrescriptionResponse,
    PrescriptionUpdateRequest,
    TestItem,
    TranscribeResponse,
    TranscriptUpdateRequest,
)
from app.services.openai_client import (
    DraftGenerationError,
    TranscriptionError,
    TranslationError,
    draft_prescription,
    transcribe,
    translate_to_hindi,
)

router = APIRouter(prefix="/consultations", tags=["consultations"])

MAX_AUDIO_BYTES = 20 * 1024 * 1024  # 20MB - comfortably under Whisper's 25MB limit, blocks runaway uploads


def _to_response(consultation: Consultation) -> ConsultationResponse:
    return ConsultationResponse(
        id=consultation.id,
        doctor_id=consultation.doctor_id,
        patient_id=consultation.patient_id,
        patient_name=consultation.patient.name,
        patient_age=consultation.patient.age,
        patient_gender=consultation.patient.gender,
        patient_known_allergies=consultation.patient.known_allergies,
        status=consultation.status,
        transcript_text=consultation.transcript_text,
        created_at=consultation.created_at,
        updated_at=consultation.updated_at,
        prescription=consultation.prescription,
    )


def _get_owned_consultation(consultation_id: str, doctor: Doctor, db: Session) -> Consultation:
    consultation = db.get(Consultation, consultation_id)
    if not consultation or consultation.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return consultation


@router.get("", response_model=list[ConsultationResponse])
def list_consultations(db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_doctor)):
    consultations = (
        db.query(Consultation)
        .filter(Consultation.doctor_id == doctor.id)
        .order_by(Consultation.created_at.desc())
        .all()
    )
    return [_to_response(c) for c in consultations]


@router.post("", response_model=ConsultationResponse, status_code=status.HTTP_201_CREATED)
def create_consultation(
    payload: ConsultationCreateRequest,
    db: Session = Depends(get_db),
    doctor: Doctor = Depends(get_current_doctor),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    consultation = Consultation(
        doctor_id=doctor.id,
        patient_id=patient.id,
        status=ConsultationStatus.recording,
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)
    return _to_response(consultation)


@router.delete("/{consultation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consultation(
    consultation_id: str,
    db: Session = Depends(get_db),
    doctor: Doctor = Depends(get_current_doctor),
):
    consultation = _get_owned_consultation(consultation_id, doctor, db)
    if consultation.status == ConsultationStatus.sent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A prescription that's already been sent to the patient can't be deleted.",
        )
    db.delete(consultation)
    db.commit()


@router.post("/{consultation_id}/transcribe", response_model=TranscribeResponse)
@limiter.limit("20/hour")
def transcribe_consultation(
    request: Request,
    consultation_id: str,
    audio: UploadFile,
    db: Session = Depends(get_db),
    doctor: Doctor = Depends(get_current_doctor),
):
    consultation = _get_owned_consultation(consultation_id, doctor, db)

    audio_bytes = audio.file.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No audio data received")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Recording is too long to transcribe. Please keep consultations under about 10 minutes.",
        )

    consultation.status = ConsultationStatus.transcribing
    db.commit()

    try:
        transcript_text = transcribe(audio_bytes, filename=audio.filename or "audio.webm")
    except TranscriptionError as exc:
        consultation.status = ConsultationStatus.recording
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Couldn't transcribe the recording: {exc}",
        )

    consultation.transcript_text = transcript_text
    consultation.status = ConsultationStatus.transcript_ready
    db.commit()

    return TranscribeResponse(transcript_text=transcript_text)


@router.patch("/{consultation_id}/transcript", response_model=ConsultationResponse)
def update_transcript(
    consultation_id: str,
    payload: TranscriptUpdateRequest,
    db: Session = Depends(get_db),
    doctor: Doctor = Depends(get_current_doctor),
):
    consultation = _get_owned_consultation(consultation_id, doctor, db)
    consultation.transcript_text = payload.transcript_text
    db.commit()
    db.refresh(consultation)
    return _to_response(consultation)


@router.post("/{consultation_id}/draft-rx", response_model=PrescriptionResponse)
@limiter.limit("20/hour")
def draft_rx(
    request: Request,
    consultation_id: str,
    db: Session = Depends(get_db),
    doctor: Doctor = Depends(get_current_doctor),
):
    consultation = _get_owned_consultation(consultation_id, doctor, db)
    if not consultation.transcript_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No transcript available yet")

    consultation.status = ConsultationStatus.generating
    db.commit()

    try:
        draft = draft_prescription(consultation.transcript_text)
    except DraftGenerationError as exc:
        consultation.status = ConsultationStatus.transcript_ready
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Couldn't generate a prescription draft: {exc}",
        )

    if consultation.prescription:
        db.delete(consultation.prescription)
        db.flush()

    prescription = Prescription(
        consultation_id=consultation.id,
        chief_complaint=draft.chiefComplaint,
        diagnosis=draft.diagnosis,
        diet_advice=draft.dietAdvice or None,
        advice=draft.advice,
        temperature=draft.vitals.temperature or None,
        blood_pressure=draft.vitals.bloodPressure or None,
        pulse=draft.vitals.pulse or None,
        weight=draft.vitals.weight or None,
    )
    db.add(prescription)
    db.flush()

    for idx, med in enumerate(draft.medicines):
        db.add(
            Medicine(
                prescription_id=prescription.id,
                name=med.name,
                dose=med.dose,
                frequency=med.freq,
                duration=med.duration,
                duration_inferred=med.durationInferred,
                timing=med.timing or None,
                timing_when=med.timingWhen or None,
                sort_order=idx,
            )
        )

    for idx, test in enumerate(draft.tests):
        db.add(
            Test(
                prescription_id=prescription.id,
                name=test.name,
                instructions=test.instructions or None,
                sort_order=idx,
            )
        )

    consultation.status = ConsultationStatus.drafted
    db.commit()
    db.refresh(prescription)

    new_allergy = draft.newAllergyMentioned.strip()
    existing_allergies = (consultation.patient.known_allergies or "").lower()
    prescription.new_allergy_mentioned = new_allergy if new_allergy and new_allergy.lower() not in existing_allergies else None

    return prescription


@router.patch("/{consultation_id}/prescription", response_model=PrescriptionResponse)
def update_prescription(
    consultation_id: str,
    payload: PrescriptionUpdateRequest,
    db: Session = Depends(get_db),
    doctor: Doctor = Depends(get_current_doctor),
):
    consultation = _get_owned_consultation(consultation_id, doctor, db)
    if not consultation.prescription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No draft prescription to edit")
    if consultation.status == ConsultationStatus.sent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This prescription has already been sent to the patient and can no longer be edited.",
        )

    prescription = consultation.prescription
    prescription.chief_complaint = payload.chiefComplaint
    prescription.diagnosis = payload.diagnosis
    prescription.diet_advice = payload.dietAdvice or None
    prescription.advice = payload.advice
    prescription.temperature = payload.vitals.temperature or None
    prescription.blood_pressure = payload.vitals.bloodPressure or None
    prescription.pulse = payload.vitals.pulse or None
    prescription.weight = payload.vitals.weight or None

    for med in list(prescription.medicines):
        db.delete(med)
    for test in list(prescription.tests):
        db.delete(test)
    db.flush()

    for idx, med in enumerate(payload.medicines):
        db.add(
            Medicine(
                prescription_id=prescription.id,
                name=med.name,
                dose=med.dose,
                frequency=med.freq,
                duration=med.duration,
                duration_inferred=med.durationInferred,
                timing=med.timing or None,
                timing_when=med.timingWhen or None,
                sort_order=idx,
            )
        )

    for idx, test in enumerate(payload.tests):
        db.add(
            Test(
                prescription_id=prescription.id,
                name=test.name,
                instructions=test.instructions or None,
                sort_order=idx,
            )
        )

    db.commit()
    db.refresh(prescription)
    return prescription


@router.post("/{consultation_id}/approve", response_model=ConsultationResponse)
def approve_consultation(
    consultation_id: str,
    db: Session = Depends(get_db),
    doctor: Doctor = Depends(get_current_doctor),
):
    consultation = _get_owned_consultation(consultation_id, doctor, db)
    prescription = consultation.prescription
    if not prescription:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No prescription draft to approve")
    if consultation.status == ConsultationStatus.sent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This prescription has already been sent to the patient.",
        )

    try:
        medicines = [
            MedicineItem(
                name=m.name,
                dose=m.dose,
                freq=m.frequency,
                duration=m.duration,
                timing=m.timing or "",
                timingWhen=m.timing_when or "",
            )
            for m in prescription.medicines
        ]
        tests = [TestItem(name=t.name, instructions=t.instructions or "") for t in prescription.tests]
        translation = translate_to_hindi(
            chief_complaint=prescription.chief_complaint or "",
            diagnosis=prescription.diagnosis or "",
            diet_advice=prescription.diet_advice or "",
            advice=prescription.advice or "",
            medicines=medicines,
            tests=tests,
        )
        prescription.chief_complaint_hi = translation.chiefComplaintHi
        prescription.diagnosis_hi = translation.diagnosisHi
        prescription.diet_advice_hi = translation.dietAdviceHi
        prescription.advice_hi = translation.adviceHi
        for med, med_hi in zip(prescription.medicines, translation.medicines):
            med.frequency_hi = med_hi.freqHi
            med.duration_hi = med_hi.durationHi
            med.timing_hi = med_hi.timingHi
            med.timing_when_hi = med_hi.timingWhenHi
        for test, test_hi in zip(prescription.tests, translation.tests):
            test.instructions_hi = test_hi.instructionsHi
    except TranslationError:
        # Hindi translation is a nice-to-have overlay; don't block sending the prescription if it fails.
        pass

    consultation.status = ConsultationStatus.sent
    db.commit()
    db.refresh(consultation)
    return _to_response(consultation)
