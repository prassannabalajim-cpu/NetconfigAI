import json
import time
import httpx
import google.generativeai as genai
from app.config import settings
import structlog

logger = structlog.get_logger(__name__)

class AIAnalysisService:
    SYSTEM_PROMPT = """
You are an expert network security analyst with 20+ years of experience in
cloud security, network architecture, and compliance. You review network
configuration changes for enterprise organizations.

Your role is to:
1. Analyze configuration changes in the context of enterprise security
2. Explain technical changes in plain business English
3. Identify security risks with clear reasoning
4. Provide actionable recommendations
5. Make an approval recommendation (approve/reject/conditional)

Always structure your response as valid JSON matching the schema provided.
Be specific, accurate, and conservative - when in doubt, flag for human review.
"""

    async def analyze(self, diff_result: dict, risk_findings: list, config_type: str, ai_method: str = "ollama") -> dict:
        prompt = f"""
NETWORK CONFIGURATION CHANGE REVIEW REQUEST

Configuration Type: {config_type}
Total Changes Detected: {diff_result.get('total_changes', 0)}

CHANGE DETAILS:
{json.dumps(diff_result, indent=2)}

PRE-COMPUTED RISK INDICATORS:
{json.dumps(risk_findings, indent=2)}

Please analyze these changes and respond ONLY with a JSON object:
{{
  "overall_risk_level": "low|medium|high|critical",
  "risk_score": 0,
  "executive_summary": "<2-3 sentence plain English summary for management>",
  "technical_summary": "<detailed technical explanation>",
  "findings": [
    {{
      "change": "<what changed>",
      "impact": "<business and security impact>",
      "risk_level": "low|medium|high|critical",
      "recommendation": "<specific action to take>"
    }}
  ],
  "overall_recommendation": "approve|reject|approve_with_conditions",
  "recommendation_rationale": "<clear explanation>",
  "conditions": ["<condition 1 if conditional>"]
}}
"""
        start_time = time.time()
        
        if ai_method == "gemini" and settings.GEMINI_API_KEY:
            raw_response = await self._call_gemini(prompt)
            model_used = settings.GEMINI_MODEL
        else:
            raw_response = await self._call_ollama(prompt)
            model_used = settings.OLLAMA_MODEL
            
        response_time_ms = int((time.time() - start_time) * 1000)

        parsed_response = self._parse_llm_response(raw_response)
        parsed_response['llm_model_used'] = model_used
        parsed_response['llm_response_time_ms'] = response_time_ms
        return parsed_response

    async def _call_gemini(self, prompt: str) -> str:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            # Use JSON mode if supported by the model, otherwise just text
            model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                system_instruction=self.SYSTEM_PROMPT,
                generation_config={"response_mime_type": "application/json"}
            )
            response = await model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            logger.error("gemini_request_failed", error=str(e))
            # Fallback
            return json.dumps({
                "overall_risk_level": "high",
                "risk_score": 75,
                "executive_summary": "AI Analysis failed to run due to Gemini API failure. Defaulting to high risk.",
                "technical_summary": "Gemini API Error.",
                "findings": [],
                "overall_recommendation": "reject",
                "recommendation_rationale": "Cannot automatically verify safety due to LLM failure. Human review required.",
                "conditions": []
            })

    async def _call_ollama(self, prompt: str) -> str:
        payload = {
            "model": settings.OLLAMA_MODEL,
            "system": self.SYSTEM_PROMPT,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        
        async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT) as client:
            try:
                response = await client.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload)
                response.raise_for_status()
                return response.json().get("response", "{}")
            except Exception as e:
                logger.error("ollama_request_failed", error=str(e))
                # Fallback
                return json.dumps({
                    "overall_risk_level": "high",
                    "risk_score": 75,
                    "executive_summary": "AI Analysis failed to run due to LLM unavailability. Defaulting to high risk based on rule engine.",
                    "technical_summary": "LLM Unreachable.",
                    "findings": [],
                    "overall_recommendation": "reject",
                    "recommendation_rationale": "Cannot automatically verify safety due to LLM failure. Human review required.",
                    "conditions": []
                })

    def _parse_llm_response(self, raw: str) -> dict:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

ai_analysis_service = AIAnalysisService()
