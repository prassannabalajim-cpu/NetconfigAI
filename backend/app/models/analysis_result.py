import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON as JSONB
from sqlalchemy.sql import func
from app.database import Base
from app.models.review import RiskLevel

class ApprovalRecommendation(str, enum.Enum):
    approve = "approve"
    reject = "reject"
    approve_with_conditions = "approve_with_conditions"

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id = Column(UUID(as_uuid=True), ForeignKey("reviews.id"), nullable=False)
    
    risk_level = Column(Enum(RiskLevel), nullable=False)
    risk_score = Column(Integer, default=0) # 0-100
    
    findings = Column(JSONB, nullable=True) # list of RiskFinding objects
    ai_summary = Column(Text, nullable=True) # LLM-generated plain-English summary
    ai_recommendation = Column(Text, nullable=True)
    
    approval_recommendation = Column(Enum(ApprovalRecommendation), nullable=True)
    
    llm_model_used = Column(String, nullable=True)
    llm_response_time_ms = Column(Integer, nullable=True)
    
    analyzed_at = Column(DateTime(timezone=True), server_default=func.now())
