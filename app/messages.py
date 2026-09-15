from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import Message, Conversation

router = APIRouter(
    prefix="/api/Messages",
    tags=["Messages"],
)


@router.post("/")
async def create_messages(
    conversation_id: int,
    sender: str,
    content: str,
    db: Session = Depends(get_db),
):
    message = Message(
        conversation_id=conversation_id,
        sender=sender,
        content=content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender": message.sender,
        "content": message.content,
    }


@router.get("/{conversation_id}")
async def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
):
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .all()
    )
    return [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "sender": m.sender,
            "content": m.content,
            "created_at": m.created_at.isoformat() if isinstance(m.created_at, datetime) else str(m.created_at) if m.created_at else None,
        }
        for m in messages
    ]


@router.post("/send")
async def send_message(
    user_id: int,
    content: str,
    db: Session = Depends(get_db),
):
    conv = Conversation(user_id=user_id)
    db.add(conv)
    db.flush()

    message = Message(
        conversation_id=conv.id,
        sender="user",
        content=content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    return {
        "conversation_id": conv.id,
        "message": {
            "id": message.id,
            "sender": message.sender,
            "content": message.content,
        },
    }
