# Sample Data — NetConfigAI

This folder contains sample configuration files to demonstrate NetConfigAI's capabilities.

## Files

| File | Description | Risk Level |
|---|---|---|
| `aws_sg_old_config.json` | AWS Security Group baseline (safe configuration) | LOW |
| `aws_sg_new_config.json` | AWS Security Group with risky changes | CRITICAL |
| `cisco_ios_old_config.txt` | Cisco IOS router baseline configuration | LOW |
| `cisco_ios_new_config.txt` | Cisco IOS with critical security regressions | CRITICAL |
| `expected_analysis_output.json` | Expected NetConfigAI AI output for the AWS diff | — |

## How to Use for Demo

1. Login to http://localhost:3000
2. Click **"New Analysis"** in the sidebar
3. Select **Config Type**: AWS Security Group
4. Select **Compliance Frameworks**: CIS + NIST + PCI-DSS
5. **Old Config**: Upload `aws_sg_old_config.json`
6. **New Config**: Upload `aws_sg_new_config.json`
7. Enter title: `"AWS Production Security Group - CR-2026-0892"`
8. Click **Submit & Analyze**
9. Wait ~15 seconds for AI analysis
10. Review the CRITICAL risk score, diff changes, compliance failures

## What the AI Detects

### AWS Config Changes (JSON)
- ✅ SSH opened to `0.0.0.0/0` → **CRITICAL** (was `10.0.1.0/24`)
- ✅ RDP port 3389 added to internet → **CRITICAL**
- ✅ DB CIDR expanded `/24` → `/8` → **HIGH**
- ✅ CloudTrail disabled → **HIGH**
- ✅ VPC Flow Logs disabled → **HIGH**
- ✅ DNS changed to public `8.8.8.8` → **MEDIUM**
- ✅ 7 compliance failures (CIS + NIST + PCI-DSS + SOC2)

### Cisco IOS Changes (Plain Text)
- ✅ `no service password-encryption` → **CRITICAL**
- ✅ `enable password cisco123` (weak, plain text) → **CRITICAL**
- ✅ Backdoor user account added → **CRITICAL**
- ✅ `transport input all` (Telnet enabled) → **HIGH**
- ✅ `no logging` → **HIGH**
- ✅ `snmp-server community public RW` → **CRITICAL**
- ✅ Management ACL removed → **HIGH**
