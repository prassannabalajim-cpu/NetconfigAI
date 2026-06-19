import httpx
import json
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import settings
from app.utils.logger import logger
from typing import List, Dict, Any
from app.models.diff_change import DiffChange

SYSTEM_PROMPT = """You are a senior network security engineer and compliance expert with 15 years of experience
reviewing network configuration changes across AWS, GCP, Azure, and Terraform IaC environments. You provide
precise, actionable security analysis.

You MUST respond ONLY with a valid JSON object matching this exact schema:
{
  "overall_risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "overall_risk_score": <float 0.0-100.0>,
  "ai_recommendation": "APPROVE|REJECT|ESCALATE",
  "executive_summary": "<2-3 sentence plain English summary>",
  "security_impact": "<detailed security impact analysis>",
  "findings": [
    {
      "title": "<finding title>",
      "description": "<plain English explanation>",
      "affected_resource": "<resource name>",
      "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
      "cis_control_ref": "<e.g. CIS-4.1 or null>",
      "nist_control_ref": "<e.g. NIST-AC-17 or null>",
      "recommendation": "<specific actionable recommendation>"
    }
  ],
  "recommendations": [
    {
      "priority": 1,
      "recommendation": "<actionable recommendation>",
      "implementation_guidance": "<how to implement>"
    }
  ],
  "change_explanations": {
    "<field_path>": "<plain English explanation of this specific change>"
  }
}"""

class OllamaService:
    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=settings.OLLAMA_BASE_URL,
            timeout=httpx.Timeout(settings.OLLAMA_TIMEOUT)
        )

    @retry(
        stop=stop_after_attempt(settings.OLLAMA_MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.TimeoutException)),
        reraise=False
    )
    async def _send_analysis_request(self, user_prompt: str) -> httpx.Response:
        return await self.client.post(
            "/api/generate",
            json={
                "model": settings.OLLAMA_MODEL,
                "system": SYSTEM_PROMPT,
                "prompt": user_prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.1,
                    "top_p": 0.9,
                    "num_ctx": 8192
                }
            }
        )

    async def analyze_changes(self, changes: List[DiffChange], config_type: str) -> Dict[str, Any]:
        """
        Sends diff changes to Llama 3 via Ollama for security analysis.
        If Ollama is unavailable or fails, it falls back to a rule-based analyzer.
        """
        if not changes:
            return self._fallback_analysis(changes)

        changes_payload = [
            {
                "field_path": c.field_path,
                "field_name": c.field_name,
                "change_type": c.change_type,
                "old_value": c.old_value,
                "new_value": c.new_value,
                "initial_risk_level": c.risk_level,
                "initial_risk_score": c.risk_score,
                "affected_resource": c.affected_resource
            }
            for c in changes
        ]

        user_prompt = f"""Analyze the following network configuration changes for
a {config_type} configuration and provide a comprehensive security review:

CONFIGURATION CHANGES:
{json.dumps(changes_payload, indent=2)}

Analyze each change for:
1. Security implications and attack surface expansion
2. Public internet exposure risks (any 0.0.0.0/0 or ::/0 changes are CRITICAL)
3. Sensitive port exposure (SSH:22, RDP:3389, MySQL:3306, PostgreSQL:5432, Redis:6379, etc.)
4. Compliance violations (CIS AWS Foundations, NIST SP 800-53, PCI-DSS)
5. Traffic routing impact
6. VPN/encryption configuration integrity

Provide plain English explanations that a non-technical manager can understand.
Your recommendation should be APPROVE (safe changes), REJECT (security risks found),
or ESCALATE (requires senior security team review).

Respond ONLY with the JSON object as specified. No markdown, no explanations outside."""

        logger.info(f"Sending {len(changes)} changes to Ollama Llama3 for analysis")

        try:
            response = await self._send_analysis_request(user_prompt)
            response.raise_for_status()
            result = response.json()
            raw_text = result.get("response", "")

            # Parse and validate JSON response
            analysis_data = json.loads(raw_text)
            
            # Populate AI explanations back to changes
            explanations = analysis_data.get("change_explanations", {})
            for c in changes:
                c.ai_explanation = explanations.get(c.field_path)

            return analysis_data

        except Exception as e:
            logger.error(f"Ollama response/connection failed: {e}. Running local rule-based fallback...")
            return self._fallback_analysis(changes)

    def _fallback_analysis(self, changes: List[DiffChange]) -> Dict[str, Any]:
        """
        Rule-based fallback when Ollama is unavailable.
        """
        if not changes:
            return {
                "overall_risk_level": "LOW",
                "overall_risk_score": 0.0,
                "ai_recommendation": "APPROVE",
                "executive_summary": "No configuration changes detected.",
                "security_impact": "No security impact detected.",
                "findings": [],
                "recommendations": [],
                "change_explanations": {}
            }

        critical_changes = [c for c in changes if c.risk_level == "CRITICAL"]
        high_changes = [c for c in changes if c.risk_level == "HIGH"]
        medium_changes = [c for c in changes if c.risk_level == "MEDIUM"]

        if critical_changes:
            overall = "CRITICAL"
            recommendation = "REJECT"
        elif high_changes:
            overall = "HIGH"
            recommendation = "ESCALATE"
        elif medium_changes:
            overall = "MEDIUM"
            recommendation = "ESCALATE"
        else:
            overall = "LOW"
            recommendation = "APPROVE"

        max_score = max((c.risk_score for c in changes), default=0.0)

        findings = []
        for c in changes:
            if c.risk_level in ["CRITICAL", "HIGH"]:
                findings.append({
                    "title": f"Risk detected in {c.field_name}",
                    "description": f"Rule-based detection identified {c.risk_level} risk. Change: {c.old_value} -> {c.new_value}.",
                    "affected_resource": c.affected_resource or "Unknown",
                    "risk_level": c.risk_level,
                    "cis_control_ref": c.cis_control_ref,
                    "nist_control_ref": c.nist_control_ref,
                    "recommendation": "Verify source IP filters and restrict to authorized subnets only."
                })

        recommendations = []
        if critical_changes or high_changes:
            recommendations.append({
                "priority": 1,
                "recommendation": "Restrict open source ranges to private subnet IP allocations.",
                "implementation_guidance": "Modify configuration to target internal subnets or restrict ingress source networks."
            })
        else:
            recommendations.append({
                "priority": 1,
                "recommendation": "Perform manual sanity checks on changes.",
                "implementation_guidance": "Examine variables list to ensure no invalid settings are introduced."
            })

        change_explanations = {}
        for c in changes:
            explanation = f"Configuration modified {c.old_value} to {c.new_value}."
            c.ai_explanation = explanation
            change_explanations[c.field_path] = explanation

        return {
            "overall_risk_level": overall,
            "overall_risk_score": max_score,
            "ai_recommendation": recommendation,
            "executive_summary": f"Ollama model unavailable. Applied local rule-based fallback logic. Overall risk evaluated as {overall}.",
            "security_impact": f"Risk assessment has flagged {len(critical_changes)} critical and {len(high_changes)} high findings.",
            "findings": findings,
            "recommendations": recommendations,
            "change_explanations": change_explanations
        }

    async def close(self):
        await self.client.aclose()
