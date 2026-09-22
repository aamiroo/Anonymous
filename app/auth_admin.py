"""Admin authentication and JWT token management."""


from datetime import UTC, datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .config import Settings
from .database import get_db
from .models import Admin

settings = Settings()


router = APIRouter(
    prefix="/api/admin",
    tags=["admin-auth"],
)

password_hash = PasswordHash.recommended()
security = HTTPBearer()



def create_access_token(admin_id: int) -> str:
    expire = datetime.now(UTC) + timedelta(hours=12)

    payload = {
        "sub": str(admin_id),
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm="HS256",
    )


@router.post("/login")
async def admin_login(
    username: str,
    password: str,
    db: Session = Depends(get_db),
):
    admin = (
        db.query(Admin)
        .filter(Admin.user_name == username)
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if not password_hash.verify(password, admin.pass_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    access_token = create_access_token(admin.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
        )

        admin_id = payload.get("sub")

        if admin_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token",
            )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expired",
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
        )

    admin = (
        db.query(Admin)
        .filter(Admin.id == int(admin_id))
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=401,
            detail="Admin not found",
        )

    return admin