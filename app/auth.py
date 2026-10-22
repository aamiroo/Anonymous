"""Eitaa user authentication and login endpoints."""


import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .config import Settings
from .database import get_db
from .models import User

settings = Settings()

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


def validate_init_data(init_data: str) -> dict:
    data = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = data.pop("hash", None)

    if not received_hash:
        raise HTTPException(
            status_code=401,
            detail="Missing hash",
        )
    auth_date = data.get("auth_date")
    if not auth_date :
        raise HTTPException(
            status_code=401,
            detail="Missing auth_date"
        )

    try:
        auth_timestamp = int (auth_date)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid auth_date"
        )
    if (int(time.time()) - auth_timestamp) > 3600:
        raise HTTPException(
            status_code=401 ,
            detail="Expired initData"
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

    try:
        user_info = json.loads(user_data)
    except json.JSONDecodeError:
        raise HTTPException(
        status_code=401 ,
        detail="Invalid user data",
        )

    if not isinstance(user_info, dict):
        raise HTTPException(
            status_code=401,
            detail="Invalid user data",
        )
    
    eitaa_user_id = user_info.get("id")
    if eitaa_user_id is None:
        raise HTTPException(
            status_code=401 ,
            detail="User ID not found"
        )

    eitaa_user_id = str(eitaa_user_id)
    profile = {
        "first_name": user_info.get("first_name"),
        "last_name": user_info.get("last_name"),
        "username": user_info.get("username"),
    }
    db_user = (
        db.query(User)
        .filter(User.eitta_user_id == eitaa_user_id)
        .first()
    )
    if db_user is None:
        db_user = User(
            eitta_user_id=eitaa_user_id,
            **profile,
        )
        db.add(db_user)
    else:
        for field, value in profile.items():
            if value is not None and value != "":
                setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    
    return {
        "id": db_user.id,
        "eitaa_user_id": db_user.eitta_user_id,
    }
