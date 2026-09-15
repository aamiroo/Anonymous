import hashlib
import hmac
from urllib.parse import parse_qsl
import json

from fastapi import APIRouter, HTTPException, Depends
from pydantic_settings import BaseSettings
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


class Settings(BaseSettings):
    eitaa_bot_token: str

    class Config:
        env_file = ".env"


settings = Settings()

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


def validate_init_data(init_data: str) -> dict:
    data = dict(parse_qsl(init_data))

    received_hash = data.pop("hash", None)

    if not received_hash:
        raise HTTPException(
            status_code=401,
            detail="Missing hash",
        )

    data_check_string = "\n".join(
        f"{key}={value}"
        for key, value in sorted(data.items())
    )

    secret_key = hmac.new(
        b"WebAppData",
        settings.eitaa_bot_token.encode(),
        hashlib.sha256,
    ).digest()

    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid initData",
        )

    return data


@router.post("/login")
async def login(
    init_data: str,
    db: Session = Depends(get_db),
):
    data = validate_init_data(init_data)

    user_data = data.get("user")
    if not user_data:
        raise HTTPException(
            status_code=401,
            detail="user data not found",
        )
    user_info = json.loads(user_data)

    eitaa_user_id = str(user_info["id"])
    db_user = (
        db.query(User)
        .filter(User.eitta_user_id == eitaa_user_id)
        .first()
    )
    if not db_user:
        db_user = User(
            eitta_user_id=eitaa_user_id
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    return {
        "id": db_user.id,
        "eitaa_user_id": db_user.eitta_user_id,
    }
