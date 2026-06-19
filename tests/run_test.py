import asyncio
import json
import os
import sys

# Add backend directory to sys path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.services.diff_engine_service import diff_engine_service
from app.services.risk_scoring_service import risk_scoring_service
from app.services.ai_analysis_service import ai_analysis_service
from app.services.compliance_service import compliance_service
from app.services.report_service import report_service

async def main():
    print("Starting AI Network Config Diff Reviewer Test...")
    
    # 1. Load sample files
    old_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'sample-configs', 'aws-sg-old.json'))
    new_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'sample-configs', 'aws-sg-new.json'))
    
    with open(old_file_path, 'r') as f:
        old_config = json.load(f)
    with open(new_file_path, 'r') as f:
        new_config = json.load(f)

    # 2. Run Diff Engine
    print("Running Diff Engine...")
    diff_result = diff_engine_service.compute_diff(old_config, new_config, "aws_sg")
    print(f"Detected {diff_result['total_changes']} changes.")

    # 3. Run Risk Scoring
    print("Running Rule-Based Risk Scoring...")
    risk_result = risk_scoring_service.evaluate_risk(diff_result)
    print(f"Risk Level: {risk_result['overall_risk_level'].value.upper()}, Score: {risk_result['risk_score']}")

    # 4. Run AI Analysis (Ollama)
    print("Running AI Analysis (requires Ollama to be running on localhost:11434)...")
    # If Ollama is not running, it will gracefully fallback.
    ai_result = await ai_analysis_service.analyze(diff_result, risk_result['findings'], "AWS Security Group")
    print("AI Executive Summary:", ai_result.get("executive_summary", "N/A"))

    # 5. Run Compliance Validation
    print("Running Compliance Validation...")
    compliance_result = compliance_service.validate_compliance(diff_result, "aws_sg")
    print(f"Compliance Status: {compliance_result['overall_compliance_status']}, Violations: {compliance_result['total_violations']}")

    # 6. Generate Report
    print("Generating Reports...")
    review_data = {
        "title": "AWS SG Update - Public Exposure Test",
        "status": "in_review",
        "risk_level": risk_result['overall_risk_level'].value,
        "ai_summary": ai_result.get("executive_summary", "No AI summary available."),
        "diff_result": diff_result,
        "risk_result": risk_result,
        "ai_result": ai_result,
        "compliance_result": compliance_result
    }
    
    os.makedirs(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'reports')), exist_ok=True)
    report_path_json = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'reports', 'report.json'))
    report_path_md = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'reports', 'report.md'))
    
    report_service.generate_json_report(review_data, report_path_json)
    report_service.generate_markdown_report(review_data, report_path_md)
    print(f"Reports generated successfully at:\n- {report_path_json}\n- {report_path_md}")
    
if __name__ == "__main__":
    asyncio.run(main())
