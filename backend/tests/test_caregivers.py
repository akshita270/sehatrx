from tests.conftest import auth_header


def test_caregiver_can_register_after_being_added(client, register_patient):
    patient = register_patient(email="caregiver-owner@example.com")
    headers = auth_header(patient)

    add = client.post(
        "/patients/me/caregivers",
        json={"name": "Amit Verma", "email": "amit-caregiver@example.com", "relationship_label": "Son"},
        headers=headers,
    )
    assert add.status_code == 201, add.text

    register = client.post(
        "/auth/register/caregiver",
        json={"name": "Amit Verma", "email": "amit-caregiver@example.com", "password": "password123"},
    )
    assert register.status_code == 201, register.text

    login = client.post(
        "/auth/login",
        json={"identifier": "amit-caregiver@example.com", "password": "password123", "role": "caregiver"},
    )
    assert login.status_code == 200


def test_caregiver_register_without_being_added_first_rejected(client):
    res = client.post(
        "/auth/register/caregiver",
        json={"name": "Nobody", "email": "never-added@example.com", "password": "password123"},
    )
    assert res.status_code == 404


def test_caregiver_cannot_register_twice(client, register_patient):
    patient = register_patient(email="caregiver-owner-2@example.com")
    headers = auth_header(patient)

    add = client.post(
        "/patients/me/caregivers",
        json={"name": "Priya Verma", "email": "priya-caregiver@example.com"},
        headers=headers,
    )
    assert add.status_code == 201, add.text

    first = client.post(
        "/auth/register/caregiver",
        json={"name": "Priya Verma", "email": "priya-caregiver@example.com", "password": "password123"},
    )
    assert first.status_code == 201

    replay = client.post(
        "/auth/register/caregiver",
        json={"name": "Priya Verma", "email": "priya-caregiver@example.com", "password": "differentpassword"},
    )
    assert replay.status_code == 409
