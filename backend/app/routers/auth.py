from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from ..database import get_db
from ..models import Session, User
from ..security import create_session, current_user, hash_password, verify_password
from ..serializers import user_out

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


class PasswordIn(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
def login(body: LoginIn, db: DbSession = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if not user.active:
        raise HTTPException(403, "This account is disabled")
    return {"token": create_session(db, user), "user": user_out(user)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.post("/logout")
def logout(authorization: str = Header(default=""), db: DbSession = Depends(get_db)):
    token = authorization.removeprefix("Bearer ").strip()
    if session := db.get(Session, token):
        db.delete(session)
        db.commit()
    return {"ok": True}


@router.post("/password")
def change_password(body: PasswordIn, user: User = Depends(current_user), db: DbSession = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    db_user = db.get(User, user.id)
    db_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
