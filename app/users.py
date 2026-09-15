from fastapi import APIRouter , Depends
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


Router = APIRouter(prefix = "/api/users" , tags = ["users"])

@Router.post("/")
async def create_user(
    eitta_user_id : str,
    db : Session = Depends(get_db),
):
    user = user(eitta_user_id = eitta_user_id)

    db.add(user)
    db.commit()
    db.refresh(user)

    return{
        "id" : user.id,
        "eitta_user_id" : user.eitta_user_id,
    }