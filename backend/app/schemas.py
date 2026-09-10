# app/schemas.py

from pydantic import BaseModel, EmailStr
from typing import Optional


# ---- User schemas ----

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr

    class Config:
        from_attributes = True


# ---- Auth/token schemas ----

class Token(BaseModel):
    access_token: str
    token_type: str


# ---- Task schemas ----

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    owner_id: int

    class Config:
        from_attributes = True