from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_

from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogList, AuditLogOut
from app.core.auth_dependencies import get_current_active_user

router = APIRouter()

@router.get("", response_model=AuditLogList)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    filter: Optional[str] = Query(None, alias="filter", description="Filter by event type"),
    search: Optional[str] = Query(None, description="Search term in description or email"),
    from_date: Optional[str] = Query(None, alias="from", description="ISO from date"),
    to_date: Optional[str] = Query(None, alias="to", description="ISO to date"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    offset = (page - 1) * size
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))
    
    conditions = []

    # RBAC Enforcement: Engineers can only see their own audit logs
    if current_user.role == "NETWORK_ENGINEER":
        conditions.append(AuditLog.user_id == current_user.id)

    # Filter by event type
    if filter and filter.upper() != "ALL":
        conditions.append(AuditLog.event_type == filter.upper())

    # Search filter
    if search:
        search_like = f"%{search}%"
        conditions.append(
            or_(
                AuditLog.event_description.ilike(search_like),
                AuditLog.user_email.ilike(search_like)
            )
        )

    # Date range filters
    if from_date:
        try:
            fd = datetime.fromisoformat(from_date)
            conditions.append(AuditLog.created_at >= fd)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format. Use ISO format.")
            
    if to_date:
        try:
            td = datetime.fromisoformat(to_date)
            conditions.append(AuditLog.created_at <= td)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format. Use ISO format.")

    if conditions:
        query = query.filter(and_(*conditions))
        count_query = count_query.filter(and_(*conditions))

    # Get count
    count_res = await db.execute(count_query)
    total = count_res.scalar() or 0

    # Get logs ordered by created_at descending
    result = await db.execute(query.order_by(AuditLog.created_at.desc()).offset(offset).limit(size))
    logs = result.scalars().all()

    return {
        "total": total,
        "items": list(logs)
    }
