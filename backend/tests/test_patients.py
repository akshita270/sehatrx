from tests.conftest import auth_header


def test_add_patient_reuses_existing_record_by_phone(client, register_doctor):
    doctor = register_doctor(email="reuse-doc@example.com")
    headers = auth_header(doctor)

    first = client.post(
        "/patients",
        json={"name": "John Doe", "phone": "+91 90000 55555"},
        headers=headers,
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/patients",
        json={"name": "John Doe", "phone": "+91 90000 55555", "age": 50},
        headers=headers,
    )
    assert second.status_code == 201, second.text
    # Same phone number should link to the same record, not create a duplicate.
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["age"] == 50


def test_add_patient_reuses_existing_record_by_email(client, register_doctor):
    doctor = register_doctor(email="reuse-doc-2@example.com")
    headers = auth_header(doctor)

    first = client.post(
        "/patients",
        json={"name": "Jane Doe", "email": "jane-reuse@example.com"},
        headers=headers,
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/patients",
        json={"name": "Jane Doe", "email": "jane-reuse@example.com", "phone": "+91 90000 66666"},
        headers=headers,
    )
    assert second.status_code == 201, second.text
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["phone"] == "+91 90000 66666"


def test_add_patient_no_contact_info_creates_fresh_each_time(client, register_doctor):
    doctor = register_doctor(email="no-contact-doc@example.com")
    headers = auth_header(doctor)

    first = client.post("/patients", json={"name": "Anonymous Patient"}, headers=headers)
    second = client.post("/patients", json={"name": "Anonymous Patient"}, headers=headers)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
