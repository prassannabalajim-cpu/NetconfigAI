from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.review import Review, ReviewStatus
from app.models.workflow_step import WorkflowStep
from app.models.audit import AuditLog
from app.schemas.review import ReviewOut, ReviewDetailOut, WorkflowStepOut, ApprovalAction
from app.core.auth_dependencies import get_current_active_user, RoleGuard

router = APIRouter()

@router.get("", response_model=List[ReviewOut])
async def get_reviews(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort: str = Query("created_at:desc"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    offset = (page - 1) * size
    
    # Simple sort handling
    order_column = Review.created_at.desc()
    if sort == "created_at:asc":
        order_column = Review.created_at.asc()
    elif sort == "title:asc":
        order_column = Review.title.asc()
    elif sort == "title:desc":
        order_column = Review.title.desc()

    result = await db.execute(
        select(Review)
        .order_by(order_column)
        .offset(offset)
        .limit(size)
    )
    reviews = result.scalars().all()
    return list(reviews)

@router.get("/{review_id}", response_model=ReviewDetailOut)
async def get_review(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(
            select(Review)
            .filter(Review.id == review_id)
            .options(
                selectinload(Review.diff_changes),
                selectinload(Review.compliance_findings),
                selectinload(Review.workflow_steps),
            )
        )
        review = result.scalars().first()
        if not review:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        return review
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch review: {str(e)}")

@router.get("/{review_id}/status")
async def get_review_status(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Review).filter(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    return {"review_id": review.id, "status": review.status}

@router.get("/{review_id}/workflow", response_model=List[WorkflowStepOut])
async def get_workflow_status(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WorkflowStep)
        .filter(WorkflowStep.review_id == review_id)
        .order_by(WorkflowStep.step_number.asc())
    )
    steps = result.scalars().all()
    return list(steps)

@router.patch("/{review_id}/approve", response_model=List[WorkflowStepOut])
async def approve_review(
    review_id: uuid.UUID,
    action: ApprovalAction,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Review).filter(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        
    review.status = ReviewStatus.approved
    review.approved_at = datetime.utcnow()
    review.approval_comment = action.comment
    review.reviewed_by_id = current_user.id
    
    steps_result = await db.execute(select(WorkflowStep).filter(WorkflowStep.review_id == review_id))
    next_step_num = len(steps_result.scalars().all()) + 1
    
    step = WorkflowStep(
        review_id=review_id,
        step_number=next_step_num,
        status="APPROVED",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role),
        comment=action.comment
    )
    db.add(step)
    
    audit = AuditLog(
        event_type="REVIEW_APPROVED",
        event_description=f"Review '{review.title}' approved by {current_user.email}",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role),
        review_id=review_id,
        payload={"comment": action.comment}
    )
    db.add(audit)
    await db.commit()
    
    workflow_res = await db.execute(
        select(WorkflowStep)
        .filter(WorkflowStep.review_id == review_id)
        .order_by(WorkflowStep.step_number.asc())
    )
    return list(workflow_res.scalars().all())


@router.patch("/{review_id}/reject", response_model=List[WorkflowStepOut])
async def reject_review(
    review_id: uuid.UUID,
    action: ApprovalAction,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Review).filter(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        
    review.status = ReviewStatus.rejected
    review.rejected_at = datetime.utcnow()
    review.approval_comment = action.comment
    review.reviewed_by_id = current_user.id
    
    steps_result = await db.execute(select(WorkflowStep).filter(WorkflowStep.review_id == review_id))
    next_step_num = len(steps_result.scalars().all()) + 1
    
    step = WorkflowStep(
        review_id=review_id,
        step_number=next_step_num,
        status="REJECTED",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role),
        comment=action.comment
    )
    db.add(step)
    
    audit = AuditLog(
        event_type="REVIEW_REJECTED",
        event_description=f"Review '{review.title}' rejected by {current_user.email}",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role),
        review_id=review_id,
        payload={"comment": action.comment}
    )
    db.add(audit)
    await db.commit()
    
    workflow_res = await db.execute(
        select(WorkflowStep)
        .filter(WorkflowStep.review_id == review_id)
        .order_by(WorkflowStep.step_number.asc())
    )
    return list(workflow_res.scalars().all())

@router.patch("/{review_id}/escalate", response_model=List[WorkflowStepOut])
async def escalate_review(
    review_id: uuid.UUID,
    action: ApprovalAction,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Review).filter(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        
    review.status = ReviewStatus.in_review
    
    steps_result = await db.execute(select(WorkflowStep).filter(WorkflowStep.review_id == review_id))
    next_step_num = len(steps_result.scalars().all()) + 1
    
    step = WorkflowStep(
        review_id=review_id,
        step_number=next_step_num,
        status="ESCALATED",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role),
        comment=action.comment
    )
    db.add(step)
    
    audit = AuditLog(
        event_type="REVIEW_ESCALATED",
        event_description=f"Review '{review.title}' escalated by {current_user.email}",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role),
        review_id=review_id,
        payload={"comment": action.comment}
    )
    db.add(audit)
    await db.commit()
    
    workflow_res = await db.execute(
        select(WorkflowStep)
        .filter(WorkflowStep.review_id == review_id)
        .order_by(WorkflowStep.step_number.asc())
    )
    return list(workflow_res.scalars().all())
