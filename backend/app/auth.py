from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Caregiver, Doctor, Patient

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

Role = Literal["doctor", "patient", "caregiver"]


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(subject: str, role: Role) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


class CurrentUser:
    def __init__(self, id: str, role: Role):
        self.id = id
        self.role = role


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    role = payload.get("role")
    if user_id is None or role is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return CurrentUser(id=user_id, role=role)


def require_doctor(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor access required")
    return current_user


def require_patient(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access required")
    return current_user


def require_caregiver(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != "caregiver":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver access required")
    return current_user


def get_current_doctor(
    current_user: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)
) -> Doctor:
    doctor = db.get(Doctor, current_user.id)
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Doctor not found")
    return doctor


def get_current_patient(
    current_user: CurrentUser = Depends(require_patient), db: Session = Depends(get_db)
) -> Patient:
    patient = db.get(Patient, current_user.id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Patient not found")
    return patient


def get_current_caregiver(
    current_user: CurrentUser = Depends(require_caregiver), db: Session = Depends(get_db)
) -> Caregiver:
    caregiver = db.get(Caregiver, current_user.id)
    if caregiver is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Caregiver not found")
    return caregiver
