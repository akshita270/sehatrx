import os

# Point the app at a dedicated test database and dummy secrets before any `app.*`
# module is imported, since settings/engine are constructed at import time.
os.environ["DATABASE_URL"] = "postgresql+psycopg2://sehatrx:sehatrx@localhost:5432/sehatrx_test"
os.environ["JWT_SECRET"] = "test-secret-not-for-production"
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-a-real-key")

import psycopg2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app


def _ensure_test_database_exists() -> None:
    conn = psycopg2.connect(dbname="sehatrx", user="sehatrx", password="sehatrx", host="localhost", port=5432)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = 'sehatrx_test'")
            if not cur.fetchone():
                cur.execute("CREATE DATABASE sehatrx_test")
    finally:
        conn.close()


_ensure_test_database_exists()

test_engine = create_engine(os.environ["DATABASE_URL"])
TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


@pytest.fixture(scope="session", autouse=True)
def _setup_schema():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db_session():
    """A DB session bound to a single connection/transaction that's rolled back after the test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def register_doctor(client):
    def _register(email="doc@example.com", **overrides):
        payload = {
            "name": "Dr. Test Doctor",
            "email": email,
            "password": "password123",
            "specialization": "General Physician",
            "clinic": "Test Clinic",
            "reg_no": "TEST-001",
            "phone": "+91 90000 00000",
            **overrides,
        }
        res = client.post("/auth/register/doctor", json=payload)
        assert res.status_code == 201, res.text
        return res.json()

    return _register


@pytest.fixture()
def register_patient(client):
    def _register(email="patient@example.com", **overrides):
        payload = {
            "name": "Test Patient",
            "email": email,
            "password": "password123",
            "phone": "+91 90000 11111",
            "age": 30,
            "gender": "Other",
            **overrides,
        }
        res = client.post("/auth/register/patient", json=payload)
        assert res.status_code == 201, res.text
        return res.json()

    return _register


def auth_header(token_response: dict) -> dict:
    return {"Authorization": f"Bearer {token_response['access_token']}"}
