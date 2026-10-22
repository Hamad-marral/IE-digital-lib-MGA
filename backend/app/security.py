import hashlib
import hmac
import secrets

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session as DbSession

from .database import get_db
from .models import Session, User


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return hmac.compare_digest(check, digest)


def create_session(db: DbSession, user: User) -> str:
    token = secrets.token_hex(32)
    db.add(Session(token=token, user_id=user.id))
    db.commit()
    return token


def current_user(authorization: str = Header(default=""), db: DbSession = Depends(get_db)) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Not authenticated")
    session = db.get(Session, token)
    if not session or not session.user.active:
        raise HTTPException(401, "Session expired, please sign in again")
    return session.user


def require_roles(*roles: str):
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "You do not have permission for this action")
        return user

    return checker


can_edit = require_roles("admin", "ie_team")
admin_only = require_roles("admin")
