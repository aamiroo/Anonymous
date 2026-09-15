from fastapi import FastAPI
from .database import Base , engine
from . import models
from .users import Router as user_router
from .conversations import router as conversation_router
from .messages import router as messanger_router

Base.metadata.create_all(bind = engine)

app = FastAPI(
    title = "Eitta anonymous",
    version = "0.1.0"
)
app.include_router(user_router)
app.include_router(conversation_router)
app.include_router(messanger_router)

@app.get("/")
async def root ():
    return {
        "message": "Eitaa Anonymous Messaging API",
        "status": "ok",}
@app.get("/api/health")
async def health():
    return{
        "status" : "healthly"
    }