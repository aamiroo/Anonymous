from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import Conversation, Message

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
)


@router.get("/conversations")
async def get_conversations(
    db: Session = Depends(get_db),
):
    conversations = (
        db.query(Conversation)
        .order_by(Conversation.created_at.desc())
        .all()
    )

    return conversations


@router.get("/conversations/{conversation_id}")
async def get_admin_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
):
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    return {
        "id": conversation.id,
        "user_id": conversation.user_id,
        "status": conversation.status,
        "created_at": conversation.created_at,
        "messages": [
            {
                "id": message.id,
                "sender": message.sender,
                "content": message.content,
                "created_at": message.created_at,
            }
            for message in conversation.messages
        ],
    }


@router.post("/conversations/{conversation_id}/reply")
async def reply_to_conversation(
    conversation_id: int,
    content: str,
    db: Session = Depends(get_db),
):
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    admin_reply = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.sender == "admin",
        )
        .first()
    )

    if admin_reply:
        raise HTTPException(
            status_code=409,
            detail="Conversation already has an admin reply",
        )

    message = Message(
        conversation_id=conversation_id,
        sender="admin",
        content=content,
    )

    db.add(message)

    conversation.status = "answered"

    db.commit()
    db.refresh(message)

    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender": message.sender,
        "content": message.content,
        "created_at": message.created_at,
    }