from datetime import datetime
from typing import Any, Dict
from urllib.parse import urlencode
import logging
import os
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.database import get_db
from app.models.user import Role, User
from app.services.auth_service import AuthService, get_current_active_user
from app.core.security import decode_token

try:
    from app.models.audit import AuditLog
    HAS_AUDIT = False
except ImportError:
    HAS_AUDIT = False

router = APIRouter()
public_router = APIRouter()


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: Role = Role.network_engineer


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    is_active: bool

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "Bearer"
    expires_in: int
    user: UserOut


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class GoogleAuthRequest(BaseModel):
    access_token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


async def _get_google_userinfo(access_token: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google access token")
    return resp.json()


async def _issue_google_login(info: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    email = info.get("email")
    full_name = info.get("name") or info.get("given_name") or "Google User"
    provider_id = info.get("sub", "")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()

    if not user:
        user = User(
            email=email,
            hashed_password=AuthService.hash_password(os.urandom(24).hex()),
            full_name=full_name,
            role=Role.network_engineer,
            provider="google",
            provider_id=provider_id,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        logging.info("Auto-registered Google user: %s", email)
    else:
        user.provider_id = provider_id or user.provider_id
        if user.provider != "google":
            user.provider = "google"

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is inactive. Contact your administrator.")

    user.last_login_at = datetime.utcnow()
    db.add(user)

    access_token = AuthService.create_access_token(data={"sub": str(user.id), "role": user.role.value})
    refresh_token = AuthService.create_refresh_token(data={"sub": str(user.id)})

    if HAS_AUDIT:
        db.add(AuditLog(event_type="AUTH_LOGIN", event_description=f"User {user.email} logged in via Google OAuth", user_id=user.id))

    await db.commit()
    await db.refresh(user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user,
    }


def _frontend_oauth_redirect(token_data: Dict[str, Any]) -> RedirectResponse:
    fragment = urlencode(
        {
            "oauth": "google",
            "access_token": token_data["access_token"],
            "refresh_token": token_data["refresh_token"],
            "token_type": token_data["token_type"],
            "expires_in": str(token_data["expires_in"]),
        }
    )
    return RedirectResponse(url=f"{settings.FRONTEND_URL.rstrip('/')}/#{fragment}", status_code=status.HTTP_302_FOUND)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == user_data.email))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=user_data.email,
        hashed_password=AuthService.hash_password(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        provider="local",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenOut)
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == login_data.email))
    user = result.scalars().first()

    if not user or not AuthService.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    user.last_login_at = datetime.utcnow()
    db.add(user)

    access_token = AuthService.create_access_token(data={"sub": str(user.id), "role": user.role.value})
    refresh_token = AuthService.create_refresh_token(data={"sub": str(user.id)})
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user,
    }


@router.post("/google", response_model=TokenOut)
async def google_auth(auth_data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    info = await _get_google_userinfo(auth_data.access_token)
    return await _issue_google_login(info, db)


@router.get("/google/login")
@public_router.get("/auth/google/login")
async def google_oauth_login():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(
        url=f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/google/callback")
@public_router.get("/auth/google/callback")
async def google_oauth_callback(
    code: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if error:
        raise HTTPException(status_code=400, detail=f"Google OAuth failed: {error}")
    if not code:
        raise HTTPException(status_code=422, detail="Missing Google authorization code")
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=10.0,
        )
    if token_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Google authorization code exchange failed")

    google_access_token = token_resp.json().get("access_token")
    if not google_access_token:
        raise HTTPException(status_code=401, detail="Google did not return an access token")

    info = await _get_google_userinfo(google_access_token)
    token_data = await _issue_google_login(info, db)
    return _frontend_oauth_redirect(token_data)


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == req.email))
    user = result.scalars().first()

    if user:
        reset_token = AuthService.create_access_token(data={"sub": str(user.id), "type": "reset"})
        logging.warning("MOCK EMAIL [Forgot Password]: Send this link to %s: http://localhost:3000/reset-password?token=%s", user.email, reset_token)

    return {"detail": "If the email is registered, a password reset link has been sent to it."}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(req.token)
        if payload.get("type") != "reset":
            raise ValueError("Invalid token type")
        user_id = uuid.UUID(str(payload.get("sub")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = AuthService.hash_password(req.new_password)
    db.add(user)
    await db.commit()
    return {"detail": "Password has been successfully reset."}


@router.post("/refresh", response_model=TokenOut)
async def refresh_token(refresh_data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(refresh_data.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")
        user_id = uuid.UUID(str(payload.get("sub")))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")

    access_token = AuthService.create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {
        "access_token": access_token,
        "refresh_token": refresh_data.refresh_token,
        "token_type": "Bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user,
    }


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(current_user: User = Depends(get_current_active_user)):
    return {"detail": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user
