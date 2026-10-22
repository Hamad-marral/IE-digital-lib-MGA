from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..security import admin_only, current_user, hash_password
from ..serializers import user_out

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(current_user)])

ROLES = {"admin", "ie_team", "viewer"}


class UserIn(BaseModel):
    name: str
    email: str
    role: str = "viewer"
    department: str = "Industrial Engineering"
    password: str | None = None
    active: bool = True


@router.get("")
def list_users(db: Session = Depends(get_db)):
    return [user_out(u) for u in db.scalars(select(User).order_by(User.id))]


@router.post("")
def create_user(body: UserIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    _validate(body, db)
    if not body.password or len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    user = User(name=body.name.strip(), email=body.email.strip().lower(), role=body.role, department=body.department,
                active=body.active, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return user_out(user)


@router.put("/{user_id}")
def update_user(user_id: int, body: UserIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    _validate(body, db, user_id)
    if user.id == admin.id and (body.role != "admin" or not body.active):
        raise HTTPException(400, "You cannot remove your own admin access")
    user.name, user.email, user.role = body.name.strip(), body.email.strip().lower(), body.role
    user.department, user.active = body.department, body.active
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")
        user.password_hash = hash_password(body.password)
    db.commit()
    return user_out(user)


@router.delete("/{user_id}")
def delete_user(user_id: int, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot delete your own account")
    user.active = False  # keep history intact; deactivate instead of hard delete
    db.commit()
    return {"ok": True}


def _validate(body: UserIn, db: Session, user_id: int | None = None):
    if body.role not in ROLES:
        raise HTTPException(400, "Invalid role")
    if "@" not in body.email:
        raise HTTPException(400, "Invalid email address")
    other = db.scalar(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    if other and other.id != user_id:
        raise HTTPException(400, "Email already in use")
