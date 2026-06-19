from app.database import Base

# ─── Import order matters: models with no FK deps first, then dependents ───

# 1. Base user model (no deps)
from app.models.user import User, Role

# 2. Optional file/result models (no deps on Review)
try:
    from app.models.config_file import ConfigFile
except ImportError:
    ConfigFile = None

try:
    from app.models.diff_result import DiffResult
except ImportError:
    DiffResult = None

try:
    from app.models.analysis_result import AnalysisResult
except ImportError:
    AnalysisResult = None

try:
    from app.models.compliance_result import ComplianceResult
except ImportError:
    ComplianceResult = None

try:
    from app.models.audit import AuditLog
except ImportError:
    AuditLog = None

# 3. Review model (depends on User, ConfigFile, DiffResult, AnalysisResult, ComplianceResult)
from app.models.review import Review, ReviewStatus, RiskLevel

# 4. Models that reference Review via FK — MUST be imported AFTER Review
from app.models.diff_change import DiffChange
from app.models.compliance import ComplianceFinding
from app.models.workflow_step import WorkflowStep

__all__ = [
    "Base",
    "User", "Role",
    "Review", "ReviewStatus", "RiskLevel",
    "DiffChange",
    "ComplianceFinding",
    "WorkflowStep",
    "ConfigFile", "DiffResult", "AnalysisResult", "ComplianceResult", "AuditLog",
]
