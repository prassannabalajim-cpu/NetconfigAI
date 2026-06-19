import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.database import get_db
from app.models.user import User

# OAuth2 Scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

# In-Memory Token Blacklist (for simple token revocation)
TOKEN_BLACKLIST = set()

from app.core.security import create_access_token as core_create_access_token
from app.core.security import create_refresh_token as core_create_refresh_token
from app.core.security import decode_token as core_decode_token

class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        return core_create_access_token(data, expires_delta)

    @staticmethod
    def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        return core_create_refresh_token(data, expires_delta)

    @staticmethod
    def decode_token(token: str) -> dict:
        try:
            return core_decode_token(token)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> dict:
        payload = AuthService.decode_token(token)
        
        # Check blacklist
        jti = payload.get("jti")
        if jti in TOKEN_BLACKLIST:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
            )
            
        # Validate type
        if payload.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type} token.",
            )
            
        return payload

    @staticmethod
    def blacklist_token(token: str):
        try:
            payload = AuthService.decode_token(token)
            jti = payload.get("jti")
            if jti:
                TOKEN_BLACKLIST.add(jti)
        except HTTPException:
            pass # Invalid token, ignore

# Dependency Injection Helpers

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = AuthService.verify_token(token, "access")
    subject: str = payload.get("sub")
    if subject is None:
        raise credentials_exception

    try:
        user_id = uuid.UUID(str(subject))
        result = await db.execute(select(User).filter(User.id == user_id))
    except ValueError:
        result = await db.execute(select(User).filter(User.email == subject))

    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

class require_role:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return current_user
