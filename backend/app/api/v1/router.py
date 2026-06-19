from fastapi import APIRouter
from app.api.v1 import auth
from app.api.v1 import upload, diff, analyze, compliance, report, reviews, dashboard, audit

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(diff.router, prefix="/diff", tags=["diff"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
api_router.include_router(compliance.router, prefix="/compliance", tags=["compliance"])
api_router.include_router(report.router, prefix="/report", tags=["report"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
