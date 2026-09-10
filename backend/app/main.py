# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import users, tasks

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Task Tracker API")

# Allow the frontend (running on a different origin) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # for local dev only — we'll restrict this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(tasks.router)


@app.get("/")
def root():
    return {"message": "Task Tracker API is running"}