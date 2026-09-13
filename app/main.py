from fastapi import FastAPI
from .database import Base , engine
from . import models

Base.metadata.create_all(bind = engine)

app = FastAPI(
    title = "Eitta anonymous",
    version = "0.1.0"
)

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