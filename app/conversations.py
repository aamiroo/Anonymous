from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import Conversation

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


def serialize_conv(c):
    return {
        "id": c.id,
        "user_id": c.user_id,
        "created_at": c.created_at.isoformat() if isinstance(c.created_at, datetime) else str(c.created_at) if c.created_at else None,
        "messages": [
            {
                "id": m.id,
                "sender": m.sender,
                "content": m.content,
                "created_at": m.created_at.isoformat() if isinstance(m.created_at, datetime) else str(m.created_at) if m.created_at else None,
            }
            for m in c.messages
        ],
    }


@router.post("/")
async def create_conversation(
    user_id: int,
    db: Session = Depends(get_db),
):
    conv = Conversation(user_id=user_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": conv.id, "user_id": conv.user_id}


@router.get("/user/{user_id}")
async def get_user_id_conversation(
    user_id: int,
    db: Session = Depends(get_db),
):
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .all()
    )
    return [serialize_conv(c) for c in conversations]


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
):
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if not conversation:
        return {"error": "Conversation not found"}
    return serialize_conv(conversation)
