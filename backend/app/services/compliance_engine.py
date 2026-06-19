from typing import List, Dict, Any
from app.models.diff_change import DiffChange
from app.models.compliance import ComplianceFinding

class ComplianceEngine:
    """
    Enterprise compliance validation engine.
    Validates network config changes against CIS, NIST SP 800-53, PCI-DSS, and custom policies.
    """

    CIS_RULES = {
        "CIS-4.1": {
            "name": "Ensure no security groups allow ingress from 0.0.0.0/0 to port 22 (SSH)",
            "check": lambda c: not (
                c.new_value and "0.0.0.0/0" in str(c.new_value) and 
                any(p in str(c.field_name).lower() or p in str(c.field_path).lower() for p in ["22", "ssh"])
            ),
            "severity": "CRITICAL",
            "remediation": "Remove or restrict SSH access to specific trusted IP ranges only."
        },
        "CIS-4.2": {
            "name": "Ensure no security groups allow ingress from 0.0.0.0/0 to port 3389 (RDP)",
            "check": lambda c: not (
                c.new_value and "0.0.0.0/0" in str(c.new_value) and 
                any(p in str(c.field_name).lower() or p in str(c.field_path).lower() for p in ["3389", "rdp"])
            ),
            "severity": "CRITICAL",
            "remediation": "Remove or restrict RDP access. Use a VPN or bastion host instead."
        },
        "CIS-4.3": {
            "name": "Ensure VPC flow logging is enabled",
            "check": lambda c: not (
                "flow_log" in str(c.field_name).lower() and 
                str(c.new_value).lower() in ["false", "disabled", "off", "none"]
            ),
            "severity": "MEDIUM",
            "remediation": "Enable VPC flow logging for all active VPCs."
        },
        "CIS-5.1": {
            "name": "Ensure routing tables do not have unrestricted routes",
            "check": lambda c: not (
                c.new_value and "0.0.0.0/0" in str(c.new_value) and 
                "route" in str(c.field_name).lower()
            ),
            "severity": "HIGH",
            "remediation": "Review route table entries and restrict default routes (0.0.0.0/0) to internet gateways only."
        }
    }

    NIST_RULES = {
        "NIST-AC-17": {
            "name": "Remote Access Control - Restrict remote administration exposure",
            "check": lambda c: not (
                c.new_value and "0.0.0.0/0" in str(c.new_value) and 
                any(p in str(c.field_name).lower() for p in ["22", "3389", "ssh", "rdp"])
            ),
            "severity": "HIGH",
            "remediation": "Implement multi-factor authentication and restrict administrative access to trusted management subnets."
        },
        "NIST-SC-7": {
            "name": "Boundary Protection - Prevent unrestricted boundary traversal",
            "check": lambda c: not (
                c.change_type == "ADDED" and c.new_value and "0.0.0.0/0" in str(c.new_value)
            ),
            "severity": "CRITICAL",
            "remediation": "Implement boundary protection mechanisms at all network entry/exit points, avoiding 0.0.0.0/0."
        },
        "NIST-SI-4": {
            "name": "Information System Monitoring - Ensure logs/monitoring are not disabled",
            "check": lambda c: not (
                any(m in str(c.field_name).lower() for m in ["monitoring", "logging", "audit"]) and 
                str(c.new_value).lower() in ["false", "disabled", "off"]
            ),
            "severity": "MEDIUM",
            "remediation": "Ensure system monitoring configurations are not disabled during configuration updates."
        }
    }

    PCI_RULES = {
        "PCI-1.2.1": {
            "name": "Restrict inbound and outbound traffic to that required for cardholder data environment",
            "check": lambda c: not (
                c.new_value and "0.0.0.0/0" in str(c.new_value) and 
                any(p in str(c.field_name).lower() for p in ["3306", "5432", "mysql", "postgres", "database"])
            ),
            "severity": "CRITICAL",
            "remediation": "Database ports must not be exposed to 0.0.0.0/0. Restrict ingress to application nodes only."
        },
        "PCI-1.3.2": {
            "name": "Restrict inbound internet traffic to IP addresses within DMZ - Disallow IPv6 wildcard exposure",
            "check": lambda c: not (
                c.new_value and "::/0" in str(c.new_value)
            ),
            "severity": "HIGH",
            "remediation": "Restrict IPv6 wildcard access. Do not allow ::/0 inside firewall rules."
        }
    }

    CUSTOM_RULES = [
        {
            "id": "CUSTOM-001",
            "name": "No database port may be exposed to 0.0.0.0/0",
            "check": lambda c: not (
                any(p in str(c.field_name).lower() for p in ["3306", "5432", "27017", "database"]) and 
                c.new_value and "0.0.0.0/0" in str(c.new_value)
            ),
            "severity": "CRITICAL",
            "remediation": "Database access must be restricted to application tier subnets only."
        },
        {
            "id": "CUSTOM-002",
            "name": "VPN configurations must use AES-256 encryption",
            "check": lambda c: not (
                "vpn" in str(c.field_name).lower() and 
                c.new_value and not any(enc in str(c.new_value).lower() for enc in ["aes256", "aes-256"])
            ),
            "severity": "HIGH",
            "remediation": "Update VPN configuration to use AES-256 encryption algorithm or higher."
        }
    ]

    def validate(self, changes: List[DiffChange], frameworks: List[str]) -> List[ComplianceFinding]:
        """
        Validates a list of DiffChange objects against selected frameworks.
        Returns a list of unpersisted ComplianceFinding objects.
        """
        findings: List[ComplianceFinding] = []
        framework_set = {f.upper() for f in frameworks}

        if "CIS" in framework_set:
            findings.extend(self._check_framework(changes, self.CIS_RULES, "CIS"))

        if "NIST" in framework_set:
            findings.extend(self._check_framework(changes, self.NIST_RULES, "NIST"))

        if "PCI_DSS" in framework_set or "PCI-DSS" in framework_set:
            findings.extend(self._check_framework(changes, self.PCI_RULES, "PCI_DSS"))

        if "CUSTOM" in framework_set:
            findings.extend(self._check_custom(changes))

        return findings

    def _check_framework(self, changes: List[DiffChange], rules: Dict[str, Any], framework: str) -> List[ComplianceFinding]:
        findings: List[ComplianceFinding] = []
        for control_id, rule in rules.items():
            failing_changes = [c for c in changes if not rule["check"](c)]
            if failing_changes:
                affected_fields = ", ".join([c.field_name for c in failing_changes])
                findings.append(ComplianceFinding(
                    framework=framework,
                    control_id=control_id,
                    control_name=rule["name"],
                    status="FAIL",
                    finding_description=f"Change violates {control_id}: {rule['name']}. Affected fields: {affected_fields}",
                    remediation_guidance=rule["remediation"],
                    evidence=f"Found {len(failing_changes)} configuration changes violating this rule.",
                    severity=rule["severity"]
                ))
            else:
                findings.append(ComplianceFinding(
                    framework=framework,
                    control_id=control_id,
                    control_name=rule["name"],
                    status="PASS",
                    finding_description=f"All changes comply with {control_id}.",
                    remediation_guidance=None,
                    evidence=f"Checked {len(changes)} change(s). No violations found.",
                    severity=rule["severity"]
                ))
        return findings

    def _check_custom(self, changes: List[DiffChange]) -> List[ComplianceFinding]:
        findings: List[ComplianceFinding] = []
        for rule in self.CUSTOM_RULES:
            failing_changes = [c for c in changes if not rule["check"](c)]
            if failing_changes:
                affected_fields = ", ".join([c.field_name for c in failing_changes])
                findings.append(ComplianceFinding(
                    framework="CUSTOM",
                    control_id=rule["id"],
                    control_name=rule["name"],
                    status="FAIL",
                    finding_description=f"VIOLATION: {rule['name']}. Affected: {affected_fields}",
                    remediation_guidance=rule["remediation"],
                    evidence=f"{len(failing_changes)} violation(s) found.",
                    severity=rule["severity"]
                ))
            else:
                findings.append(ComplianceFinding(
                    framework="CUSTOM",
                    control_id=rule["id"],
                    control_name=rule["name"],
                    status="PASS",
                    finding_description=f"No violations detected for custom rule {rule['id']}.",
                    remediation_guidance=None,
                    evidence="No violations found.",
                    severity=rule["severity"]
                ))
        return findings
