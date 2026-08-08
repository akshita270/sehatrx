import logging

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import SessionLocal
from app.models import Doctor, Patient

logger = logging.getLogger(__name__)

DEMO_DOCTOR = {
    "name": "Dr. Ananya Sharma",
    "email": "doctor@demo.com",
    "password": "demo123",
    "specialization": "General Physician",
    "clinic": "Sharma Family Clinic, Lucknow",
    "reg_no": "UP-MED-88213",
    "phone": "+91 98765 43210",
}

DEMO_PATIENTS = [
    {"name": "Rohit Verma", "email": "patient@demo.com", "password": "demo123", "age": 34, "gender": "Male", "phone": "+91 90000 11111"},
    {"name": "Sunita Devi", "email": "sunita@demo.com", "password": "demo123", "age": 52, "gender": "Female", "phone": "+91 90000 22222"},
    {"name": "Aman Khan", "email": "aman@demo.com", "password": "demo123", "age": 22, "gender": "Male", "phone": "+91 90000 33333"},
]


def seed(db: Session) -> None:
    if not db.query(Doctor).filter(Doctor.email == DEMO_DOCTOR["email"]).first():
        doctor = Doctor(
            name=DEMO_DOCTOR["name"],
            email=DEMO_DOCTOR["email"],
            password_hash=hash_password(DEMO_DOCTOR["password"]),
            specialization=DEMO_DOCTOR["specialization"],
            clinic=DEMO_DOCTOR["clinic"],
            reg_no=DEMO_DOCTOR["reg_no"],
            phone=DEMO_DOCTOR["phone"],
        )
        db.add(doctor)
        logger.info("Seeded demo doctor: %s", DEMO_DOCTOR["email"])

    for p in DEMO_PATIENTS:
        if not db.query(Patient).filter(Patient.email == p["email"]).first():
            db.add(
                Patient(
                    name=p["name"],
                    email=p["email"],
                    password_hash=hash_password(p["password"]),
                    age=p["age"],
                    gender=p["gender"],
                    phone=p["phone"],
                )
            )
            logger.info("Seeded demo patient: %s", p["email"])

    db.commit()


def run_seed() -> None:
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_seed()
