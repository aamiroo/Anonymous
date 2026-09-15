from fastapi import APIRouter , Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import Conversation

router = APIRouter(prefix = "/api/conversations" , tags = ["Conversations"])

@router.post("/")
async def create_converstation(
    user_id: int,
    db: Session =Depends(get_db)
):
    Conversation = Conversation(user_id=user_id)

    db.add(Conversation)
    db.commit()
    db.refresh(Conversation)
    return{
        "id" : Conversation.id ,
        "user_id": Conversation.user_id
    }
