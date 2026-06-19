import json
import re
import difflib
import ipaddress
from deepdiff import DeepDiff
from typing import Any, Dict, List, Tuple
from app.models.diff_change import DiffChange


class ConfigDiffEngine:
    SENSITIVE_PORTS = {22, 23, 3389, 3306, 5432, 6379, 9200, 27017, 5984, 6443, 8080, 8443, 9092, 2379, 2380}
    CRITICAL_CIDRS = {"0.0.0.0/0", "::/0"}
    INTERNAL_CIDR_PREFIXES = (
        "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
        "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.",
        "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168."
    )
    CRITICAL_KEYWORDS = ["password", "secret", "key", "token", "credential", "auth", "private"]
    HIGH_RISK_KEYWORDS = ["vpn", "encryption", "psk", "ike", "tunnel", "cert", "tls", "ssl"]
    MEDIUM_RISK_KEYWORDS = ["route", "next_hop", "gateway", "rule", "policy", "acl", "firewall", "dns", "nameserver", "hostname"]

    def compute_diff(self, old_config: Dict[str, Any], new_config: Dict[str, Any]) -> List[DiffChange]:
        """
        Computes structural diff between two configuration dictionaries.
        Returns a list of unpersisted DiffChange objects with risk scores.
        """
        changes: List[DiffChange] = []
        diff = DeepDiff(old_config, new_config, ignore_order=True, verbose_level=2)

        # 1. Process added items
        for path, value in diff.get("dictionary_item_added", {}).items():
            change = self._process_change(path, None, value, "ADDED")
            changes.append(change)

        # 2. Process removed items
        for path, value in diff.get("dictionary_item_removed", {}).items():
            change = self._process_change(path, value, None, "REMOVED")
            changes.append(change)

        # 3. Process modified values
        for path, change_info in diff.get("values_changed", {}).items():
            change = self._process_change(
                path,
                change_info.get("old_value"),
                change_info.get("new_value"),
                "MODIFIED"
            )
            changes.append(change)

        # 4. Process type changes
        for path, change_info in diff.get("type_changes", {}).items():
            change = self._process_change(
                path,
                str(change_info.get("old_value", "")),
                str(change_info.get("new_value", "")),
                "MODIFIED"
            )
            changes.append(change)

        # 5. Process iterable additions
        for path, items in diff.get("iterable_item_added", {}).items():
            for item in (items if isinstance(items, list) else [items]):
                change = self._process_change(path, None, item, "ADDED")
                changes.append(change)

        # 6. Process iterable removals
        for path, items in diff.get("iterable_item_removed", {}).items():
            for item in (items if isinstance(items, list) else [items]):
                change = self._process_change(path, item, None, "REMOVED")
                changes.append(change)

        # Sort changes by risk score descending
        return sorted(changes, key=lambda c: c.risk_score, reverse=True)

    def compute_text_diff(self, old_text: str, new_text: str) -> List[DiffChange]:
        """
        Line-by-line unified diff for plain-text config files (e.g., Cisco IOS, raw text).
        Returns DiffChange objects with semantic risk scoring.
        """
        changes: List[DiffChange] = []
        old_lines = old_text.splitlines(keepends=True)
        new_lines = new_text.splitlines(keepends=True)

        unified = list(difflib.unified_diff(old_lines, new_lines, n=0))
        # Parse unified diff hunks
        for line in unified:
            if line.startswith("---") or line.startswith("+++") or line.startswith("@@"):
                continue
            if line.startswith("+"):
                content = line[1:].strip()
                field_name = self._infer_field_name_from_line(content)
                risk_level, risk_score = self._compute_risk_from_line(content, "ADDED")
                changes.append(DiffChange(
                    field_path=f"line.added",
                    field_name=field_name,
                    old_value=None,
                    new_value=content,
                    change_type="ADDED",
                    risk_level=risk_level,
                    risk_score=risk_score,
                    ai_explanation=f"New line added: {content[:100]}",
                    affected_resource=self._infer_resource_from_line(content)
                ))
            elif line.startswith("-"):
                content = line[1:].strip()
                field_name = self._infer_field_name_from_line(content)
                risk_level, risk_score = self._compute_risk_from_line(content, "REMOVED")
                changes.append(DiffChange(
                    field_path=f"line.removed",
                    field_name=field_name,
                    old_value=content,
                    new_value=None,
                    change_type="REMOVED",
                    risk_level=risk_level,
                    risk_score=risk_score,
                    ai_explanation=f"Line removed: {content[:100]}",
                    affected_resource=self._infer_resource_from_line(content)
                ))

        return sorted(changes, key=lambda c: c.risk_score, reverse=True)

    def _process_change(self, path: str, old_value: Any, new_value: Any, change_type: str) -> DiffChange:
        """
        Classifies a change, extracts name and details, and computes its risk score.
        """
        field_name = self._extract_field_name(path)
        risk_level, risk_score = self._compute_risk(field_name, old_value, new_value, change_type)

        return DiffChange(
            field_path=str(path),
            field_name=field_name,
            old_value=self._safe_str(old_value),
            new_value=self._safe_str(new_value),
            change_type=change_type,
            risk_level=risk_level,
            risk_score=risk_score,
            affected_resource=self._extract_resource_name(path)
        )

    def _safe_str(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            try:
                return json.dumps(value, default=str)[:500]
            except Exception:
                return str(value)[:500]
        return str(value)[:500]

    def _compute_risk(self, field_name: str, old_value: Any, new_value: Any, change_type: str) -> Tuple[str, float]:
        """
        Comprehensive rule-based risk scoring. Returns (risk_level, risk_score).
        """
        field_lower = field_name.lower()
        new_val_str = str(new_value).lower() if new_value is not None else ""
        old_val_str = str(old_value).lower() if old_value is not None else ""

        # CRITICAL: Credentials/secrets/keys changed
        if any(k in field_lower for k in self.CRITICAL_KEYWORDS):
            return "CRITICAL", 95.0

        # CRITICAL: Exposure of sensitive ports to public internet
        is_port_field = any(k in field_lower for k in ["port", "from_port", "to_port", "destination_port", "dport", "sport"])
        if is_port_field:
            try:
                port_str = new_val_str.split("-")[0].strip() if new_val_str else "0"
                if port_str.isdigit():
                    port = int(port_str)
                    if port in self.SENSITIVE_PORTS:
                        if any(cidr in new_val_str or cidr in old_val_str for cidr in self.CRITICAL_CIDRS):
                            return "CRITICAL", 98.0
                        return "HIGH", 78.0
            except ValueError:
                pass

        # CRITICAL: New exposure to public internet (0.0.0.0/0)
        if any(cidr in new_val_str for cidr in self.CRITICAL_CIDRS):
            if not old_val_str or not any(cidr in old_val_str for cidr in self.CRITICAL_CIDRS):
                if change_type == "ADDED":
                    return "CRITICAL", 92.0
                return "CRITICAL", 96.0

        # HIGH: CIDR expansion (e.g., /24 → /16 = more hosts exposed)
        is_cidr_field = any(k in field_lower for k in ["cidr", "source_range", "ip_range", "prefix", "subnet"])
        if is_cidr_field and old_val_str and new_val_str:
            if self._is_cidr_expansion(old_val_str, new_val_str):
                return "HIGH", 74.0

        # HIGH: Protocol wildcard (TCP → ALL)
        if "protocol" in field_lower:
            wildcards = ["-1", "all", "*", "any"]
            if any(w in new_val_str for w in wildcards) and not any(w in old_val_str for w in wildcards):
                return "HIGH", 76.0

        # HIGH: VPN / encryption / TLS settings
        if any(k in field_lower for k in self.HIGH_RISK_KEYWORDS):
            return "HIGH", 70.0

        # HIGH: DNS / hostname changes (can redirect traffic)
        if any(k in field_lower for k in ["dns", "nameserver", "resolver", "hostname", "domain"]):
            return "HIGH", 65.0

        # HIGH: Authentication/authorization changes
        if any(k in field_lower for k in ["auth", "mfa", "2fa", "access_key", "iam", "role", "permission"]):
            return "HIGH", 68.0

        # MEDIUM: Route / firewall policy changes
        if any(k in field_lower for k in self.MEDIUM_RISK_KEYWORDS):
            return "MEDIUM", 45.0

        # MEDIUM: Port/service changes (non-sensitive)
        if is_port_field:
            return "MEDIUM", 40.0

        # MEDIUM: CIDR change (not expansion)
        if is_cidr_field:
            return "MEDIUM", 35.0

        # MEDIUM: Logging/monitoring disabled
        if any(k in field_lower for k in ["logging", "monitoring", "audit", "flow_log"]):
            if "false" in new_val_str or "disabled" in new_val_str or "off" in new_val_str:
                return "HIGH", 65.0
            return "MEDIUM", 35.0

        # LOW: Metadata (tags, labels, descriptions)
        if any(k in field_lower for k in ["tag", "label", "name", "description", "comment", "annotation"]):
            return "LOW", 8.0

        # LOW: Counts, timeouts, limits
        if any(k in field_lower for k in ["timeout", "count", "max", "min", "limit", "interval"]):
            return "LOW", 15.0

        # Default medium-low fallback
        return "LOW", 20.0

    def _compute_risk_from_line(self, line: str, change_type: str) -> Tuple[str, float]:
        """Risk scoring for plain-text config lines."""
        line_lower = line.lower()

        if any(k in line_lower for k in self.CRITICAL_KEYWORDS):
            return "CRITICAL", 90.0
        if any(cidr in line_lower for cidr in self.CRITICAL_CIDRS):
            return "CRITICAL", 88.0
        if any(k in line_lower for k in ["permit any", "allow any", "0.0.0.0"]):
            return "HIGH", 80.0
        if any(k in line_lower for k in self.HIGH_RISK_KEYWORDS):
            return "HIGH", 65.0
        if any(k in line_lower for k in ["no ip", "shutdown", "deny", "block"]):
            return "MEDIUM", 50.0
        if any(k in line_lower for k in self.MEDIUM_RISK_KEYWORDS):
            return "MEDIUM", 40.0
        return "LOW", 15.0

    def _infer_field_name_from_line(self, line: str) -> str:
        """Extract a meaningful field name from a plain-text config line."""
        line = line.strip()
        # Try key = value or key value patterns
        kv_match = re.match(r'^([\w\-\.]+)\s*[=:]\s*(.+)', line)
        if kv_match:
            return kv_match.group(1).replace("-", " ").replace("_", " ").title()
        # Take first token as field name
        parts = line.split()
        if parts:
            return parts[0].replace("-", " ").replace("_", " ").title()
        return "Configuration Line"

    def _infer_resource_from_line(self, line: str) -> str:
        """Infer an affected resource name from a plain-text config line."""
        line = line.strip()
        parts = line.split()
        if len(parts) >= 2:
            return f"{parts[0]} {parts[1]}"
        return "Configuration"

    def _is_cidr_expansion(self, old_cidr: str, new_cidr: str) -> bool:
        """Determines if the new CIDR block is broader than the old CIDR block."""
        # Extract first valid CIDR from string
        cidr_pattern = r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}'
        old_matches = re.findall(cidr_pattern, old_cidr)
        new_matches = re.findall(cidr_pattern, new_cidr)
        if not old_matches or not new_matches:
            return False
        try:
            old_net = ipaddress.ip_network(old_matches[0], strict=False)
            new_net = ipaddress.ip_network(new_matches[0], strict=False)
            return new_net.prefixlen < old_net.prefixlen
        except ValueError:
            return False

    def _extract_field_name(self, path: str) -> str:
        """
        Converts a DeepDiff path string (e.g. "root['rules'][0]['cidr']") to a human-readable name.
        """
        cleaned = re.sub(r"root\[", "", str(path))
        cleaned = re.sub(r"\]\[", ".", cleaned)
        cleaned = re.sub(r"[\[\]'\"]", "", cleaned)
        # Convert snake_case to Title Case for readability
        parts = cleaned.split(".")
        readable_parts = []
        for p in parts:
            if p.isdigit():
                readable_parts.append(f"Item {p}")
            else:
                readable_parts.append(p.replace("_", " ").replace("-", " ").title())
        return " → ".join(readable_parts) if len(readable_parts) > 1 else readable_parts[0] if readable_parts else cleaned

    def _extract_resource_name(self, path: str) -> str:
        """Extracts resource identifier from path string."""
        parts = str(path).split("[")
        if len(parts) > 1:
            return parts[1].strip("']\"")
        return "Unknown Resource"
