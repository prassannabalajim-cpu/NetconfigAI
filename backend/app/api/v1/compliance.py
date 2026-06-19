from typing import List, Optional, Dict, Any, Union
import uuid
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.user import User
from app.models.review import Review
from app.models.compliance import ComplianceFinding
from app.schemas.review import ComplianceFindingOut
from app.core.auth_dependencies import get_current_active_user
from app.services.compliance_engine import ComplianceEngine
from app.models.diff_change import DiffChange

router = APIRouter()

@router.post("/{review_id}", status_code=status.HTTP_200_OK)
async def run_compliance(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Review).filter(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        
    # Query changes
    diff_result = await db.execute(select(DiffChange).filter(DiffChange.review_id == review_id))
    changes = diff_result.scalars().all()
    
    # Run compliance engine
    engine = ComplianceEngine()
    findings = engine.validate(list(changes), review.compliance_frameworks)
    
    # Delete old findings
    old_findings = await db.execute(select(ComplianceFinding).filter(ComplianceFinding.review_id == review_id))
    for of in old_findings.scalars().all():
        await db.delete(of)
        
    failed_count = 0
    for f in findings:
        f.review_id = review_id
        db.add(f)
        if f.status == "FAIL":
            failed_count += 1
            
    # Calculate score
    total = len(findings)
    score = ((total - failed_count) / total * 100.0) if total > 0 else 100.0
    review.compliance_score = score
    db.add(review)
    await db.commit()
    
    return {"detail": "Compliance check completed successfully", "score": score}

@router.get("/{review_id}", response_model=List[ComplianceFindingOut])
async def get_compliance_report(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ComplianceFinding).filter(ComplianceFinding.review_id == review_id))
    findings = result.scalars().all()
    return list(findings)
