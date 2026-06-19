from deepdiff import DeepDiff
import difflib

class ConfigType:
    TERRAFORM = "terraform"
    JSON = "json"
    YAML = "yaml"
    AWS_SG = "aws_sg"
    GCP_FIREWALL = "gcp_firewall"

class DiffEngineService:
    def compute_diff(self, old_config: dict, new_config: dict, config_type: str) -> dict:
        """
        Use DeepDiff to identify all changes between old and new config.
        """
        ddiff = DeepDiff(old_config, new_config, ignore_order=True)
        
        # Parse DeepDiff output into our schema
        added_rules = []
        removed_rules = []
        modified_rules = []
        
        if 'dictionary_item_added' in ddiff:
            added_rules = [{"path": str(k), "value": v} for k, v in ddiff['dictionary_item_added'].items()]
        
        if 'dictionary_item_removed' in ddiff:
            removed_rules = [{"path": str(k), "value": v} for k, v in ddiff['dictionary_item_removed'].items()]
            
        if 'values_changed' in ddiff:
            modified_rules = [
                {
                    "path": str(k), 
                    "old_value": v['old_value'], 
                    "new_value": v['new_value']
                } 
                for k, v in ddiff['values_changed'].items()
            ]

        total_changes = len(added_rules) + len(removed_rules) + len(modified_rules)

        return {
            "added_rules": added_rules,
            "removed_rules": removed_rules,
            "modified_rules": modified_rules,
            "total_changes": total_changes,
            "raw_diff": ddiff.to_dict()
        }

diff_engine_service = DiffEngineService()
