from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.review import Review, ReviewStatus, RiskLevel
from app.models.diff_change import DiffChange
from app.models.compliance import ComplianceFinding
from app.schemas.review import DashboardStatsOut
from app.core.auth_dependencies import get_current_active_user

router = APIRouter()

@router.get("", response_model=DashboardStatsOut)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Total reviews
        total_reviews_res = await db.execute(select(func.count(Review.id)))
        total_reviews = total_reviews_res.scalar() or 0

        # Open reviews — using enum values
        open_statuses = [
            ReviewStatus.draft,
            ReviewStatus.under_analysis,
            ReviewStatus.pending_review,
            ReviewStatus.in_review,
        ]
        open_reviews_res = await db.execute(
            select(func.count(Review.id)).filter(Review.status.in_(open_statuses))
        )
        open_reviews = open_reviews_res.scalar() or 0

        # High-risk findings count
        high_risk_res = await db.execute(
            select(func.count(DiffChange.id)).filter(
                DiffChange.risk_level.in_(["CRITICAL", "HIGH"])
            )
        )
        high_risk_findings = high_risk_res.scalar() or 0

        # Compliance violations count
        violations_res = await db.execute(
            select(func.count(ComplianceFinding.id)).filter(ComplianceFinding.status == "FAIL")
        )
        compliance_violations = violations_res.scalar() or 0

        # Pending approvals
        pending_statuses = [ReviewStatus.pending_review, ReviewStatus.in_review]
        pending_approvals_res = await db.execute(
            select(func.count(Review.id)).filter(Review.status.in_(pending_statuses))
        )
        pending_approvals = pending_approvals_res.scalar() or 0

        return {
            "total_reviews": total_reviews,
            "open_reviews": open_reviews,
            "high_risk_findings": high_risk_findings,
            "compliance_violations": compliance_violations,
            "pending_approvals": pending_approvals,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard query failed: {str(e)}")
