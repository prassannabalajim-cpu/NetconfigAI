class ComplianceValidationService:
    def validate_compliance(self, diff_result: dict, config_type: str) -> dict:
        cis_violations = []
        nist_violations = []
        pci_violations = []
        custom_policy_violations = []
        
        modified_rules = diff_result.get("modified_rules", [])
        
        for rule in modified_rules:
            # Example CIS violation
            if "0.0.0.0/0" in str(rule.get("new_value")):
                cis_violations.append({
                    "control_id": "CIS-4.1",
                    "framework": "CIS",
                    "title": "Ensure no security group allows unrestricted inbound access",
                    "description": "Found 0.0.0.0/0 allowed",
                    "severity": "critical",
                    "affected_resource": rule.get("path"),
                    "remediation": "Restrict CIDR to specific internal networks"
                })

        total_violations = len(cis_violations) + len(nist_violations) + len(pci_violations) + len(custom_policy_violations)
        overall_status = "compliant" if total_violations == 0 else "non_compliant"

        return {
            "cis_violations": cis_violations,
            "nist_violations": nist_violations,
            "pci_violations": pci_violations,
            "custom_policy_violations": custom_policy_violations,
            "overall_compliance_status": overall_status,
            "total_violations": total_violations
        }

compliance_service = ComplianceValidationService()
