// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, Divider, LinearProgress,
  Tab, Tabs, CircularProgress, Alert, IconButton, Tooltip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Fade,
  Avatar, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';

import ShieldIcon from '@mui/icons-material/Shield';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const getToken = () => sessionStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const RISK_COLORS: Record<string, string> = {
  LOW: '#10B981', MEDIUM: '#F59E0B', HIGH: '#F97316', CRITICAL: '#EF4444', UNKNOWN: '#6B7280'
};
const STATUS_COLORS: Record<string, string> = {
  pending_review: '#F59E0B', under_analysis: '#3B82F6', approved: '#10B981',
  rejected: '#EF4444', draft: '#6B7280', in_review: '#8B5CF6',
  failed: '#EF4444', closed: '#6B7280'
};

interface ReviewDetailPageProps {
  reviewId: string;
  onBack: () => void;
}

function TabPanel({ children, value, index }: any) {
  return (
    <Box hidden={value !== index} sx={{ pt: 3 }}>
      {value === index && children}
    </Box>
  );
}

function RiskGauge({ score, level }: { score: number; level: string }) {
  const color = RISK_COLORS[level?.toUpperCase()] || '#6B7280';
  const safeScore = Math.max(0, Math.min(Number(score) || 0, 100));
  const data = [{ name: 'Risk', value: safeScore, fill: color }];
  return (
    <Box sx={{ textAlign: 'center', minHeight: 238 }}>
      <ResponsiveContainer width="100%" height={150}>
        <RadialBarChart cx="50%" cy="100%" innerRadius="60%" outerRadius="80%" startAngle={180} endAngle={0} data={data}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={10} />
        </RadialBarChart>
      </ResponsiveContainer>
      <Box sx={{ mt: 1 }}>
        <Typography
          component="div"
          sx={{ color, fontWeight: 900, fontSize: { xs: '3rem', sm: '3.5rem' }, lineHeight: 1, letterSpacing: 0 }}
        >
          {Math.round(safeScore)}
        </Typography>
        <Chip
          label={level?.toUpperCase() || 'UNKNOWN'}
          sx={{ bgcolor: color, color: 'white', fontWeight: 700, fontSize: '0.85rem', px: 1, mt: 1 }}
        />
      </Box>
    </Box>
  );
}

export default function ReviewDetailPage({ reviewId, onBack }: ReviewDetailPageProps) {
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [pollingStatus, setPollingStatus] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Workflow action state
  const [actionDialog, setActionDialog] = useState<'approve' | 'reject' | 'escalate' | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReview = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/reviews/${reviewId}`, { headers: authHeaders() });
      setReview(res.data);
      setError('');
      // If still analyzing, keep polling
      if (res.data.status === 'under_analysis') {
        setPollingStatus(true);
      } else {
        setPollingStatus(false);
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load review');
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  // Poll if analysis is in progress
  useEffect(() => {
    if (!pollingStatus) return;
    const interval = setInterval(() => {
      fetchReview();
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingStatus, fetchReview]);

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/report/${reviewId}?format=pdf`, {
        headers: authHeaders(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `NetConfigAI_Report_${reviewId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('✅ Report downloaded successfully!');
    } catch (e: any) {
      toast.error('Failed to download report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleWorkflowAction = async () => {
    if (!actionComment.trim()) { toast.warning('Please enter a comment'); return; }
    setActionLoading(true);
    try {
      const endpoint = `${API_BASE}/api/v1/reviews/${reviewId}/${actionDialog}`;
      await axios.patch(endpoint, { comment: actionComment }, { headers: authHeaders() });
      toast.success(`✅ Review ${actionDialog}d successfully!`);
      setActionDialog(null);
      setActionComment('');
      await fetchReview();
      setTab(4); // Switch to Workflow tab to see the new entry
    } catch (e: any) {
      toast.error(`Failed to ${actionDialog}: ${e.response?.data?.detail || e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={56} sx={{ color: '#3B82F6' }} />
          <Typography sx={{ mt: 2, color: '#94A3B8' }}>Loading review analysis...</Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: '#94A3B8', mb: 3 }}>Back to Dashboard</Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const changes = review.diff_changes || [];
  const findings = review.compliance_findings || [];
  const steps = review.workflow_steps || [];
  const riskScore = review.overall_risk_score ?? 0;
  const riskLevel = (review.risk_level || 'unknown').toUpperCase();
  const currentUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('current_user') || 'null'); } catch { return null; }
  })();
  const userRole = currentUser?.role || 'network_engineer';
  const reviewerRoles = ['manager', 'admin', 'super_admin', 'approver', 'security_reviewer'];
  const canReview = reviewerRoles.includes(userRole);
  const canDownload = review.status === 'approved';

  // Chart data
  const riskDistData = [
    { name: 'CRITICAL', value: changes.filter((c: any) => c.risk_level === 'CRITICAL').length },
    { name: 'HIGH', value: changes.filter((c: any) => c.risk_level === 'HIGH').length },
    { name: 'MEDIUM', value: changes.filter((c: any) => c.risk_level === 'MEDIUM').length },
    { name: 'LOW', value: changes.filter((c: any) => c.risk_level === 'LOW').length },
  ].filter(d => d.value > 0);

  const changeTypeData = [
    { name: 'Added', value: changes.filter((c: any) => c.change_type === 'ADDED').length, fill: '#10B981' },
    { name: 'Removed', value: changes.filter((c: any) => c.change_type === 'REMOVED').length, fill: '#EF4444' },
    { name: 'Modified', value: changes.filter((c: any) => c.change_type === 'MODIFIED').length, fill: '#F59E0B' },
  ].filter(d => d.value > 0);

  return (
    <Fade in>
      <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={onBack} sx={{ bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{review.title}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                {review.ticket_id && (
                  <Chip label={`Ticket: ${review.ticket_id}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#94A3B8' }} />
                )}
                <Chip label={review.config_type} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#3B82F6' }} />
                <Chip label={review.cloud_provider} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#8B5CF6' }} />
                <Chip
                  label={review.status?.replace('_', ' ').toUpperCase()}
                  size="small"
                  sx={{ bgcolor: STATUS_COLORS[review.status] + '33', color: STATUS_COLORS[review.status] || '#6B7280', fontWeight: 700 }}
                />
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {pollingStatus && (
              <Chip icon={<CircularProgress size={14} />} label="AI Analysis Running..." sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#3B82F6' }} />
            )}
            <Tooltip title="Refresh">
              <IconButton onClick={fetchReview} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownloadReport}
              disabled={downloading || !canDownload}
              sx={{ bgcolor: '#3B82F6', borderRadius: 2, fontWeight: 600 }}
            >
              {canDownload ? 'Download Report' : 'Awaiting Approval'}
            </Button>
          </Box>
        </Box>

        {review.status === 'rejected' && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(239,68,68,0.08)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>
            Manager rejected this change. Reason: {review.approval_comment || 'No comment provided.'} Suggested solution: {review.ai_summary || 'Review the high-risk diff items and resubmit with restricted access.'}
          </Alert>
        )}

        {/* Tab Navigation */}
        <Paper sx={{ bgcolor: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              '& .MuiTab-root': { color: '#94A3B8', fontWeight: 600 },
              '& .Mui-selected': { color: '#3B82F6' },
              '& .MuiTabs-indicator': { bgcolor: '#3B82F6' },
              px: 2
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<AssessmentIcon />} iconPosition="start" label="Overview" />
            <Tab icon={<CompareArrowsIcon />} iconPosition="start" label={`Diff Viewer (${changes.length})`} />
            <Tab icon={<AutoGraphIcon />} iconPosition="start" label="Risk & Compliance" />
            <Tab icon={<PsychologyIcon />} iconPosition="start" label="AI Analysis" />
            <Tab icon={<AccountTreeIcon />} iconPosition="start" label={`Workflow (${steps.length})`} />
          </Tabs>
        </Paper>

        {/* ── TAB 0: Overview ── */}
        <TabPanel value={tab} index={0}>
          <Grid container spacing={3}>
            {/* Risk Gauge */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, textAlign: 'center' }}>AI Risk Score</Typography>
                <RiskGauge score={riskScore} level={riskLevel} />
              </Paper>
            </Grid>

            {/* Summary Stats */}
            <Grid item xs={12} md={8}>
              <Grid container spacing={2} sx={{ height: '100%' }}>
                {[
                  { label: 'Total Changes', value: changes.length, color: '#3B82F6', icon: <CompareArrowsIcon /> },
                  { label: 'Compliance Score', value: `${Math.round(review.compliance_score ?? 100)}%`, color: '#10B981', icon: <ShieldIcon /> },
                  { label: 'Compliance Failures', value: findings.filter((f: any) => f.status === 'FAIL').length, color: '#EF4444', icon: <ErrorIcon /> },
                  { label: 'AI Recommendation', value: review.ai_recommendation || 'REVIEW', color: '#F59E0B', icon: <PsychologyIcon /> },
                ].map((stat) => (
                  <Grid item xs={6} key={stat.label}>
                    <Paper sx={{ p: 2.5, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>{stat.label}</Typography>
                      </Box>
                      <Typography variant="h4" sx={{ color: stat.color, fontWeight: 800 }}>{stat.value}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* AI Executive Summary */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <PsychologyIcon sx={{ color: '#3B82F6', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>AI Executive Summary</Typography>
                  {review.ai_recommendation && (
                    <Chip
                      label={review.ai_recommendation}
                      sx={{
                        bgcolor: review.ai_recommendation === 'APPROVE' ? '#10B98133' :
                          review.ai_recommendation === 'REJECT' ? '#EF444433' : '#F59E0B33',
                        color: review.ai_recommendation === 'APPROVE' ? '#10B981' :
                          review.ai_recommendation === 'REJECT' ? '#EF4444' : '#F59E0B',
                        fontWeight: 700
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ color: '#CBD5E1', lineHeight: 1.8 }}>
                  {review.ai_summary || (pollingStatus ? 'AI analysis is currently running. Please wait...' : 'No AI summary available.')}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* ── TAB 1: Diff Viewer ── */}
        <TabPanel value={tab} index={1}>
          <Paper sx={{ bgcolor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontFamily: 'monospace', color: '#94A3B8', fontWeight: 600 }}>
                {review.config_type} — {review.cloud_provider}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={`+${changes.filter((c: any) => c.change_type === 'ADDED').length}`} size="small" sx={{ bgcolor: '#10B98133', color: '#10B981', fontWeight: 700 }} />
                <Chip label={`-${changes.filter((c: any) => c.change_type === 'REMOVED').length}`} size="small" sx={{ bgcolor: '#EF444433', color: '#EF4444', fontWeight: 700 }} />
                <Chip label={`~${changes.filter((c: any) => c.change_type === 'MODIFIED').length}`} size="small" sx={{ bgcolor: '#F59E0B33', color: '#F59E0B', fontWeight: 700 }} />
              </Box>
            </Box>
            {changes.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography sx={{ color: '#94A3B8' }}>
                  {pollingStatus ? '⏳ Diff analysis is running...' : '✅ No differences detected between configurations.'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.82rem', maxHeight: '60vh', overflowY: 'auto' }}>
                {changes.map((change: any, idx: number) => {
                  const bgColor = change.change_type === 'ADDED' ? 'rgba(16,185,129,0.08)' :
                    change.change_type === 'REMOVED' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
                  const textColor = change.change_type === 'ADDED' ? '#10B981' :
                    change.change_type === 'REMOVED' ? '#EF4444' : '#F59E0B';
                  const prefix = change.change_type === 'ADDED' ? '+' :
                    change.change_type === 'REMOVED' ? '-' : '~';

                  return (
                    <Box key={idx} sx={{ display: 'flex', bgcolor: bgColor, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Box sx={{ width: 36, px: 1, color: '#475569', userSelect: 'none', borderRight: '1px solid rgba(255,255,255,0.06)', textAlign: 'right', py: 0.5, flexShrink: 0 }}>
                        {idx + 1}
                      </Box>
                      <Box sx={{ width: 28, color: textColor, px: 1, py: 0.5, flexShrink: 0, fontWeight: 700 }}>{prefix}</Box>
                      <Box sx={{ flex: 1, py: 0.5, px: 1, minWidth: 0 }}>
                        {change.change_type === 'MODIFIED' ? (
                          <>
                            <Box sx={{ color: '#EF4444', textDecoration: 'line-through', mb: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {change.old_value}
                            </Box>
                            <Box sx={{ color: '#10B981', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {change.new_value}
                            </Box>
                          </>
                        ) : (
                          <Box sx={{ color: textColor, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {change.old_value || change.new_value}
                          </Box>
                        )}
                        {change.ai_explanation && (
                          <Box sx={{ mt: 0.5, color: '#64748B', fontSize: '0.75rem', fontStyle: 'italic' }}>
                            💡 {change.ai_explanation}
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ flexShrink: 0, py: 0.5, px: 1 }}>
                        <Chip
                          label={change.risk_level}
                          size="small"
                          sx={{
                            bgcolor: (RISK_COLORS[change.risk_level] || '#6B7280') + '33',
                            color: RISK_COLORS[change.risk_level] || '#6B7280',
                            fontWeight: 700,
                            fontSize: '0.65rem',
                            height: 20
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </TabPanel>

        {/* ── TAB 2: Risk & Compliance ── */}
        <TabPanel value={tab} index={2}>
          <Grid container spacing={3}>
            {/* Risk Distribution Chart */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Risk Distribution</Typography>
                {riskDistData.length === 0 ? (
                  <Typography sx={{ color: '#94A3B8', textAlign: 'center', py: 4 }}>No risk data yet</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={riskDistData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {riskDistData.map((entry, i) => (
                          <Cell key={i} fill={RISK_COLORS[entry.name] || '#6B7280'} />
                        ))}
                      </Pie>
                      <ReTooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>

            {/* Change Types Chart */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Change Types</Typography>
                {changeTypeData.length === 0 ? (
                  <Typography sx={{ color: '#94A3B8', textAlign: 'center', py: 4 }}>No changes detected</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={changeTypeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#94A3B8' }} />
                      <YAxis tick={{ fill: '#94A3B8' }} />
                      <ReTooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {changeTypeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>

            {/* Compliance Score */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Compliance Score</Typography>
                <Typography variant="h2" sx={{ color: '#10B981', fontWeight: 800, mb: 1 }}>
                  {Math.round(review.compliance_score ?? 100)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={review.compliance_score ?? 100}
                  sx={{ height: 12, borderRadius: 6, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#10B981' } }}
                />
                <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
                  {findings.filter((f: any) => f.status === 'FAIL').length} violations / {findings.length} total checks
                </Typography>
              </Paper>
            </Grid>

            {/* Compliance Findings Table */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Compliance Findings</Typography>
                {findings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircleIcon sx={{ color: '#10B981', fontSize: 40 }} />
                    <Typography sx={{ color: '#94A3B8', mt: 1 }}>No compliance findings</Typography>
                  </Box>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: '#64748B', borderColor: 'rgba(255,255,255,0.06)' }}>Framework</TableCell>
                          <TableCell sx={{ color: '#64748B', borderColor: 'rgba(255,255,255,0.06)' }}>Control</TableCell>
                          <TableCell sx={{ color: '#64748B', borderColor: 'rgba(255,255,255,0.06)' }}>Status</TableCell>
                          <TableCell sx={{ color: '#64748B', borderColor: 'rgba(255,255,255,0.06)' }}>Severity</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {findings.map((f: any) => (
                          <TableRow key={f.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                            <TableCell sx={{ color: '#3B82F6', borderColor: 'rgba(255,255,255,0.06)' }}>{f.framework}</TableCell>
                            <TableCell sx={{ color: '#E2E8F0', borderColor: 'rgba(255,255,255,0.06)' }}>{f.control_id}: {f.control_name}</TableCell>
                            <TableCell sx={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                              <Chip label={f.status} size="small"
                                sx={{ bgcolor: f.status === 'FAIL' ? '#EF444433' : f.status === 'PASS' ? '#10B98133' : '#F59E0B33',
                                  color: f.status === 'FAIL' ? '#EF4444' : f.status === 'PASS' ? '#10B981' : '#F59E0B',
                                  fontWeight: 700, fontSize: '0.7rem' }} />
                            </TableCell>
                            <TableCell sx={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                              <Chip label={f.severity} size="small"
                                sx={{ bgcolor: (RISK_COLORS[f.severity] || '#6B7280') + '33',
                                  color: RISK_COLORS[f.severity] || '#6B7280', fontWeight: 700, fontSize: '0.7rem' }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* ── TAB 3: AI Analysis ── */}
        <TabPanel value={tab} index={3}>
          {pollingStatus ? (
            <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(30,41,59,0.7)', borderRadius: 3, border: '1px solid rgba(59,130,246,0.3)' }}>
              <CircularProgress size={48} sx={{ color: '#3B82F6', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#94A3B8' }}>Ollama AI is analyzing your configuration changes...</Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mt: 1 }}>This usually takes 15–30 seconds</Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {/* Executive Summary */}
              <Grid item xs={12}>
                <Paper sx={{ p: 4, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <PsychologyIcon sx={{ color: '#3B82F6', fontSize: 32 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Ollama AI Executive Summary</Typography>
                    <Chip
                      label={`Recommendation: ${review.ai_recommendation || 'REVIEW'}`}
                      sx={{
                        bgcolor: review.ai_recommendation === 'APPROVE' ? '#10B98122' : review.ai_recommendation === 'REJECT' ? '#EF444422' : '#F59E0B22',
                        color: review.ai_recommendation === 'APPROVE' ? '#10B981' : review.ai_recommendation === 'REJECT' ? '#EF4444' : '#F59E0B',
                        fontWeight: 700, border: '1px solid currentColor'
                      }}
                    />
                  </Box>
                  <Typography sx={{ color: '#CBD5E1', lineHeight: 2, fontSize: '1.05rem' }}>
                    {review.ai_summary || 'AI summary not available. Please ensure the analysis pipeline completed successfully.'}
                  </Typography>
                </Paper>
              </Grid>

              {/* Risk Score Breakdown */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Risk Evaluation</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{ minWidth: 104, textAlign: 'center' }}>
                      <Typography sx={{ color: RISK_COLORS[riskLevel] || '#6B7280', fontWeight: 900, fontSize: { xs: '2.75rem', sm: '3.5rem' }, lineHeight: 1, letterSpacing: 0 }}>
                        {Math.round(riskScore)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748B' }}>out of 100</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Chip label={riskLevel} sx={{ bgcolor: RISK_COLORS[riskLevel] + '22', color: RISK_COLORS[riskLevel], fontWeight: 700, mb: 1 }} />
                      <LinearProgress
                        variant="determinate"
                        value={riskScore}
                        sx={{
                          height: 16, borderRadius: 8, bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { bgcolor: RISK_COLORS[riskLevel] || '#6B7280' }
                        }}
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              {/* Top Risk Changes */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>High Risk Changes</Typography>
                  {changes.filter((c: any) => ['CRITICAL', 'HIGH'].includes(c.risk_level)).length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <CheckCircleIcon sx={{ color: '#10B981', fontSize: 32 }} />
                      <Typography sx={{ color: '#10B981', mt: 1 }}>No critical or high risk changes</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                      {changes.filter((c: any) => ['CRITICAL', 'HIGH'].includes(c.risk_level)).map((c: any) => (
                        <Box key={c.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2, p: 1.5, bgcolor: 'rgba(239,68,68,0.05)', borderRadius: 2, border: '1px solid rgba(239,68,68,0.1)' }}>
                          <ErrorIcon sx={{ color: RISK_COLORS[c.risk_level], fontSize: 20, mt: 0.3, flexShrink: 0 }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.field_name}</Typography>
                            <Typography variant="caption" sx={{ color: '#94A3B8' }}>{c.ai_explanation || `${c.change_type} — Risk: ${c.risk_level}`}</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
        </TabPanel>

        {/* ── TAB 4: Workflow ── */}
        <TabPanel value={tab} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Approval Workflow Timeline</Typography>
                {steps.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <AccountTreeIcon sx={{ color: '#94A3B8', fontSize: 40 }} />
                    <Typography sx={{ color: '#94A3B8', mt: 1 }}>No workflow steps yet</Typography>
                  </Box>
                ) : (
                  <Box>
                    {steps.map((step: any, idx: number) => {
                      const color = step.status === 'APPROVED' ? '#10B981' :
                        step.status === 'REJECTED' ? '#EF4444' :
                        step.status === 'ESCALATED' ? '#F97316' : '#3B82F6';
                      return (
                        <Box key={step.id} sx={{ display: 'flex', gap: 2, mb: 3 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Avatar sx={{ bgcolor: color + '22', color, border: `2px solid ${color}`, width: 40, height: 40, fontWeight: 700 }}>
                              {idx + 1}
                            </Avatar>
                            {idx < steps.length - 1 && (
                              <Box sx={{ width: 2, flex: 1, bgcolor: 'rgba(255,255,255,0.1)', mt: 1 }} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, pb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Chip label={step.status} size="small" sx={{ bgcolor: color + '22', color, fontWeight: 700 }} />
                              <Typography variant="body2" sx={{ color: '#94A3B8' }}>{step.actor_name} ({step.actor_role})</Typography>
                            </Box>
                            <Typography sx={{ color: '#E2E8F0', mb: 0.5 }}>{step.comment}</Typography>
                            {step.created_at && (
                              <Typography variant="caption" sx={{ color: '#64748B' }}>
                                {new Date(step.created_at).toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Action Panel */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Review Actions</Typography>
                <Typography variant="caption" sx={{ color: '#475569', display: 'block', mb: 3 }}>
                  Current status: <span style={{ color: STATUS_COLORS[review.status] || '#6B7280', fontWeight: 700 }}>{review.status?.replace(/_/g, ' ').toUpperCase()}</span>
                </Typography>
                {!canReview && (
                  <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(59,130,246,0.08)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.22)' }}>
                    Manager approval is required before you can download the report.
                  </Alert>
                )}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    fullWidth
                    disabled={!canReview || review.status === 'approved' || review.status === 'under_analysis'}
                    sx={{ bgcolor: '#10B981', py: 1.5, borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: '#059669', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }, '&:disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: '#334155' } }}
                    onClick={() => { setActionDialog('approve'); setActionComment(''); }}
                  >
                    ✅ Approve Change
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    fullWidth
                    disabled={!canReview || review.status === 'rejected' || review.status === 'under_analysis'}
                    sx={{ borderColor: '#EF4444', color: '#EF4444', py: 1.5, borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: '#EF444411' }, '&:disabled': { borderColor: 'rgba(255,255,255,0.1)', color: '#334155' } }}
                    onClick={() => { setActionDialog('reject'); setActionComment(''); }}
                  >
                    ❌ Reject Change
                  </Button>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Button
                    variant="outlined"
                    startIcon={<WarningAmberIcon />}
                    fullWidth
                    disabled={!canReview || review.status === 'under_analysis'}
                    sx={{ borderColor: '#F97316', color: '#F97316', py: 1.5, borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: '#F9731611' }, '&:disabled': { borderColor: 'rgba(255,255,255,0.1)', color: '#334155' } }}
                    onClick={() => { setActionDialog('escalate'); setActionComment(''); }}
                  >
                    ⚡ Escalate for Review
                  </Button>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Button
                    variant="outlined"
                    startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                    fullWidth
                    onClick={handleDownloadReport}
                    disabled={downloading || !canDownload}
                    sx={{ borderColor: '#3B82F6', color: '#3B82F6', py: 1.5, borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' } }}
                  >
                    {downloading ? 'Generating PDF...' : 'Download PDF Report'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Workflow Action Dialog */}
        <Dialog
          open={Boolean(actionDialog)}
          onClose={() => !actionLoading && setActionDialog(null)}
          PaperProps={{
            sx: {
              bgcolor: '#0F172A',
              color: 'white',
              minWidth: 420,
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.09)',
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
            {actionDialog === 'approve' ? '✅ Approve Review' : actionDialog === 'reject' ? '❌ Reject Review' : '⚡ Escalate Review'}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
              {actionDialog === 'approve'
                ? 'Confirm that this configuration change has been reviewed and is safe to proceed.'
                : actionDialog === 'reject'
                ? 'Provide a clear reason why this change is being rejected so the submitter can address it.'
                : 'Escalate this review to a senior engineer or security team for further evaluation.'
              }
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="Comment *"
              placeholder={actionDialog === 'approve' ? 'e.g. Reviewed and confirmed low risk, all checks passed.' : actionDialog === 'reject' ? 'e.g. Port 22 exposed to 0.0.0.0/0 — security violation.' : 'e.g. Escalating to security team for CIS control review.'}
              value={actionComment}
              onChange={e => setActionComment(e.target.value)}
              disabled={actionLoading}
              multiline
              rows={3}
              sx={{ '& textarea': { color: 'white' }, '& label': { color: '#64748B' }, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button onClick={() => setActionDialog(null)} disabled={actionLoading} sx={{ color: '#64748B', fontWeight: 600 }}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!actionComment.trim() || actionLoading}
              onClick={handleWorkflowAction}
              sx={{
                bgcolor: actionDialog === 'approve' ? '#10B981' : actionDialog === 'reject' ? '#EF4444' : '#F97316',
                fontWeight: 700,
                borderRadius: 2,
                px: 4,
                '&:hover': { bgcolor: actionDialog === 'approve' ? '#059669' : actionDialog === 'reject' ? '#DC2626' : '#EA6C00' },
              }}
            >
              {actionLoading ? <CircularProgress size={20} color="inherit" /> : `Confirm ${actionDialog?.charAt(0).toUpperCase()}${actionDialog?.slice(1)}`}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}
