from typing import List, Optional, Dict, Any, Union
import os
import uuid
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.review import UploadResponse
from app.core.auth_dependencies import get_current_active_user
from app.config import settings

router = APIRouter()

@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_configs(
    old_file: UploadFile = File(...),
    new_file: UploadFile = File(...),
    config_type: str = Form(...),
    cloud_provider: str = Form(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Enforce file size limit
    # We can read a small chunk to check, or check file headers if content-length header is present,
    # but let's read file contents and validate size.
    old_bytes = await old_file.read()
    new_bytes = await new_file.read()
    
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024 if hasattr(settings, "MAX_FILE_SIZE_MB") else 50 * 1024 * 1024
    if len(old_bytes) > max_bytes or len(new_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Configuration file size exceeds maximum limit of {settings.MAX_FILE_SIZE_MB}MB"
        )
        
    upload_id = str(uuid.uuid4())
    upload_dir = os.path.join(settings.UPLOAD_DIR, upload_id)
    os.makedirs(upload_dir, exist_ok=True)
    
    old_path = os.path.join(upload_dir, "old_config")
    new_path = os.path.join(upload_dir, "new_config")
    
    with open(old_path, "wb") as f:
        f.write(old_bytes)
    with open(new_path, "wb") as f:
        f.write(new_bytes)
        
    HAS_AUDIT = True
    if HAS_AUDIT:
        audit = AuditLog(
            event_type="CONFIG_UPLOAD",
            event_description=f"User {current_user.email} uploaded configuration files for {config_type} ({cloud_provider})",
            user_id=current_user.id,
            user_email=current_user.email,
            user_role=current_user.role,
            payload={"upload_id": upload_id, "config_type": config_type, "cloud_provider": cloud_provider}
        )
        db.add(audit)
    await db.commit()

    return {"upload_id": upload_id}
