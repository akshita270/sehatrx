from tests.conftest import auth_header


def test_caregiver_claim_requires_correct_code(client, register_patient):
    patient = register_patient(email="caregiver-owner@example.com")
    headers = auth_header(patient)

    add = client.post(
        "/patients/me/caregivers",
        json={"name": "Amit Verma", "email": "amit-caregiver@example.com", "relationship_label": "Son"},
        headers=headers,
    )
    assert add.status_code == 201, add.text
    claim_code = add.json()["claim_code"]
    assert claim_code

    wrong_code = client.post(
        "/auth/register/caregiver",
        json={"name": "Amit Verma", "email": "amit-caregiver@example.com", "password": "password123", "claim_code": "000000"},
    )
    assert wrong_code.status_code == 403

    no_code = client.post(
        "/auth/register/caregiver",
        json={"name": "Amit Verma", "email": "amit-caregiver@example.com", "password": "password123"},
    )
    assert no_code.status_code == 403

    correct_code = client.post(
        "/auth/register/caregiver",
        json={
            "name": "Amit Verma",
            "email": "amit-caregiver@example.com",
            "password": "password123",
            "claim_code": claim_code,
        },
    )
    assert correct_code.status_code == 201, correct_code.text

    login = client.post(
        "/auth/login",
        json={"email": "amit-caregiver@example.com", "password": "password123", "role": "caregiver"},
    )
    assert login.status_code == 200


def test_caregiver_claim_code_is_single_use(client, register_patient):
    patient = register_patient(email="caregiver-owner-2@example.com")
    headers = auth_header(patient)

    add = client.post(
        "/patients/me/caregivers",
        json={"name": "Priya Verma", "email": "priya-caregiver@example.com"},
        headers=headers,
    )
    claim_code = add.json()["claim_code"]

    first = client.post(
        "/auth/register/caregiver",
        json={
            "name": "Priya Verma",
            "email": "priya-caregiver@example.com",
            "password": "password123",
            "claim_code": claim_code,
        },
    )
    assert first.status_code == 201

    replay = client.post(
        "/auth/register/caregiver",
        json={
            "name": "Priya Verma",
            "email": "priya-caregiver@example.com",
            "password": "differentpassword",
            "claim_code": claim_code,
        },
    )
    assert replay.status_code == 409
