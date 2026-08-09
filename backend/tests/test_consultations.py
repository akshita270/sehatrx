from app.schemas import MedicineItem, MedicineTranslation, PrescriptionDraft, PrescriptionTranslation, VitalsItem
from app.schemas import TestTranslation as TranslationForTest
from tests.conftest import auth_header


def _fake_draft_prescription(transcript_text: str) -> PrescriptionDraft:
    return PrescriptionDraft(
        chiefComplaint="Fever for three days",
        diagnosis="Viral fever",
        vitals=VitalsItem(),
        medicines=[MedicineItem(name="Paracetamol", dose="500mg", freq="Twice daily", duration="5 days")],
        tests=[],
        dietAdvice="Bland diet, khichdi.",
        advice="Rest and fluids.",
    )


def _fake_translate_to_hindi(**kwargs) -> PrescriptionTranslation:
    medicines = kwargs.get("medicines", [])
    tests = kwargs.get("tests", [])
    return PrescriptionTranslation(
        chiefComplaintHi="बुखार",
        diagnosisHi="वायरल बुखार",
        medicines=[
            MedicineTranslation(freqHi="test", durationHi="test", timingHi="", timingWhenHi="") for _ in medicines
        ],
        tests=[TranslationForTest(instructionsHi="") for _ in tests],
        dietAdviceHi="हल्का भोजन, खिचड़ी।",
        adviceHi="आराम करें",
    )


def _fake_draft_prescription_with_allergy(allergy_text):
    def _inner(transcript_text: str) -> PrescriptionDraft:
        return PrescriptionDraft(
            chiefComplaint="Fever for three days",
            diagnosis="Viral fever",
            vitals=VitalsItem(),
            medicines=[MedicineItem(name="Paracetamol", dose="500mg", freq="Twice daily", duration="5 days")],
            tests=[],
            dietAdvice="Bland diet, khichdi.",
            advice="Rest and fluids.",
            newAllergyMentioned=allergy_text,
        )

    return _inner


def _create_and_send_prescription(client, monkeypatch, doctor_token):
    monkeypatch.setattr("app.routers.consultations.draft_prescription", _fake_draft_prescription)
    monkeypatch.setattr("app.routers.consultations.translate_to_hindi", _fake_translate_to_hindi)

    headers = auth_header(doctor_token)
    patient = client.post("/patients", json={"name": "Sent Flow Patient", "age": 30}, headers=headers)
    consultation_id = client.post("/consultations", json={"patient_id": patient.json()["id"]}, headers=headers).json()["id"]

    client.patch(
        f"/consultations/{consultation_id}/transcript",
        json={"transcript_text": "Doctor and patient discuss fever."},
        headers=headers,
    )
    draft = client.post(f"/consultations/{consultation_id}/draft-rx", json={}, headers=headers)
    assert draft.status_code == 200, draft.text

    approve = client.post(f"/consultations/{consultation_id}/approve", json={}, headers=headers)
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] == "sent"

    return consultation_id


def test_prescription_cannot_be_edited_after_sending(client, monkeypatch, register_doctor):
    doctor = register_doctor(email="lock-edit@example.com")
    consultation_id = _create_and_send_prescription(client, monkeypatch, doctor)
    headers = auth_header(doctor)

    tamper = client.patch(
        f"/consultations/{consultation_id}/prescription",
        json={
            "chiefComplaint": "TAMPERED",
            "diagnosis": "TAMPERED",
            "vitals": {"temperature": "", "bloodPressure": "", "pulse": "", "weight": ""},
            "medicines": [],
            "tests": [],
            "advice": "TAMPERED",
        },
        headers=headers,
    )
    assert tamper.status_code == 409

    unchanged = client.get("/consultations", headers=headers)
    match = next(c for c in unchanged.json() if c["id"] == consultation_id)
    assert match["prescription"]["chief_complaint"] == "Fever for three days"


def test_prescription_cannot_be_approved_twice(client, monkeypatch, register_doctor):
    doctor = register_doctor(email="lock-approve@example.com")
    consultation_id = _create_and_send_prescription(client, monkeypatch, doctor)
    headers = auth_header(doctor)

    second_approve = client.post(f"/consultations/{consultation_id}/approve", json={}, headers=headers)
    assert second_approve.status_code == 409


def test_sent_consultation_cannot_be_deleted(client, monkeypatch, register_doctor):
    doctor = register_doctor(email="lock-delete@example.com")
    consultation_id = _create_and_send_prescription(client, monkeypatch, doctor)
    headers = auth_header(doctor)

    delete = client.delete(f"/consultations/{consultation_id}", headers=headers)
    assert delete.status_code == 409

    still_there = client.get("/consultations", headers=headers)
    assert any(c["id"] == consultation_id for c in still_there.json())


def test_unsent_consultation_can_be_deleted(client, register_doctor):
    doctor = register_doctor(email="delete-ok@example.com")
    headers = auth_header(doctor)

    patient = client.post("/patients", json={"name": "Abandoned Patient"}, headers=headers)
    consultation_id = client.post("/consultations", json={"patient_id": patient.json()["id"]}, headers=headers).json()["id"]

    delete = client.delete(f"/consultations/{consultation_id}", headers=headers)
    assert delete.status_code == 204

    after = client.get("/consultations", headers=headers)
    assert all(c["id"] != consultation_id for c in after.json())


def test_transcribe_rejects_oversized_audio(client, register_doctor):
    doctor = register_doctor(email="oversized-audio@example.com")
    headers = auth_header(doctor)

    patient = client.post("/patients", json={"name": "Audio Size Patient"}, headers=headers)
    consultation_id = client.post("/consultations", json={"patient_id": patient.json()["id"]}, headers=headers).json()["id"]

    oversized_audio = b"0" * (21 * 1024 * 1024)  # just over the 20MB cap
    res = client.post(
        f"/consultations/{consultation_id}/transcribe",
        files={"audio": ("consultation.webm", oversized_audio, "audio/webm")},
        headers=headers,
    )
    assert res.status_code == 413


def test_draft_rx_flags_new_allergy_mention(client, monkeypatch, register_doctor):
    doctor = register_doctor(email="allergy-new@example.com")
    monkeypatch.setattr(
        "app.routers.consultations.draft_prescription", _fake_draft_prescription_with_allergy("Penicillin")
    )
    headers = auth_header(doctor)

    patient = client.post("/patients", json={"name": "Allergy Patient", "age": 40}, headers=headers)
    consultation_id = client.post(
        "/consultations", json={"patient_id": patient.json()["id"]}, headers=headers
    ).json()["id"]
    client.patch(
        f"/consultations/{consultation_id}/transcript",
        json={"transcript_text": "Patient mentions penicillin allergy."},
        headers=headers,
    )

    draft = client.post(f"/consultations/{consultation_id}/draft-rx", json={}, headers=headers)
    assert draft.status_code == 200, draft.text
    assert draft.json()["new_allergy_mentioned"] == "Penicillin"


def test_draft_rx_does_not_flag_already_known_allergy(client, monkeypatch, register_doctor):
    doctor = register_doctor(email="allergy-known@example.com")
    monkeypatch.setattr(
        "app.routers.consultations.draft_prescription", _fake_draft_prescription_with_allergy("Penicillin")
    )
    headers = auth_header(doctor)

    patient = client.post(
        "/patients",
        json={"name": "Already Known Allergy Patient", "age": 40, "known_allergies": "Penicillin"},
        headers=headers,
    )
    consultation_id = client.post(
        "/consultations", json={"patient_id": patient.json()["id"]}, headers=headers
    ).json()["id"]
    client.patch(
        f"/consultations/{consultation_id}/transcript",
        json={"transcript_text": "Patient mentions penicillin allergy again."},
        headers=headers,
    )

    draft = client.post(f"/consultations/{consultation_id}/draft-rx", json={}, headers=headers)
    assert draft.status_code == 200, draft.text
    assert draft.json()["new_allergy_mentioned"] is None


def test_draft_rx_no_allergy_mentioned(client, monkeypatch, register_doctor):
    doctor = register_doctor(email="allergy-none@example.com")
    monkeypatch.setattr("app.routers.consultations.draft_prescription", _fake_draft_prescription)
    headers = auth_header(doctor)

    patient = client.post("/patients", json={"name": "No Allergy Patient", "age": 40}, headers=headers)
    consultation_id = client.post(
        "/consultations", json={"patient_id": patient.json()["id"]}, headers=headers
    ).json()["id"]
    client.patch(
        f"/consultations/{consultation_id}/transcript",
        json={"transcript_text": "Routine fever consultation."},
        headers=headers,
    )

    draft = client.post(f"/consultations/{consultation_id}/draft-rx", json={}, headers=headers)
    assert draft.status_code == 200, draft.text
    assert draft.json()["new_allergy_mentioned"] is None


def test_update_patient_allergies(client, register_doctor):
    doctor = register_doctor(email="update-allergies@example.com")
    headers = auth_header(doctor)

    patient = client.post("/patients", json={"name": "Editable Allergy Patient"}, headers=headers)
    patient_id = patient.json()["id"]

    update = client.patch(
        f"/patients/{patient_id}/allergies", json={"known_allergies": "Penicillin, Sulfa drugs"}, headers=headers
    )
    assert update.status_code == 200, update.text
    assert update.json()["known_allergies"] == "Penicillin, Sulfa drugs"


def test_patient_can_download_prescription_pdf(client, monkeypatch, register_doctor):
    doctor = register_doctor(email="pdf-download@example.com")
    monkeypatch.setattr("app.routers.consultations.draft_prescription", _fake_draft_prescription)
    monkeypatch.setattr("app.routers.consultations.translate_to_hindi", _fake_translate_to_hindi)
    headers = auth_header(doctor)

    patient = client.post(
        "/patients", json={"name": "PDF Patient", "age": 30, "email": "pdf-patient@example.com"}, headers=headers
    )
    consultation_id = client.post(
        "/consultations", json={"patient_id": patient.json()["id"]}, headers=headers
    ).json()["id"]
    client.patch(
        f"/consultations/{consultation_id}/transcript",
        json={"transcript_text": "Routine consultation."},
        headers=headers,
    )
    client.post(f"/consultations/{consultation_id}/draft-rx", json={}, headers=headers)
    client.post(f"/consultations/{consultation_id}/approve", json={}, headers=headers)

    patient_login = client.post(
        "/auth/register/patient",
        json={"name": "PDF Patient", "email": "pdf-patient@example.com", "password": "password123"},
    )
    assert patient_login.status_code == 201, patient_login.text
    patient_headers = auth_header(patient_login.json())

    prescriptions = client.get("/patients/me/prescriptions", headers=patient_headers)
    prescription_id = prescriptions.json()[0]["id"]

    pdf_en = client.get(f"/patients/me/prescriptions/{prescription_id}/pdf", headers=patient_headers)
    assert pdf_en.status_code == 200, pdf_en.text
    assert pdf_en.headers["content-type"] == "application/pdf"
    assert pdf_en.content[:4] == b"%PDF"

    pdf_hi = client.get(f"/patients/me/prescriptions/{prescription_id}/pdf?lang=hi", headers=patient_headers)
    assert pdf_hi.status_code == 200, pdf_hi.text
    assert pdf_hi.content[:4] == b"%PDF"
