import json
import yaml
import hcl2
from typing import Dict, Any

class ParserService:
    @staticmethod
    def parse_config(file_content: str, config_type: str) -> Dict[str, Any]:
        """
        Parses configuration file content based on the config_type.
        Supports Terraform (HCL), JSON, YAML.
        """
        config_type = config_type.upper()
        
        # Standard formats
        if config_type in (
            "GENERIC_JSON", "AWS_SECURITY_GROUP", "AWS_NACL",
            "AWS_ROUTE_TABLE", "AWS_VPN", "GCP_FIREWALL",
            "GCP_ROUTES", "AZURE_NSG"
        ):
            return json.loads(file_content)
            
        elif config_type in ("GENERIC_YAML", "AWS_TRANSIT_GATEWAY"):
            return yaml.safe_load(file_content) or {}
            
        elif config_type == "TERRAFORM_IAC":
            return hcl2.loads(file_content)
            
        else:
            # Fallback trial parsing order: JSON -> YAML -> HCL2
            try:
                return json.loads(file_content)
            except Exception:
                pass
                
            try:
                return yaml.safe_load(file_content) or {}
            except Exception:
                pass
                
            try:
                return hcl2.loads(file_content)
            except Exception:
                raise ValueError("Unsupported or malformed configuration format. Could not parse.")
