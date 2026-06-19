// @ts-nocheck
import { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Accordion, AccordionSummary, AccordionDetails,
  Button, Chip, Divider, Fade, TextField, CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ShieldIcon from '@mui/icons-material/Shield';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SecurityIcon from '@mui/icons-material/Security';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PsychologyIcon from '@mui/icons-material/Psychology';
import WarningIcon from '@mui/icons-material/Warning';
import SendIcon from '@mui/icons-material/Send';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface HelpPageProps {
  onStartTour: () => void;
}

const FEATURES = [
  {
    icon: <CloudUploadIcon />,
    color: '#3B82F6',
    title: 'Upload & Analyze',
    desc: 'Upload Old and New configuration files in JSON, YAML, or plain text (Cisco IOS, Palo Alto). Local Ollama Llama 3 performs deep analysis of every change.'
  },
  {
    icon: <AssessmentIcon />,
    color: '#8B5CF6',
    title: 'Diff Engine',
    desc: 'Semantic diff engine detects ADDED, REMOVED, and MODIFIED fields across nested structures. Every change is scored with a risk level from LOW to CRITICAL.'
  },
  {
    icon: <ShieldIcon />,
    color: '#10B981',
    title: 'Compliance Checks',
    desc: 'Automatically validates configuration changes against CIS Benchmarks, NIST 800-53, PCI-DSS, and SOC2 controls. Shows Pass/Fail per control.'
  },
  {
    icon: <PsychologyIcon />,
    color: '#F59E0B',
    title: 'AI Risk Scoring',
    desc: 'Local Ollama Llama 3 evaluates each change for security impact, compliance posture, and business risk. Generates an executive summary with actionable recommendations.'
  },
  {
    icon: <WarningIcon />,
    color: '#F97316',
    title: 'Workflow Actions',
    desc: 'Approve, Reject, or Escalate reviews with a comment. All actions are logged to the immutable Audit Trail for compliance and accountability.'
  },
  {
    icon: <DownloadIcon />,
    color: '#06B6D4',
    title: 'PDF Reports',
    desc: 'Download a clean enterprise PDF report including risk charts, compliance findings, AI summary, addressed controls, and executive recommendations.'
  },
];

const RISK_LEVELS = [
  { level: 'CRITICAL', color: '#EF4444', desc: 'Score 90-100. Immediate action required. Examples: public internet exposure, credential changes, wildcard protocol rules.' },
  { level: 'HIGH', color: '#F97316', desc: 'Score 65-89. Significant security risk. Examples: CIDR expansion, VPN changes, DNS server changes, sensitive port exposure.' },
  { level: 'MEDIUM', color: '#F59E0B', desc: 'Score 35-64. Moderate risk requiring review. Examples: firewall rule changes, route modifications, port number changes.' },
  { level: 'LOW', color: '#10B981', desc: 'Score 0-34. Minimal security impact. Examples: tag updates, description changes, timeout value adjustments.' },
];

const FAQS = [
  {
    q: 'What file formats are supported?',
    a: 'JSON (.json), YAML (.yaml, .yml), and plain text (.txt, .cfg, .conf). This covers AWS Security Groups, Azure NSGs, GCP Firewall Rules, Cisco IOS, Palo Alto, and generic configurations.'
  },
  {
    q: 'How does the risk score work?',
    a: 'Each detected change is scored 0-100 by our rule engine plus local Ollama Llama 3. The highest individual change score becomes the overall review risk level (CRITICAL/HIGH/MEDIUM/LOW). Public internet exposure, credential changes, and sensitive port additions score highest.'
  },
  {
    q: 'What compliance frameworks are checked?',
    a: 'CIS Benchmarks, NIST 800-53, PCI-DSS, and SOC2. You can select specific frameworks when submitting a review. Each framework check generates specific Pass/Fail findings with remediation guidance.'
  },
  {
    q: 'How do I Approve or Reject a review?',
    a: 'Open a review from the dashboard or history. In the Workflow Timeline tab, click the Approve, Reject, or Escalate button. You will be prompted to enter a mandatory comment before the action is recorded.'
  },
  {
    q: 'Why does my review show "Under Analysis"?',
    a: 'This means the Celery background worker is running local Ollama Llama 3 analysis. This typically takes 10-45 seconds. The page auto-refreshes every 3 seconds while analysis is in progress.'
  },
  {
    q: 'Can I re-run the tour?',
    a: 'Yes! Click the "Start Interactive Tour" button on this page, or clear your browser localStorage to trigger it automatically on next login.'
  },
  {
    q: 'How do I download a PDF report?',
    a: 'Open an approved review and click the "Download PDF Report" button at the top right. Network engineers can download only after manager approval; rejected reviews show the manager reason and AI summary for remediation.'
  },
  {
    q: 'What does the Audit Log track?',
    a: 'All workflow actions (approve, reject, escalate), review submissions, report downloads, and user logins are recorded with timestamp, user email, role, and action details. This log is immutable and used for compliance auditing.'
  },
];

export default function HelpPage({ onStartTour }: HelpPageProps) {
  const [expanded, setExpanded] = useState<string | false>(false);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);

  const askAssistant = async () => {
    if (!assistantQuestion.trim()) return;
    setAssistantLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assistant/chat`, { message: assistantQuestion.trim() });
      setAssistantAnswer(res.data.answer);
    } catch (error: any) {
      setAssistantAnswer(error.response?.data?.detail || 'Assistant is unavailable. Please use the documentation below.');
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <Fade in>
      <Box sx={{ p: { xs: 2, md: 3 }, pb: 8, maxWidth: 1100, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 5, textAlign: 'center' }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <SecurityIcon sx={{ fontSize: 36, color: '#3B82F6' }} />
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'white' }}>
              NetConfig<span style={{ color: '#3B82F6' }}>AI</span> Documentation
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ color: '#64748B', mb: 3, maxWidth: 600, mx: 'auto' }}>
            Enterprise-grade AI-powered network configuration change review platform.
            Complete guide to all features and workflows.
          </Typography>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={onStartTour}
            id="start-tour-btn"
            sx={{
              bgcolor: '#3B82F6',
              fontWeight: 700,
              borderRadius: 2,
              px: 4,
              py: 1.2,
              boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
              '&:hover': { bgcolor: '#2563EB' },
            }}
          >
            Start Interactive Tour
          </Button>
        </Box>

        <Paper
          sx={{
            p: 3,
            mb: 5,
            bgcolor: 'rgba(15,23,42,0.78)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <PsychologyIcon sx={{ color: '#3B82F6' }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 800 }}>
              AI Help Assistant
            </Typography>
            <Chip label="App guidance only" size="small" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', fontWeight: 700 }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              placeholder="Ask how to upload configs, approve a review, download reports, or use any page..."
              value={assistantQuestion}
              onChange={(e) => setAssistantQuestion(e.target.value)}
              sx={{
                '& textarea': { color: 'white' },
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
              }}
            />
            <Button
              variant="contained"
              onClick={askAssistant}
              disabled={assistantLoading || !assistantQuestion.trim()}
              startIcon={assistantLoading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              sx={{ bgcolor: '#3B82F6', fontWeight: 700, minWidth: 120, py: 1.4 }}
            >
              Ask
            </Button>
          </Box>
          {assistantAnswer && (
            <Paper sx={{ mt: 2, p: 2, bgcolor: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ color: '#CBD5E1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {assistantAnswer}
              </Typography>
            </Paper>
          )}
        </Paper>

        {/* Features Grid */}
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 3 }}>
          Platform Features
        </Typography>
        <Grid container spacing={2.5} sx={{ mb: 5 }}>
          {FEATURES.map((f) => (
            <Grid item xs={12} sm={6} md={4} key={f.title}>
              <Paper
                sx={{
                  p: 3,
                  bgcolor: 'rgba(15,23,42,0.75)',
                  border: `1px solid ${f.color}22`,
                  borderRadius: 3,
                  height: '100%',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: `${f.color}44`,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 32px ${f.color}15`,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ color: f.color, display: 'flex' }}>{f.icon}</Box>
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>
                    {f.title}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6 }}>
                  {f.desc}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Risk Level Guide */}
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 3 }}>
          Understanding Risk Levels
        </Typography>
        <Grid container spacing={2} sx={{ mb: 5 }}>
          {RISK_LEVELS.map((r) => (
            <Grid item xs={12} sm={6} key={r.level}>
              <Paper
                sx={{
                  p: 2.5,
                  bgcolor: 'rgba(15,23,42,0.75)',
                  border: `1px solid ${r.color}22`,
                  borderRadius: 3,
                  display: 'flex',
                  gap: 2,
                  alignItems: 'flex-start',
                }}
              >
                <Chip
                  label={r.level}
                  sx={{
                    bgcolor: `${r.color}20`,
                    color: r.color,
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    minWidth: 72,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6 }}>
                  {r.desc}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Workflow Steps */}
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 3 }}>
          Standard Workflow
        </Typography>
        <Paper
          sx={{
            p: 3,
            mb: 5,
            bgcolor: 'rgba(15,23,42,0.75)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 3,
          }}
        >
          {[
            { step: '1', title: 'Upload Configurations', desc: 'Go to New Analysis. Select config type and compliance frameworks. Upload the OLD (baseline) and NEW (proposed) configuration files.', color: '#3B82F6' },
            { step: '2', title: 'Submit for Analysis', desc: 'Enter a review title and optional ticket ID. Click Submit & Analyze. Local Ollama Llama 3 starts analyzing in the background (10-45 seconds).', color: '#8B5CF6' },
            { step: '3', title: 'Review Results', desc: 'Open the review to see: AI Summary, Diff Analysis (all changes with risk scores), Compliance Findings, and Risk Score gauge.', color: '#F59E0B' },
            { step: '4', title: 'Take Workflow Action', desc: 'Click Approve (low risk, no issues) or Reject (problems found) with a mandatory comment. Or Escalate to senior review if unsure.', color: '#10B981' },
            { step: '5', title: 'Download Report', desc: 'After manager approval, click Download PDF Report to get a complete enterprise report with charts, compliance summary, and AI recommendations.', color: '#06B6D4' },
          ].map((step, i) => (
            <Box key={step.step}>
              {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 2 }} />}
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: `${step.color}20`,
                    border: `2px solid ${step.color}50`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Typography sx={{ color: step.color, fontWeight: 800, fontSize: '0.85rem' }}>
                    {step.step}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6 }}>
                    {step.desc}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>

        {/* FAQ */}
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 3 }}>
          Frequently Asked Questions
        </Typography>
        <Box>
          {FAQS.map((faq, i) => (
            <Accordion
              key={i}
              expanded={expanded === `faq-${i}`}
              onChange={(_, isExp) => setExpanded(isExp ? `faq-${i}` : false)}
              sx={{
                bgcolor: 'rgba(15,23,42,0.75)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px !important',
                mb: 1,
                '&:before': { display: 'none' },
                boxShadow: 'none',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#64748B' }} />}
                sx={{ color: 'white', fontWeight: 600, '& .MuiAccordionSummary-content': { my: 1 } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <HelpOutlineIcon sx={{ color: '#3B82F6', fontSize: 18, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
                    {faq.q}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 2 }}>
                <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.7, pl: 4 }}>
                  {faq.a}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        {/* Footer CTA */}
        <Paper
          sx={{
            mt: 5,
            p: 4,
            bgcolor: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 1 }}>
            Ready to get started?
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
            Take the interactive tour to learn all features step by step, or jump straight into your first analysis.
          </Typography>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={onStartTour}
            sx={{ bgcolor: '#3B82F6', fontWeight: 700, borderRadius: 2, px: 4, '&:hover': { bgcolor: '#2563EB' } }}
          >
            Start Interactive Tour
          </Button>
        </Paper>
      </Box>
    </Fade>
  );
}
