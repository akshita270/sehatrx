from tests.conftest import auth_header


def _create_patient_and_consultation(client, doctor_token, patient_name="Owned Patient"):
    headers = auth_header(doctor_token)
    patient = client.post("/patients", json={"name": patient_name, "age": 25, "gender": "Male"}, headers=headers)
    assert patient.status_code == 201
    consultation = client.post("/consultations", json={"patient_id": patient.json()["id"]}, headers=headers)
    assert consultation.status_code == 201
    return consultation.json()


def test_doctor_cannot_see_other_doctors_consultations(client, register_doctor):
    doctor_a = register_doctor(email="owner-a@example.com")
    doctor_b = register_doctor(email="owner-b@example.com")

    consultation = _create_patient_and_consultation(client, doctor_a, "Doctor A's Patient")

    b_list = client.get("/consultations", headers=auth_header(doctor_b))
    assert b_list.status_code == 200
    assert all(c["id"] != consultation["id"] for c in b_list.json())

    a_list = client.get("/consultations", headers=auth_header(doctor_a))
    assert any(c["id"] == consultation["id"] for c in a_list.json())


def test_doctor_cannot_patch_another_doctors_transcript(client, register_doctor):
    doctor_a = register_doctor(email="patch-owner-a@example.com")
    doctor_b = register_doctor(email="patch-owner-b@example.com")

    consultation = _create_patient_and_consultation(client, doctor_a)

    res = client.patch(
        f"/consultations/{consultation['id']}/transcript",
        json={"transcript_text": "Doctor B trying to tamper with this."},
        headers=auth_header(doctor_b),
    )
    assert res.status_code == 404

    # Confirm it's genuinely untouched, not just hidden from doctor B.
    check = client.get("/consultations", headers=auth_header(doctor_a))
    match = next(c for c in check.json() if c["id"] == consultation["id"])
    assert match["transcript_text"] is None


def test_doctor_cannot_delete_another_doctors_consultation(client, register_doctor):
    doctor_a = register_doctor(email="del-owner-a@example.com")
    doctor_b = register_doctor(email="del-owner-b@example.com")

    consultation = _create_patient_and_consultation(client, doctor_a)

    res = client.delete(f"/consultations/{consultation['id']}", headers=auth_header(doctor_b))
    assert res.status_code == 404

    still_there = client.get("/consultations", headers=auth_header(doctor_a))
    assert any(c["id"] == consultation["id"] for c in still_there.json())


def test_patient_cannot_access_doctor_only_endpoints(client, register_patient):
    patient = register_patient(email="notadoctor@example.com")
    res = client.get("/consultations", headers=auth_header(patient))
    assert res.status_code == 403


def test_doctor_cannot_access_patient_only_endpoints(client, register_doctor):
    doctor = register_doctor(email="notapatient@example.com")
    res = client.get("/patients/me/prescriptions", headers=auth_header(doctor))
    assert res.status_code == 403
