from typing import List, Optional, Dict, Any, Union
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.user import User
from app.models.review import Review
from app.models.diff_change import DiffChange
from app.core.auth_dependencies import get_current_active_user
from app.workers.tasks import run_analysis_pipeline_task

router = APIRouter()


@router.post("/{review_id}", status_code=status.HTTP_202_ACCEPTED)
async def trigger_analysis(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(select(Review).filter(Review.id == review_id))
        review = result.scalars().first()
        if not review:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

        # Trigger Celery job
        task = run_analysis_pipeline_task.delay(str(review_id))
        return {"task_id": task.id, "status": "queued", "review_id": str(review_id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue analysis: {str(e)}")


@router.get("/{review_id}")
async def get_analysis(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(select(Review).filter(Review.id == review_id))
        review = result.scalars().first()
        if not review:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

        diff_result = await db.execute(
            select(DiffChange).filter(DiffChange.review_id == review_id)
        )
        changes = diff_result.scalars().all()

        findings = []
        change_explanations = {}
        for c in changes:
            if c.risk_level in ["CRITICAL", "HIGH", "MEDIUM"]:
                findings.append({
                    "title": f"Risk detected in {c.field_name}",
                    "description": c.ai_explanation or f"Risk scored as {c.risk_level}.",
                    "affected_resource": c.affected_resource or "Unknown",
                    "risk_level": c.risk_level,
                    "cis_control_ref": c.cis_control_ref,
                    "nist_control_ref": c.nist_control_ref,
                    "recommendation": "Review and restrict this configuration change."
                })
            change_explanations[c.field_path] = c.ai_explanation or ""

        return {
            "overall_risk_level": review.risk_level,
            "overall_risk_score": review.overall_risk_score,
            "ai_recommendation": review.ai_recommendation,
            "executive_summary": review.ai_summary,
            "security_impact": f"Risk assessment has flagged {len(findings)} security concerns.",
            "findings": findings,
            "recommendations": [
                {
                    "priority": 1,
                    "recommendation": "Ensure principle of least privilege is applied to IP rules.",
                    "implementation_guidance": "Restrict source ranges to company blocks only."
                }
            ],
            "change_explanations": change_explanations
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analysis: {str(e)}")
