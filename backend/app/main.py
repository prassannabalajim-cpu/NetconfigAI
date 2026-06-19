from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.v1.router import api_router
from app.api.v1.auth import public_router as auth_public_router
from app.database import init_db
from app.config import settings
from app.utils.logger import logger

# CRITICAL: Import all models here to ensure SQLAlchemy mapper registry is fully
# populated before any relationship resolution happens at request time.
import app.models  # noqa: F401 — registers User, Review, DiffChange, ComplianceFinding, WorkflowStep

# Custom exceptions and middleware (if available, otherwise we use standard FastAPI)
try:
    from app.core.middleware import RequestIDMiddleware, TimingMiddleware, AuditLoggingMiddleware
    HAS_CUSTOM_MIDDLEWARE = True
except ImportError:
    HAS_CUSTOM_MIDDLEWARE = False

try:
    from app.core.exceptions import AppException, app_exception_handler
    HAS_CUSTOM_EXCEPTIONS = True
except ImportError:
    HAS_CUSTOM_EXCEPTIONS = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Network Config Diff Reviewer API...")
    # Initialize database tables asynchronously
    await init_db()
    yield
    logger.info("Shutting down...")

app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise-grade network configuration change review platform",
    version=settings.APP_VERSION,
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# Security Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=settings.ALLOWED_HOSTS
)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none';"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

app.add_middleware(SecurityHeadersMiddleware)

if HAS_CUSTOM_MIDDLEWARE:
    app.add_middleware(AuditLoggingMiddleware)
    app.add_middleware(TimingMiddleware)
    app.add_middleware(RequestIDMiddleware)

if HAS_CUSTOM_EXCEPTIONS:
    app.add_exception_handler(AppException, app_exception_handler)

# Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# API Routing
app.include_router(api_router, prefix="/api/v1")
app.include_router(auth_public_router)

@app.get("/api/v1/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "healthy"}

@app.get("/health/ready", status_code=status.HTTP_200_OK)
async def health_ready():
    try:
        from app.database import engine
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database not ready")
