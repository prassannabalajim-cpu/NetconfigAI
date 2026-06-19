import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.user import UserOut

class DiffChangeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    review_id: uuid.UUID
    change_type: str
    field_path: str
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    risk_level: str
    risk_score: float
    ai_explanation: Optional[str] = None
    affected_resource: Optional[str] = None
    cis_control_ref: Optional[str] = None
    nist_control_ref: Optional[str] = None
    order_index: int

class WorkflowStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    review_id: uuid.UUID
    step_number: int
    status: str
    actor_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime

class ComplianceFindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    review_id: uuid.UUID
    framework: str
    control_id: str
    control_name: str
    status: str
    finding_description: str
    remediation_guidance: Optional[str] = None
    severity: str
    evidence: Optional[str] = None

class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    ticket_id: Optional[str] = None
    description: Optional[str] = None
    config_type: str
    cloud_provider: str
    status: str
    risk_level: str
    overall_risk_score: Optional[float] = None
    compliance_score: Optional[float] = None
    ai_summary: Optional[str] = None
    ai_recommendation: Optional[str] = None
    submitted_by_id: uuid.UUID
    reviewed_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class ReviewDetailOut(ReviewOut):
    model_config = ConfigDict(from_attributes=True)

    diff_changes: List[DiffChangeOut] = []
    compliance_findings: List[ComplianceFindingOut] = []
    workflow_steps: List[WorkflowStepOut] = []
    compliance_frameworks: List[str] = []

class DashboardStatsOut(BaseModel):
    total_reviews: int
    open_reviews: int
    high_risk_findings: int
    compliance_violations: int
    pending_approvals: int

class UploadResponse(BaseModel):
    upload_id: str

class CreateDiffRequest(BaseModel):
    upload_id: str
    compliance_frameworks: List[str] = Field(default_factory=list)
    title: str
    ticket_id: Optional[str] = None
    description: Optional[str] = None
    auto_approve_if_low_risk: bool = False
    notify_manager: bool = True

class DiffJobOut(BaseModel):
    review_id: uuid.UUID
    status: str

class ApprovalAction(BaseModel):
    comment: str = Field(..., max_length=500)
