from tests.conftest import auth_header


def test_register_doctor_returns_token_and_profile(register_doctor):
    data = register_doctor()
    assert data["role"] == "doctor"
    assert data["user"]["email"] == "doc@example.com"
    assert data["user"]["reg_no"] == "TEST-001"
    assert "access_token" in data


def test_register_doctor_duplicate_email_rejected(client, register_doctor):
    register_doctor(email="dupe@example.com")
    res = client.post(
        "/auth/register/doctor",
        json={
            "name": "Dr. Someone Else",
            "email": "dupe@example.com",
            "password": "password123",
            "specialization": "Cardiology",
            "clinic": "Other Clinic",
            "reg_no": "TEST-002",
            "phone": "+91 90000 22222",
        },
    )
    assert res.status_code == 409


def test_login_wrong_password_rejected(client, register_doctor):
    register_doctor(email="wrongpass@example.com")
    res = client.post(
        "/auth/login",
        json={"identifier": "wrongpass@example.com", "password": "not-the-password", "role": "doctor"},
    )
    assert res.status_code == 401


def test_login_success_and_me(client, register_doctor):
    register_doctor(email="loginok@example.com")
    res = client.post(
        "/auth/login",
        json={"identifier": "loginok@example.com", "password": "password123", "role": "doctor"},
    )
    assert res.status_code == 200
    token = res.json()

    me = client.get("/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["email"] == "loginok@example.com"
    assert me.json()["role"] == "doctor"


def test_me_requires_auth(client):
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_patient_register_claims_walkin_by_phone(client, register_doctor):
    """A walk-in with no email should still be claimable by matching phone number."""
    doctor = register_doctor(email="walkin-doc@example.com")
    headers = auth_header(doctor)

    walkin = client.post(
        "/patients",
        json={"name": "Walk In Patient", "age": 40, "gender": "Male", "phone": "+91 90000 88888"},
        headers=headers,
    )
    assert walkin.status_code == 201
    walkin_id = walkin.json()["id"]
    assert walkin.json()["email"] is None

    claim = client.post(
        "/auth/register/patient",
        json={
            "name": "Walk In Patient",
            "phone": "+91 90000 88888",
            "password": "password123",
            "age": 40,
            "gender": "Male",
        },
    )
    assert claim.status_code == 201
    # Registering with the matching phone attaches to the *same* walk-in record, not a duplicate.
    assert claim.json()["user"]["id"] == walkin_id

    login = client.post(
        "/auth/login", json={"identifier": "+91 90000 88888", "password": "password123", "role": "patient"}
    )
    assert login.status_code == 200


def test_patient_register_claims_walkin_by_email(client, register_doctor):
    doctor = register_doctor(email="walkin-doc2@example.com")
    headers = auth_header(doctor)

    walkin = client.post(
        "/patients",
        json={
            "name": "Rahul Sharma",
            "age": 45,
            "gender": "Male",
            "phone": "+91 90000 44444",
            "email": "rahul@example.com",
        },
        headers=headers,
    )
    assert walkin.status_code == 201
    walkin_id = walkin.json()["id"]

    claim = client.post(
        "/auth/register/patient",
        json={
            "name": "Rahul Sharma",
            "email": "rahul@example.com",
            "password": "newpassword123",
            "age": 45,
            "gender": "Male",
        },
    )
    assert claim.status_code == 201
    # Claiming attaches credentials to the *same* walk-in record rather than creating a duplicate.
    assert claim.json()["user"]["id"] == walkin_id

    login = client.post(
        "/auth/login", json={"identifier": "rahul@example.com", "password": "newpassword123", "role": "patient"}
    )
    assert login.status_code == 200


def test_patient_register_requires_email_or_phone(client):
    res = client.post(
        "/auth/register/patient",
        json={"name": "No Contact Info", "password": "password123"},
    )
    assert res.status_code == 422
