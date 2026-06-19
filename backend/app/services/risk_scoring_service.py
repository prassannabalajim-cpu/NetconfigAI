from app.models.review import RiskLevel
from typing import List

class RiskFinding:
    def __init__(self, title: str, risk_level: RiskLevel, score: int, message: str):
        self.title = title
        self.risk_level = risk_level
        self.score = score
        self.message = message

class RiskScoringService:
    def evaluate_risk(self, diff_result: dict) -> dict:
        findings = []
        max_score = 0
        
        modified_rules = diff_result.get("modified_rules", [])
        added_rules = diff_result.get("added_rules", [])
        
        for rule in modified_rules:
            # PUBLIC_EXPOSURE_RULE
            if "0.0.0.0/0" in str(rule.get("new_value")):
                score = 95
                findings.append(RiskFinding(
                    title="Public Exposure",
                    risk_level=RiskLevel.critical,
                    score=score,
                    message="Resource exposed to public internet. Attack surface massively increased."
                ))
                max_score = max(max_score, score)
                
            # SENSITIVE_PORT_EXPOSURE_RULE (simplified)
            if any(port in str(rule.get("new_value")) for port in ["22", "3389", "3306"]):
                score = 90
                findings.append(RiskFinding(
                    title="Sensitive Port Exposure",
                    risk_level=RiskLevel.critical,
                    score=score,
                    message="Sensitive port exposed."
                ))
                max_score = max(max_score, score)

        # Determine overall risk level based on max_score
        overall_level = RiskLevel.low
        if max_score >= 90:
            overall_level = RiskLevel.critical
        elif max_score >= 70:
            overall_level = RiskLevel.high
        elif max_score >= 40:
            overall_level = RiskLevel.medium

        return {
            "overall_risk_level": overall_level,
            "risk_score": max_score,
            "findings": [{"title": f.title, "risk_level": f.risk_level.value, "score": f.score, "message": f.message} for f in findings]
        }

risk_scoring_service = RiskScoringService()
