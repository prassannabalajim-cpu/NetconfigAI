from typing import List, Optional, Dict, Any, Union
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.user import User
from app.models.review import Review, ReviewStatus, RiskLevel
from app.models.diff_change import DiffChange
from app.schemas.review import CreateDiffRequest, DiffJobOut, DiffChangeOut
from app.core.auth_dependencies import get_current_active_user
from app.workers.tasks import run_analysis_pipeline_task
from app.config import settings

router = APIRouter()

@router.post("", response_model=DiffJobOut, status_code=status.HTTP_201_CREATED)
async def create_diff(
    request: CreateDiffRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        upload_dir = os.path.join(settings.UPLOAD_DIR, request.upload_id)
        old_path = os.path.join(upload_dir, "old_config")
        new_path = os.path.join(upload_dir, "new_config")

        if not os.path.exists(old_path) or not os.path.exists(new_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded files not found for the specified upload_id. Please upload files first."
            )

        review = Review(
            title=request.title,
            ticket_id=request.ticket_id,
            description=request.description,
            config_type="AWS_SECURITY_GROUP",
            cloud_provider="AWS",
            status=ReviewStatus.under_analysis,
            risk_level=RiskLevel.unknown,
            compliance_frameworks=request.compliance_frameworks,
            auto_approve_if_low_risk=request.auto_approve_if_low_risk,
            notify_manager=request.notify_manager,
            submitted_by_id=current_user.id
        )
        db.add(review)
        await db.commit()
        await db.refresh(review)

        # Launch Celery background task with file paths
        run_analysis_pipeline_task.delay(str(review.id), old_path, new_path)

        return {"review_id": review.id, "status": "UNDER_ANALYSIS"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create diff review: {str(e)}")


@router.get("/{review_id}/changes", response_model=List[DiffChangeOut])
async def get_diff_changes(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DiffChange).filter(DiffChange.review_id == review_id).order_by(DiffChange.order_index)
    )
    changes = result.scalars().all()
    return list(changes)
