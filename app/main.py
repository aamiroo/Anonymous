from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from . import models
from .users import Router as user_router
from .conversations import router as conversation_router
from .messages import router as messanger_router
from .auth import router as auth_router


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Eitaa Anonymous Messaging",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(conversation_router)
app.include_router(messanger_router)
app.include_router(auth_router)


@app.get("/")
async def root():
    return {
        "message": "Eitaa Anonymous Messaging API",
        "status": "ok",
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy"
    }