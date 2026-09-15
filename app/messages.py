from fastapi import APIRouter , Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import Message

router = APIRouter(
    prefix= "/api/Messages" , 
    tags = ["Messages"]
)

@router.post("/")
async def create_messages(
    conversation_id:int,
    sender: str,
    content: str,
    db : Session= Depends(get_db)
):
    message = Message(
    conversation_id = conversation_id,
    sender = sender,
    content = content
    )

    db.add(message)
    db.commit()
    db.refresh(message)
    return{
        "id" : message.id,
        "conversation_id" : message.conversation_id,
        "sender" : message.sender,
        "content" : message.content

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

    return messages
