import uuid
from datetime import datetime
from typing import Optional, Any, List
from pydantic import BaseModel, ConfigDict

class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    event_description: str
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    review_id: Optional[uuid.UUID] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None
    payload: Optional[Any] = None
    created_at: datetime

class AuditLogList(BaseModel):
    total: int
    items: List[AuditLogOut]
